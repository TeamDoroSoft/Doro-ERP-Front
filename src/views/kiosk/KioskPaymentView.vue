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
  message = ref('결제 버튼을 누르면 토스 테스트 결제창이 열립니다.'),
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
      message.value = '결제 확인이 필요합니다. 직원의 안내를 기다려주세요.'
    } else message.value = '결제가 완료되지 않았습니다.'
  } catch (e) {
    message.value =
      e instanceof ApiError && e.status >= 500
        ? '결제 결과가 확실하지 않습니다. 직원의 확인을 기다려주세요.'
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
  <section class="payment">
    <div v-if="payment">
      <p>주문 {{ flow.order?.displayNumber }}</p>
      <h1>{{ review ? '결제 확인 필요' : '결제를 진행해주세요' }}</h1>
      <span>{{ message }}</span
      ><strong>{{ formatKrw(payment.amount) }}</strong
      ><button v-if="!review" :disabled="busy" @click="start">
        {{ busy ? '처리 중…' : '결제하기' }}
      </button>
    </div>
    <div v-else>
      <h1>결제 정보를 찾을 수 없어요</h1>
      <RouterLink to="/kiosk/cart">장바구니로 돌아가기</RouterLink>
    </div>
  </section>
</template>
<style scoped>
.payment {
  display: grid;
  min-height: calc(100dvh - 190px);
  place-items: center;
}
.payment > div {
  display: grid;
  width: min(620px, 100%);
  place-items: center;
  gap: 18px;
  border-radius: 34px;
  background: #fff;
  padding: 55px;
  text-align: center;
}
.payment p {
  color: #126a5a;
  font-weight: 900;
}
.payment h1 {
  font-size: 38px;
}
.payment span {
  color: #68766f;
}
.payment strong {
  font-size: 36px;
}
.payment button,
.payment a {
  display: grid;
  width: 100%;
  min-height: 64px;
  place-items: center;
  border: 0;
  border-radius: 20px;
  background: #126a5a;
  color: #fff;
  font-size: 18px;
  font-weight: 900;
}
</style>
