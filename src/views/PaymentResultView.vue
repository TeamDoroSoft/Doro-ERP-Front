<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PaymentApiError,
  confirmPayment,
  isAuthenticationPaymentError,
  isDependencyPaymentError,
  paymentProblemMessage,
  type PaymentResponse,
} from '@/api/payment'
import {
  clearPendingPayment,
  readPendingPayment,
  saveRecentPaymentId,
  type PendingPayment,
} from '@/payments/pendingPayment'
import { displayLabel } from '@/ui/displayLabels'
import { formatCurrencyInt64 } from '@/api/int64'

const route = useRoute()
const router = useRouter()
const flowId = queryValue('flow')
const successRedirect = computed(() => route.name === 'payment-toss-success')

const busy = ref(false)
const result = ref<PaymentResponse | null>(null)
const title = ref('결제 결과를 확인하고 있습니다')
const message = ref('잠시만 기다려 주세요.')
const errorCode = ref('')
const canRetry = ref(false)
const orderId = ref('')

let pending: PendingPayment | null = null
let paymentKey = ''
let returnedProviderOrderId = ''
let returnedAmount = ''

onMounted(async () => {
  if (successRedirect.value) {
    captureSuccessRedirect()
    captureOrderId()
    await removeSensitiveQuery()
    await approvePayment()
  } else {
    captureOrderId()
    showTossFailure()
    await removeSensitiveQuery()
  }
})

async function approvePayment() {
  if (busy.value) {
    return
  }
  pending = pending ?? readPendingPayment(flowId)
  if (pending) {
    orderId.value = pending.payment.orderId
  }
  const validationMessage = validateRedirect(pending)
  if (validationMessage) {
    title.value = '결제 정보를 확인할 수 없습니다'
    message.value = validationMessage
    errorCode.value = 'PAYMENT_REDIRECT_MISMATCH'
    canRetry.value = false
    clearPendingPayment(flowId)
    return
  }

  busy.value = true
  title.value = '결제를 확인하고 있습니다'
  message.value = '결제 결과를 확인하는 동안 잠시만 기다려 주세요.'
  errorCode.value = ''
  canRetry.value = false
  try {
    const confirmed = await confirmPayment(
      pending!.payment.id,
      paymentKey,
      returnedAmount,
      pending!.confirmIdempotencyKey,
    )
    assertConfirmContract(confirmed, pending!)
    result.value = confirmed
    saveRecentPaymentId(confirmed.orderId, confirmed.id)
    clearPendingPayment(flowId)

    if (confirmed.status === 'PAID') {
      title.value = '결제가 완료되었습니다'
      message.value = '결제가 완료되었습니다.'
    } else if (confirmed.status === 'REVIEW_REQUIRED') {
      title.value = '결제 확인이 필요합니다'
      message.value =
        '결제 결과를 바로 확인할 수 없습니다. 주문 화면에서 결제 상태를 다시 확인해 주세요.'
    } else {
      title.value = '결제가 완료되지 않았습니다'
      message.value = `결제 상태는 ${displayLabel(confirmed.status)}입니다.`
    }
  } catch (error) {
    handleConfirmError(error)
  } finally {
    busy.value = false
  }
}

function captureSuccessRedirect() {
  paymentKey = queryValue('paymentKey')
  returnedProviderOrderId = queryValue('orderId')
  returnedAmount = queryValue('amount')
}

function captureOrderId() {
  const stored = readPendingPayment(flowId)
  if (stored) {
    orderId.value = stored.payment.orderId
    // The payment has already been created even when Toss is cancelled or its
    // redirect fails validation; let the originating order find that payment.
    saveRecentPaymentId(stored.payment.orderId, stored.payment.id)
  }
}

function showTossFailure() {
  const returnedCode = queryValue('code')
  const knownCodes = ['PAY_PROCESS_CANCELED', 'PAY_PROCESS_ABORTED', 'REJECT_CARD_COMPANY']
  const code = knownCodes.includes(returnedCode) ? returnedCode : 'TOSS_PAYMENT_FAILED'
  errorCode.value = code
  title.value = code === 'PAY_PROCESS_CANCELED' ? '결제가 취소되었습니다' : '결제를 완료하지 못했습니다'
  const safeMessageByCode: Record<string, string> = {
    PAY_PROCESS_CANCELED: '결제가 취소되었습니다. 주문에서 다시 결제할 수 있습니다.',
    PAY_PROCESS_ABORTED: '결제가 중단되었습니다. 결제 정보를 확인한 뒤 다시 시도해 주세요.',
    REJECT_CARD_COMPANY: '카드사에서 결제를 승인하지 않았습니다. 다른 결제 수단을 이용해 주세요.',
  }
  message.value = safeMessageByCode[code] ?? '결제를 완료하지 못했습니다. 주문에서 다시 시도해 주세요.'
  clearPendingPayment(flowId)
}

function validateRedirect(stored: PendingPayment | null): string {
  if (!stored) {
    return '진행 중인 결제 정보를 찾을 수 없습니다. 주문 목록에서 다시 시작하세요.'
  }
  if (
    !paymentKey ||
    !returnedProviderOrderId ||
    !/^\d+$/.test(returnedAmount) ||
    BigInt(returnedAmount) <= 0n
  ) {
    return '결제 정보를 확인할 수 없습니다. 주문에서 결제 상태를 확인해 주세요.'
  }
  if (
    returnedProviderOrderId !== stored.payment.providerOrderId ||
    returnedAmount !== stored.payment.amount
  ) {
    return '결제 정보가 일치하지 않습니다. 주문에서 결제 상태를 확인해 주세요.'
  }
  return ''
}

function assertConfirmContract(confirmed: PaymentResponse, stored: PendingPayment) {
  if (
    confirmed.id !== stored.payment.id ||
    confirmed.orderId !== stored.payment.orderId ||
    confirmed.providerOrderId !== stored.payment.providerOrderId ||
    confirmed.amount !== stored.payment.amount ||
    confirmed.currency !== stored.payment.currency ||
    !['PAID', 'FAILED', 'REVIEW_REQUIRED'].includes(confirmed.status)
  ) {
    throw new ConfirmContractError()
  }
}

function handleConfirmError(error: unknown) {
  if (error instanceof ConfirmContractError) {
    title.value = '결제 정보를 확인할 수 없습니다'
    message.value = error.message
    errorCode.value = 'PAYMENT_CONFIRM_CONTRACT_MISMATCH'
    canRetry.value = false
    clearPendingPayment(flowId)
    return
  }
  if (isAuthenticationPaymentError(error)) {
    title.value = '로그인 시간이 만료되었습니다'
  } else if (isDependencyPaymentError(error)) {
    title.value = '결제 상태를 확인할 수 없습니다'
  } else {
    title.value = '결제를 완료하지 못했습니다'
  }
  message.value = safeConfirmMessage(error)
  errorCode.value = error instanceof PaymentApiError ? error.code : 'NETWORK_ERROR'
  canRetry.value = isRetriableConfirmError(error)
}

function isRetriableConfirmError(error: unknown): boolean {
  return (
    error instanceof PaymentApiError &&
    (error.status === 0 || error.status >= 500 || error.code === 'IDEMPOTENCY_REQUEST_IN_PROGRESS')
  )
}

function safeConfirmMessage(error: unknown): string {
  if (!(error instanceof PaymentApiError)) {
    return '네트워크 상태를 확인한 뒤 다시 시도해 주세요.'
  }
  const safeCodes = new Set([
    'UNAUTHENTICATED',
    'AUTHENTICATION_REQUIRED',
    'SESSION_ABSOLUTE_EXPIRED',
    'SESSION_VALIDATION_UNAVAILABLE',
    'PAYMENT_UNAVAILABLE',
    'DEPENDENCY_UNAVAILABLE',
    'PAYMENT_NOT_FOUND',
    'ACCESS_DENIED',
    'VALIDATION_FAILED',
    'IDEMPOTENCY_KEY_REUSED',
    'IDEMPOTENCY_REQUEST_IN_PROGRESS',
    'STATE_CONFLICT',
    'ORDER_NOT_ELIGIBLE',
    'PROVIDER_REJECTED',
  ])
  return safeCodes.has(error.code)
    ? paymentProblemMessage(error)
    : '결제 승인을 완료하지 못했습니다. 주문에서 결제 상태를 확인해 주세요.'
}

async function removeSensitiveQuery() {
  await router.replace({ name: route.name ?? undefined, query: flowId ? { flow: flowId } : {} })
}

async function returnToOrder() {
  await router.replace(
    orderId.value
      ? { name: 'pos-orders-detail', params: { orderId: orderId.value } }
      : { name: 'pos-orders' },
  )
}

function queryValue(key: string): string {
  const value = route.query[key]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function formatAmount(amount: string, currency: string) {
  return formatCurrencyInt64(amount, currency)
}

class ConfirmContractError extends Error {
  constructor() {
    super('승인 결과가 생성된 결제 정보와 일치하지 않습니다.')
    this.name = 'ConfirmContractError'
  }
}
</script>

<template>
  <main class="payment-page">
    <header class="payment-heading">
      <div><p class="result-eyebrow">결제 관리</p><h1 id="result-title">{{ title }}</h1></div>
      <button type="button" class="result-button" @click="returnToOrder">주문으로 돌아가기</button>
    </header>
    <section class="payment-notice" :class="{ 'result-error': errorCode }" :role="errorCode ? 'alert' : 'status'">
      <strong>{{ errorCode ? '결제 상태 확인 필요' : '결제 상태' }}</strong>
      <span>{{ message }}</span>
    </section>
    <section class="payment-record">
      <div class="record-heading"><h2>결제 상세</h2><span>결제 금액과 현재 상태를 확인합니다.</span></div>
      <dl v-if="result" class="result-facts">
        <div>
          <dt>결제 번호</dt>
          <dd>{{ result.id }}</dd>
        </div>
        <div>
          <dt>주문 번호</dt>
          <dd>{{ result.orderId }}</dd>
        </div>
        <div>
          <dt>금액</dt>
          <dd>{{ formatAmount(result.amount, result.currency) }}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>{{ displayLabel(result.status) }}</dd>
        </div>
      </dl>
      <p v-else class="no-record">결제 승인 결과가 아직 없습니다. 주문에서 결제를 다시 확인해 주세요.</p>
      <div class="result-actions">
        <button
          v-if="canRetry"
          type="button"
          class="result-button result-button--primary"
          :disabled="busy"
          @click="approvePayment"
        >
        {{ busy ? '결제 확인 중…' : '다시 확인' }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.payment-page { display: grid; min-height: 100vh; gap: 18px; width: 100%; background: var(--color-background); padding: 30px max(24px, calc((100vw - 1160px) / 2)); }
.payment-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid var(--color-border); padding-bottom:14px; }
.payment-heading h1 { margin:3px 0 0; color:var(--color-heading); font-size:24px; letter-spacing:-.025em; }
.payment-notice { display:grid; gap:3px; border-left:3px solid var(--color-primary); background:#fff; padding:12px 14px; color:var(--color-text); font-size:13px; }
.payment-notice strong { color:var(--color-heading); font-size:12px; }.payment-notice small { color:var(--color-muted); font-family:ui-monospace, monospace; }
.payment-record { border:1px solid var(--color-border); border-radius:4px; background:#fff; }.record-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid var(--color-border); padding:13px 16px; }.record-heading h2 { margin:0; color:var(--color-heading); font-size:14px; }.record-heading span { color:var(--color-muted); font-size:12px; }.no-record { margin:0; padding:34px 16px; color:var(--color-muted); font-size:13px; text-align:center; }

.result-eyebrow {
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.result-error { border-left-color: #b42318; color: #8f2222; }

.result-code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.86rem;
}

.result-facts {
  margin: 0;
}

.result-facts div {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 1rem;
  padding: 12px 16px;
}

.result-facts div + div {
  border-top: 1px solid var(--color-border);
}

.result-facts dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: 700;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  border-top: 1px solid var(--color-border);
  padding: 12px 16px;
}

.result-button {
  border: 1px solid var(--color-border-strong);
  border-radius: 4px;
  padding: 0.7rem 1rem;
  background: #ffffff;
  color: var(--color-heading);
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.result-button--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #ffffff;
}

.result-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
@media (max-width:640px) { .payment-heading { align-items:stretch; flex-direction:column; }.record-heading { align-items:start; flex-direction:column; gap:4px; }.result-facts div { grid-template-columns:1fr; gap:3px; } }
</style>
