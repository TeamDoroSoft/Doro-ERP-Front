<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { confirmPayment } from '@/api/payment'
import { formatKrw } from '@/api/int64'
import { requestTossPayment, tossPaymentErrorMessage } from '@/payments/tossPayment'
import { useKioskFlowStore } from '@/stores/kioskFlow'
const route = useRoute(),
  router = useRouter(),
  flow = useKioskFlowStore(),
  busy = ref(false),
  message = ref('결제 버튼을 누르면 결제 화면으로 이동합니다.'),
  review = ref(false),
  payment = computed(() =>
    flow.payment?.id === String(route.params.paymentId) ? flow.payment : null,
  )
onMounted(() => {
  if (route.query.paymentKey || route.query.orderId || route.query.amount) void approve()
})
watch(
  () => route.fullPath,
  () => {
    if (route.query.paymentKey || route.query.orderId || route.query.amount) void approve()
  },
)
async function start() {
  if (!payment.value || busy.value) return
  busy.value = true
  try {
    await requestTossPayment({
      clientKey: import.meta.env.VITE_TOSS_CLIENT_KEY ?? '',
      amount: payment.value.amount,
      currency: 'KRW',
      providerOrderId: payment.value.providerOrderId,
      orderName: `주문 ${flow.order?.displayNumber ?? ''}`,
      successUrl: callback('success'),
      failUrl: callback('fail'),
    })
  } catch (e) {
    message.value = tossPaymentErrorMessage(e)
  } finally {
    busy.value = false
  }
}
async function approve() {
  const paymentKey = String(route.query.paymentKey ?? ''),
    providerId = String(route.query.orderId ?? ''),
    amount = String(route.query.amount ?? '')
  await router.replace({ path: route.path })
  if (
    !payment.value ||
    !paymentKey ||
    providerId !== payment.value.providerOrderId ||
    amount !== payment.value.amount
  ) {
    message.value = '결제 정보를 확인할 수 없습니다.'
    return
  }
  flow.approving = true
  busy.value = true
  try {
    const result = await confirmPayment(
      payment.value.id,
      paymentKey,
      amount,
      flow.paymentConfirmKey,
      'kiosk',
    )
    flow.payment = result
    if (result.status === 'PAID') {
      await router.replace(`/kiosk/orders/${flow.order?.orderId}`)
    } else if (result.status === 'REVIEW_REQUIRED') {
      review.value = true
      message.value = '결제 확인이 필요합니다. 직원의 안내를 기다려 주세요.'
    } else message.value = '결제가 완료되지 않았습니다.'
  } catch (e) {
    message.value =
      e instanceof ApiError && e.status >= 500
        ? '결제 결과를 바로 확인할 수 없습니다. 직원의 안내를 기다려 주세요.'
        : '결제를 완료하지 못했습니다.'
  } finally {
    flow.approving = false
    busy.value = false
  }
}
function callback(outcome: string) {
  const url = new URL(route.path, location.origin)
  url.searchParams.set('outcome', outcome)
  return url.toString()
}
</script>
<template>
  <section class="payment-page">
    <div v-if="payment" class="payment-panel">
      <p class="eyebrow">주문 {{ flow.order?.displayNumber }}</p>
      <h1>{{ review ? '결제 확인이 필요합니다' : '결제를 진행해 주세요' }}</h1>
      <span>{{ message }}</span>
      <div class="amount"><small>결제 금액</small><strong>{{ formatKrw(payment.amount) }}</strong></div>
      <button v-if="!review" :disabled="busy" @click="start">
        {{ busy ? '결제 중…' : '결제하기' }}
      </button>
    </div>
    <div v-else class="payment-panel">
      <h1>결제 정보를 찾을 수 없어요</h1>
      <RouterLink to="/kiosk/cart">장바구니로 돌아가기</RouterLink>
    </div>
  </section>
</template>
<style scoped>
.payment-page { display: grid; min-height: calc(100dvh - 190px); place-items: center; }.payment-panel { display: grid; width: min(580px, 100%); gap: 18px; border: 1px solid #cfd6d1; border-radius: 7px; background: #fff; padding: clamp(28px, 6vw, 52px); text-align: center; }.eyebrow { margin: 0; color: #087f5b; font-size: 14px; font-weight: 800; }.payment-panel h1 { margin: 0; font-size: 31px; letter-spacing: -1px; }.payment-panel > span { color: #687078; line-height: 1.6; }.amount { display: grid; gap: 7px; border-top: 1px solid #e6e9e7; border-bottom: 1px solid #e6e9e7; padding: 18px 0; }.amount small { color: #687078; }.amount strong { font-size: 31px; }.payment-panel button, .payment-panel a { display: grid; width: 100%; min-height: 60px; place-items: center; border: 0; border-radius: 4px; background: #087f5b; color: #fff; font-size: 17px; font-weight: 800; }
</style>
