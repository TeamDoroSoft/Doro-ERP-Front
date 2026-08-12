<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  PaymentApiError,
  createPayment,
  createPaymentIdempotencyKey,
  paymentProblemMessage,
  type PaymentResponse,
} from '@/api/payment'
import { savePendingPayment } from '@/payments/pendingPayment'
import { requestTossPayment, tossPaymentErrorMessage } from '@/payments/tossPayment'

const route = useRoute()
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
const orderId = ref(queryValue('orderId'))
const orderNumber = ref(queryValue('orderNumber'))
const amountInput = ref(queryValue('amount'))
const requestedAmount = computed(() => Number(amountInput.value))
const currency = 'KRW'
const orderName = computed(() => `주문 ${orderNumber.value || orderId.value}`.slice(0, 100))
const orderIsValid = computed(
  () =>
    /^[0-9a-fA-F-]{36}$/.test(orderId.value) &&
    Number.isSafeInteger(requestedAmount.value) &&
    requestedAmount.value > 0,
)

const busy = ref(false)
const errorMessage = ref('')
const errorKind = ref('')
const payment = ref<PaymentResponse | null>(null)
const createIdempotencyKey = createPaymentIdempotencyKey()
const confirmIdempotencyKey = createPaymentIdempotencyKey()
const flowId = createPaymentIdempotencyKey()

async function startPayment() {
  if (busy.value || !orderIsValid.value) {
    return
  }
  if (!import.meta.env.VITE_TOSS_CLIENT_KEY?.trim()) {
    errorKind.value = '설정 오류'
    errorMessage.value = 'VITE_TOSS_CLIENT_KEY가 설정되지 않았습니다.'
    return
  }

  busy.value = true
  errorMessage.value = ''
  errorKind.value = ''
  try {
    if (!payment.value) {
      payment.value = await createPayment(apiBaseUrl, orderId.value, createIdempotencyKey)
      assertCreateContract(payment.value)
    }

    const pending = {
      apiBaseUrl,
      payment: payment.value,
      orderName: orderName.value,
      confirmIdempotencyKey,
    }
    savePendingPayment(flowId, pending)

    await requestTossPayment({
      clientKey: import.meta.env.VITE_TOSS_CLIENT_KEY,
      amount: payment.value.amount,
      currency: 'KRW',
      providerOrderId: payment.value.providerOrderId,
      orderName: orderName.value,
      successUrl: redirectUrl('success'),
      failUrl: redirectUrl('fail'),
    })
  } catch (error) {
    if (error instanceof PaymentContractError) {
      errorKind.value = '계약 검증 실패'
      errorMessage.value = error.message
    } else if (error instanceof PaymentApiError) {
      errorKind.value = error.status === 401 ? '인증 실패' : '결제 생성 실패'
      errorMessage.value = paymentProblemMessage(error)
    } else {
      errorKind.value = 'Toss 결제창 오류'
      errorMessage.value = tossPaymentErrorMessage(error)
    }
  } finally {
    busy.value = false
  }
}

function assertCreateContract(created: PaymentResponse) {
  if (
    created.orderId !== orderId.value ||
    !Number.isSafeInteger(created.amount) ||
    created.amount <= 0 ||
    created.currency !== 'KRW' ||
    created.status !== 'PENDING' ||
    !/^[A-Za-z0-9_-]{6,64}$/.test(created.providerOrderId)
  ) {
    payment.value = null
    throw new PaymentContractError()
  }
}

function redirectUrl(outcome: 'success' | 'fail'): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  const url = new URL(`${basePath}/payments/toss/${outcome}`, window.location.origin)
  url.searchParams.set('flow', flowId)
  return url.toString()
}

function queryValue(key: string): string {
  const value = route.query[key]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function formatAmount(amount: number, amountCurrency: string) {
  if (!Number.isFinite(amount)) {
    return '-'
  }
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: amountCurrency || 'KRW',
  }).format(amount)
}

class PaymentContractError extends Error {
  constructor() {
    super('서버 결제 정보가 주문 또는 Toss 요청 계약과 일치하지 않습니다.')
    this.name = 'PaymentContractError'
  }
}
</script>

<template>
  <main class="payment-shell">
    <section class="payment-card" aria-labelledby="payment-title">
      <div>
        <p class="payment-eyebrow">TOSS PAYMENTS TEST</p>
        <h1 id="payment-title">직원 테스트 결제</h1>
        <p class="payment-description">
          주문 ID와 표시 금액을 입력하면 직원 세션으로 Edge를 거쳐 결제를 생성합니다.
        </p>
      </div>

      <form class="payment-form" @submit.prevent="startPayment">
        <label for="payment-order-id">주문 ID *</label>
        <input
          id="payment-order-id"
          v-model.trim="orderId"
          required
          autocomplete="off"
          placeholder="UUID"
          :disabled="busy || Boolean(payment)"
        />

        <label for="payment-order-number">주문 번호</label>
        <input
          id="payment-order-number"
          v-model.trim="orderNumber"
          autocomplete="off"
          placeholder="테스트 표시용"
          :disabled="busy || Boolean(payment)"
        />

        <label for="payment-amount">표시 금액 (KRW) *</label>
        <input
          id="payment-amount"
          v-model="amountInput"
          type="number"
          min="1"
          step="1"
          required
          :disabled="busy || Boolean(payment)"
        />

        <p class="payment-preview">
          {{ formatAmount(requestedAmount, currency) }} · 실제 결제 금액은 Payment 생성 응답을
          사용합니다.
        </p>

        <p v-if="!orderIsValid" class="payment-error" role="alert">
          결제할 주문 UUID와 1원 이상의 KRW 정수 금액을 입력하세요.
        </p>
        <div v-if="errorMessage" class="payment-error" role="alert">
          <strong>{{ errorKind }}</strong>
          <span>{{ errorMessage }}</span>
        </div>

        <dl v-if="payment" class="payment-facts">
          <div>
            <dt>Payment ID</dt>
            <dd>{{ payment.id }}</dd>
          </div>
          <div>
            <dt>서버 금액</dt>
            <dd>{{ formatAmount(payment.amount, payment.currency) }}</dd>
          </div>
          <div>
            <dt>결제 상태</dt>
            <dd>{{ payment.status }}</dd>
          </div>
        </dl>

        <div class="payment-actions">
          <button
            type="submit"
            class="payment-button payment-button--primary"
            :disabled="busy || !orderIsValid"
          >
            {{ busy ? '결제 준비 중…' : payment ? 'Toss 결제창 다시 열기' : '결제하기' }}
          </button>
          <RouterLink class="payment-button" to="/">홈으로</RouterLink>
        </div>
      </form>

      <p class="payment-note">
        테스트 클라이언트 키만 사용합니다. 최종 성공은 Backend 승인 결과가 PAID일 때만 표시됩니다.
      </p>
    </section>
  </main>
</template>

<style scoped>
.payment-shell {
  display: grid;
  min-height: calc(100vh - 58px);
  place-items: center;
  padding: 2rem 1rem;
}

.payment-card {
  display: grid;
  width: min(42rem, 100%);
  gap: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: clamp(1.25rem, 4vw, 2rem);
  background: var(--color-background-soft);
  box-shadow: 0 20px 60px rgba(22, 33, 31, 0.08);
}

.payment-card h1 {
  margin: 0.2rem 0 0;
  color: var(--color-heading);
}

.payment-eyebrow,
.payment-description,
.payment-note {
  margin: 0;
  color: var(--color-text);
}

.payment-eyebrow {
  color: #126a5a;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.payment-facts {
  display: grid;
  gap: 0;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.payment-form {
  display: grid;
  gap: 0.6rem;
}

.payment-form label {
  color: var(--color-heading);
  font-weight: 700;
}

.payment-form input {
  width: 100%;
  border: 1px solid var(--color-border-hover);
  border-radius: 7px;
  padding: 0.7rem 0.8rem;
  background: #ffffff;
  color: var(--color-heading);
  font: inherit;
}

.payment-form input:disabled {
  background: var(--color-background);
  color: var(--color-text);
}

.payment-preview {
  margin: 0 0 0.4rem;
  color: var(--color-text);
  font-size: 0.86rem;
}

.payment-facts div {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr);
  gap: 1rem;
  padding: 0.75rem 1rem;
}

.payment-facts div + div {
  border-top: 1px solid var(--color-border);
}

.payment-facts dt {
  color: var(--color-text);
}

.payment-facts dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-heading);
  font-weight: 700;
}

.payment-error {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  border-left: 4px solid #b42318;
  padding: 0.8rem 1rem;
  background: #fff0ed;
  color: #b42318;
}

.payment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.payment-button {
  border: 1px solid var(--color-border-hover);
  border-radius: 7px;
  padding: 0.7rem 1rem;
  background: #ffffff;
  color: var(--color-heading);
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.payment-button--primary {
  border-color: #126a5a;
  background: #126a5a;
  color: #ffffff;
}

.payment-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.payment-note {
  font-size: 0.85rem;
}
</style>
