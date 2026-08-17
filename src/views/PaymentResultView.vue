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

const route = useRoute()
const router = useRouter()
const flowId = queryValue('flow')
const successRedirect = computed(() => route.name === 'payment-toss-success')

const busy = ref(false)
const result = ref<PaymentResponse | null>(null)
const title = ref('결제 결과 확인 중')
const message = ref('결제 승인 결과를 확인하고 있습니다.')
const errorCode = ref('')
const canRetry = ref(false)
const orderId = ref('')

let pending: PendingPayment | null = null
let paymentKey = ''
let returnedProviderOrderId = ''
let returnedAmount = 0

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
    title.value = '결제 정보 검증 실패'
    message.value = validationMessage
    errorCode.value = 'PAYMENT_REDIRECT_MISMATCH'
    canRetry.value = false
    clearPendingPayment(flowId)
    return
  }

  busy.value = true
  title.value = '결제 승인 중'
  message.value = '토스 결제 인증을 승인하고 있습니다.'
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
        '결제 결과가 불명확합니다. 성공 또는 실패로 추측하지 말고 운영 확인을 진행하세요.'
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
  returnedAmount = Number(queryValue('amount'))
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
  title.value = code === 'PAY_PROCESS_CANCELED' ? '결제가 취소되었습니다' : '토스 결제 인증 실패'
  const safeMessageByCode: Record<string, string> = {
    PAY_PROCESS_CANCELED: '사용자가 결제를 취소했습니다. 결제 승인을 진행하지 않았습니다.',
    PAY_PROCESS_ABORTED: '결제 인증이 중단되었습니다. 결제 정보를 확인한 뒤 다시 시도하세요.',
    REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다. 다른 결제수단을 확인하세요.',
  }
  message.value = safeMessageByCode[code] ?? '토스페이먼츠에서 결제 인증을 완료하지 못했습니다.'
  clearPendingPayment(flowId)
}

function validateRedirect(stored: PendingPayment | null): string {
  if (!stored) {
    return '진행 중인 결제 정보를 찾을 수 없습니다. 주문 목록에서 다시 시작하세요.'
  }
  if (
    !paymentKey ||
    !returnedProviderOrderId ||
    !Number.isSafeInteger(returnedAmount) ||
    returnedAmount <= 0
  ) {
    return '결제 결과에 필요한 정보가 없거나 형식이 올바르지 않습니다.'
  }
  if (
    returnedProviderOrderId !== stored.payment.providerOrderId ||
    returnedAmount !== stored.payment.amount
  ) {
    return '토스 결제 정보의 주문 ID 또는 금액이 결제 생성 결과와 일치하지 않습니다.'
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
    title.value = '결제 정보 확인 실패'
    message.value = error.message
    errorCode.value = 'PAYMENT_CONFIRM_CONTRACT_MISMATCH'
    canRetry.value = false
    clearPendingPayment(flowId)
    return
  }
  if (isAuthenticationPaymentError(error)) {
    title.value = '직원 세션이 만료되었습니다'
  } else if (isDependencyPaymentError(error)) {
    title.value = '결제 서비스를 확인할 수 없습니다'
  } else {
    title.value = '결제 승인 실패'
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
    return '네트워크 상태를 확인한 뒤 다시 시도하세요.'
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
    : '결제 승인을 완료하지 못했습니다. 주문에서 결제 상태를 확인하세요.'
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

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(amount)
}

class ConfirmContractError extends Error {
  constructor() {
    super('승인 결과가 생성된 결제 정보와 일치하지 않습니다.')
    this.name = 'ConfirmContractError'
  }
}
</script>

<template>
  <main class="result-shell">
    <section class="result-card" aria-labelledby="result-title">
      <p class="result-eyebrow">결제 결과</p>
      <h1 id="result-title">{{ title }}</h1>
      <p :class="{ 'result-error': errorCode }" :role="errorCode ? 'alert' : 'status'">
        {{ message }}
      </p>
      <p v-if="errorCode" class="result-code">참고 코드: {{ errorCode }}</p>

      <dl v-if="result" class="result-facts">
        <div>
          <dt>결제 ID</dt>
          <dd>{{ result.id }}</dd>
        </div>
        <div>
          <dt>주문 ID</dt>
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

      <div class="result-actions">
        <button
          v-if="canRetry"
          type="button"
          class="result-button result-button--primary"
          :disabled="busy"
          @click="approvePayment"
        >
          {{ busy ? '승인 확인 중…' : '승인 다시 시도' }}
        </button>
        <button type="button" class="result-button result-button--primary" @click="returnToOrder">
          주문으로 돌아가기
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.result-shell {
  display: grid;
  min-height: calc(100vh - 58px);
  place-items: center;
  padding: 2rem 1rem;
}

.result-card {
  display: grid;
  width: min(42rem, 100%);
  gap: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: clamp(1.25rem, 4vw, 2rem);
  background: var(--color-background-soft);
  box-shadow: 0 20px 60px rgba(22, 33, 31, 0.08);
}

.result-card h1,
.result-card p {
  margin: 0;
}

.result-eyebrow {
  color: #126a5a;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.result-error,
.result-code {
  color: #b42318;
}

.result-code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.86rem;
}

.result-facts {
  display: grid;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.result-facts div {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 1rem;
  padding: 0.7rem 1rem;
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
}

.result-button {
  border: 1px solid var(--color-border-hover);
  border-radius: 7px;
  padding: 0.7rem 1rem;
  background: #ffffff;
  color: var(--color-heading);
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.result-button--primary {
  border-color: #126a5a;
  background: #126a5a;
  color: #ffffff;
}

.result-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
