<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  cancelPublicCheckout,
  confirmPublicCheckout,
  getPublicCheckoutStatus,
  PublicCheckoutContractError,
  resolvePublicCheckout,
  startPublicCheckout,
  type PublicCheckoutResult,
  type PublicCheckoutSummary,
} from '@/api/publicCheckout'
import { ApiError } from '@/api/http'
import { formatKrw } from '@/api/int64'
import { requestTossPayment, tossPaymentErrorMessage } from '@/payments/tossPayment'
import { capturePublicCheckoutNavigation } from './publicCheckoutNavigation'

type Screen = 'loading' | 'ready' | 'starting' | 'checking' | 'paid' | 'failed' | 'unavailable'

const route = useRoute()
const captured = capturePublicCheckoutNavigation(window.location, window.history)
const publicId = computed(() => String(route.params.publicId ?? ''))
const screen = ref<Screen>('loading')
const summary = ref<PublicCheckoutSummary | null>(null)
const message = ref('결제 정보를 확인하고 있어요.')
const isSuccessRoute = computed(() => route.path.endsWith('/success'))
const isFailRoute = computed(() => route.path.endsWith('/fail'))
let recoveryTimer: number | undefined

onMounted(() => {
  window.addEventListener('online', handleOnline)
  document.addEventListener('visibilitychange', handleVisibility)
  void initialize()
})
onBeforeUnmount(() => {
  clearTimeout(recoveryTimer)
  window.removeEventListener('online', handleOnline)
  document.removeEventListener('visibilitychange', handleVisibility)
})

async function initialize() {
  if (!publicId.value) return unavailable()
  if (isSuccessRoute.value && redirectCanConfirm()) {
    await confirmRedirect()
    return
  }
  if (isSuccessRoute.value || isFailRoute.value) {
    if (isFailRoute.value) await cancelCheckout()
    else await recoverStatus()
    return
  }
  if (!captured.token) return unavailable()

  try {
    const resolved = await resolvePublicCheckout(publicId.value, captured.token)
    summary.value = resolved
    applyStatus(resolved)
  } catch (error) {
    handleInitialError(error)
  }
}

async function cancelCheckout() {
  screen.value = 'checking'
  message.value = '결제 취소를 처리하고 있어요.'
  try {
    applyResult(await cancelPublicCheckout(publicId.value), '결제를 취소했습니다.')
  } catch {
    await recoverStatus('결제를 취소했습니다.')
  }
}

async function pay() {
  if (!captured.token || screen.value !== 'ready') return
  screen.value = 'starting'
  message.value = '결제 화면을 준비하고 있어요.'
  try {
    const start = await startPublicCheckout(publicId.value, captured.token)
    if (start.amount !== summary.value?.amount) {
      return unavailable()
    }
    await requestTossPayment({
      clientKey: start.clientKey,
      providerOrderId: start.providerOrderId,
      orderName: start.orderName,
      amount: start.amount,
      currency: start.currency,
      successUrl: callbackUrl('success'),
      failUrl: callbackUrl('fail'),
    })
    message.value = '열린 결제창에서 결제 수단을 선택해 주세요.'
  } catch (error) {
    screen.value = 'ready'
    message.value =
      error instanceof ApiError || error instanceof PublicCheckoutContractError
        ? publicErrorMessage(error)
        : tossPaymentErrorMessage(error)
  }
}

async function confirmRedirect() {
  screen.value = 'checking'
  message.value = '결제 결과를 확인하고 있어요.'
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)
  const input = {
    paymentKey: captured.paymentKey,
    providerOrderId: captured.providerOrderId,
    amount: captured.amount,
  }
  // Query data was already removed from the address synchronously. Remove the second in-memory
  // copy before crossing an asynchronous boundary as well.
  captured.paymentKey = ''
  captured.providerOrderId = ''
  captured.amount = ''
  try {
    const result = await confirmPublicCheckout(publicId.value, input, controller.signal)
    applyResult(result)
  } catch {
    // A provider approval and the Doro response can cross. Never infer success from this redirect.
    await recoverStatus()
  } finally {
    window.clearTimeout(timeout)
  }
}

async function recoverStatus(fallbackMessage?: string) {
  clearTimeout(recoveryTimer)
  screen.value = 'checking'
  message.value = '결제 결과를 확인하고 있어요.'
  try {
    applyResult(await getPublicCheckoutStatus(publicId.value), fallbackMessage)
  } catch {
    screen.value = 'checking'
    message.value = '결제 결과를 확인 중입니다. 잠시 후 다시 확인해 주세요.'
    scheduleRecovery()
  }
}

function applyStatus(value: PublicCheckoutSummary) {
  if (value.status === 'PAID') {
    screen.value = 'paid'
    message.value = '결제가 완료되었습니다.'
  } else if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(value.status)) {
    screen.value = 'failed'
    message.value = terminalMessage(value.status)
  } else if (value.status === 'PROCESSING') {
    screen.value = 'checking'
    message.value = '결제 결과를 확인 중입니다. 잠시 후 다시 확인해 주세요.'
  } else {
    screen.value = 'ready'
    message.value = '금액을 확인한 뒤 결제해 주세요.'
  }
}

function applyResult(value: PublicCheckoutResult, fallbackMessage?: string) {
  if (value.status === 'PAID') {
    screen.value = 'paid'
    message.value = '결제가 완료되었습니다.'
  } else if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(value.status)) {
    screen.value = 'failed'
    message.value = fallbackMessage ?? terminalMessage(value.status)
  } else {
    screen.value = 'checking'
    message.value = '결제 결과를 확인 중입니다. 잠시 후 다시 확인해 주세요.'
    scheduleRecovery()
  }
}

function scheduleRecovery() {
  clearTimeout(recoveryTimer)
  if (document.visibilityState === 'hidden' || screen.value !== 'checking') return
  recoveryTimer = window.setTimeout(() => void recoverStatus(), 2_500)
}

function handleOnline() {
  if (screen.value === 'checking' && document.visibilityState !== 'hidden') void recoverStatus()
}

function handleVisibility() {
  if (document.visibilityState === 'visible' && screen.value === 'checking') void recoverStatus()
  else clearTimeout(recoveryTimer)
}

function redirectCanConfirm(): boolean {
  return !!captured.paymentKey && !!captured.providerOrderId && !!captured.amount
}

function callbackUrl(outcome: 'success' | 'fail'): string {
  return new URL(`/pay/${encodeURIComponent(publicId.value)}/${outcome}`, location.origin).toString()
}

function terminalMessage(status: PublicCheckoutResult['status']): string {
  return status === 'EXPIRED'
    ? '결제 시간이 만료되었습니다. 직원에게 새 결제 링크를 요청해 주세요.'
    : '결제가 완료되지 않았습니다. 직원에게 문의해 주세요.'
}

function handleInitialError(error: unknown) {
  if (error instanceof ApiError && error.status >= 500) {
    screen.value = 'unavailable'
    message.value = '지금은 결제 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    return
  }
  unavailable()
}

function publicErrorMessage(error: unknown): string {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500)
    ? '결제 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    : '이 결제 링크를 사용할 수 없습니다.'
}

function unavailable() {
  screen.value = 'unavailable'
  message.value = '결제 링크가 만료되었거나 사용할 수 없어요.'
}
</script>

<template>
  <main class="public-checkout">
    <section class="checkout-card" aria-live="polite">
      <p class="brand">DORO PAYMENT</p>
      <h1 v-if="screen === 'loading'">결제 정보를 확인하고 있어요</h1>
      <h1 v-else-if="screen === 'paid'">결제가 완료되었습니다</h1>
      <h1 v-else-if="screen === 'checking'">결제 결과 확인 중</h1>
      <h1 v-else-if="screen === 'failed'">결제를 완료하지 못했어요</h1>
      <h1 v-else-if="screen === 'unavailable'">결제 링크를 사용할 수 없어요</h1>
      <h1 v-else>결제 내용을 확인해 주세요</h1>

      <p class="message">{{ message }}</p>

      <dl v-if="summary && screen !== 'unavailable'" class="summary">
        <div><dt>주문</dt><dd>{{ summary.orderName }}</dd></div>
        <div><dt>결제 금액</dt><dd class="amount">{{ formatKrw(summary.amount) }}</dd></div>
        <div><dt>결제 가능 시간</dt><dd>{{ new Date(summary.expiresAt).toLocaleString('ko-KR') }}</dd></div>
      </dl>

      <button v-if="screen === 'ready'" type="button" @click="pay">결제하기</button>
      <button v-else-if="screen === 'checking'" type="button" class="secondary" @click="recoverStatus()">
        결제 결과 다시 확인
      </button>
      <p v-if="screen === 'paid'" class="close-hint">이제 이 화면을 닫아도 됩니다.</p>
    </section>
  </main>
</template>

<style scoped>
.public-checkout { min-height: 100dvh; display: grid; place-items: center; padding: 20px; background: #f3f5f4; color: #18211d; }
.checkout-card { display: grid; gap: 20px; width: min(100%, 520px); padding: clamp(28px, 7vw, 48px); border: 1px solid #d9dfdc; border-radius: 16px; background: #fff; box-shadow: 0 16px 45px rgb(18 42 31 / 8%); }
.brand { margin: 0; color: #087f5b; font-size: 13px; font-weight: 900; letter-spacing: .12em; }
h1, .message, .close-hint { margin: 0; }
h1 { font-size: clamp(27px, 7vw, 36px); letter-spacing: -.04em; }
.message, .close-hint { color: #687078; line-height: 1.65; }
.summary { display: grid; gap: 14px; margin: 4px 0; padding: 20px 0; border-block: 1px solid #e7ebe9; }
.summary div { display: flex; justify-content: space-between; gap: 18px; }
dt { color: #687078; }
dd { margin: 0; text-align: right; font-weight: 700; }
.amount { font-size: 22px; color: #087f5b; }
button { min-height: 56px; border: 0; border-radius: 8px; background: #087f5b; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
button.secondary { border: 1px solid #087f5b; background: #fff; color: #087f5b; }
</style>
