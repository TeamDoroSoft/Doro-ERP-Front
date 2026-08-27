<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { confirmPayment, getPayment, type PaymentView } from '@/api/payment'
import { formatKrw } from '@/api/int64'
import { requestTossPayment, tossPaymentErrorMessage } from '@/payments/tossPayment'
import { useKioskFlowStore } from '@/stores/kioskFlow'
const route = useRoute(),
  router = useRouter(),
  flow = useKioskFlowStore(),
  loading = ref(true),
  verified = ref(false),
  busy = ref(false),
  message = ref('결제 버튼을 누르면 결제 화면으로 이동합니다.'),
  review = ref(false),
  terminal = ref(false),
  paymentId = computed(() => String(route.params.paymentId ?? '')),
  payment = computed(() => (flow.payment?.id === paymentId.value ? flow.payment : null))
let initializing = false
watch(
  () => route.fullPath,
  () => void initialize(),
  { immediate: true },
)

async function initialize() {
  if (initializing) return
  initializing = true
  loading.value = true
  verified.value = false
  const redirect = captureRedirect()
  try {
    if (redirect.hasProviderQuery) await router.replace({ path: route.path })
    const stored = payment.value
    if (!stored || flow.order?.orderId !== stored.orderId) {
      if (flow.order || flow.payment) flow.resetCustomer()
      return
    }

    const canonical = await getPayment(stored.id, 'kiosk')
    if (!samePayment(canonical, stored)) {
      flow.resetCustomer()
      message.value = '결제 정보를 확인할 수 없습니다.'
      return
    }
    flow.payment = canonical
    verified.value = true

    if (canonical.status === 'PAID') {
      await moveToOrder(canonical)
      return
    }
    if (canonical.status === 'REVIEW_REQUIRED') {
      review.value = true
      message.value = '결제 확인이 필요합니다. 직원의 안내를 기다려 주세요.'
      return
    }
    if (canonical.status === 'FAILED' || canonical.status === 'CANCELLED') {
      terminal.value = true
      message.value = '이 결제는 더 이상 진행할 수 없습니다. 직원에게 문의해 주세요.'
      return
    }
    if (redirect.outcome === 'fail') {
      message.value = '결제가 취소되었습니다. 다시 결제할 수 있습니다.'
      return
    }
    if (redirect.hasSuccessQuery) await approve(redirect, canonical)
  } catch (error) {
    if (error instanceof ApiError && error.status > 0 && error.status < 500) flow.resetCustomer()
    message.value =
      error instanceof ApiError && error.status >= 500
        ? '결제 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'
        : '결제 정보를 확인할 수 없습니다.'
  } finally {
    loading.value = false
    initializing = false
  }
}
async function start() {
  if (!payment.value || payment.value.status !== 'PENDING' || !verified.value || busy.value) return
  if (!flow.persistPaymentFlow()) {
    message.value = '결제를 안전하게 시작할 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.'
    return
  }
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
async function approve(redirect: PaymentRedirect, canonical: PaymentView) {
  if (
    !redirect.paymentKey ||
    redirect.providerOrderId !== canonical.providerOrderId ||
    redirect.amount !== canonical.amount
  ) {
    flow.resetCustomer()
    message.value = '결제 정보를 확인할 수 없습니다.'
    return
  }
  flow.approving = true
  busy.value = true
  try {
    const result = await confirmPayment(
      canonical.id,
      redirect.paymentKey,
      redirect.amount,
      flow.paymentConfirmKey,
      'kiosk',
    )
    if (
      !samePayment(result, canonical) ||
      !['PAID', 'FAILED', 'REVIEW_REQUIRED'].includes(result.status)
    ) {
      flow.resetCustomer()
      message.value = '결제 정보를 확인할 수 없습니다.'
      return
    }
    flow.payment = result
    if (result.status === 'PAID') {
      await moveToOrder(result)
    } else if (result.status === 'REVIEW_REQUIRED') {
      review.value = true
      message.value = '결제 확인이 필요합니다. 직원의 안내를 기다려 주세요.'
    } else {
      terminal.value = result.status === 'FAILED' || result.status === 'CANCELLED'
      message.value = '결제가 완료되지 않았습니다.'
    }
  } catch (e) {
    if (e instanceof ApiError && e.status >= 500) review.value = true
    message.value =
      e instanceof ApiError && e.status >= 500
        ? '결제 결과를 바로 확인할 수 없습니다. 직원의 안내를 기다려 주세요.'
        : '결제를 완료하지 못했습니다.'
  } finally {
    flow.approving = false
    busy.value = false
  }
}

async function moveToOrder(confirmed: PaymentView) {
  if (flow.order?.orderId !== confirmed.orderId || !flow.accessToken) {
    message.value = '주문 정보를 확인할 수 없습니다.'
    return
  }
  await router.replace(`/kiosk/orders/${confirmed.orderId}`)
}

function samePayment(canonical: PaymentView, stored: PaymentView): boolean {
  return (
    canonical.id === stored.id &&
    canonical.orderId === stored.orderId &&
    canonical.providerOrderId === stored.providerOrderId &&
    canonical.amount === stored.amount &&
    canonical.currency === stored.currency
  )
}

interface PaymentRedirect {
  outcome: string
  paymentKey: string
  providerOrderId: string
  amount: string
  hasSuccessQuery: boolean
  hasProviderQuery: boolean
}

function captureRedirect(): PaymentRedirect {
  const outcome = queryValue('outcome'),
    paymentKey = queryValue('paymentKey'),
    providerOrderId = queryValue('orderId'),
    amount = queryValue('amount')
  return {
    outcome,
    paymentKey,
    providerOrderId,
    amount,
    hasSuccessQuery: outcome === 'success' || !!paymentKey || !!providerOrderId || !!amount,
    hasProviderQuery:
      !!outcome ||
      !!paymentKey ||
      !!providerOrderId ||
      !!amount ||
      !!queryValue('code') ||
      !!queryValue('message'),
  }
}

function queryValue(key: string): string {
  const value = route.query[key]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}
function callback(outcome: string) {
  const url = new URL(route.path, location.origin)
  url.searchParams.set('outcome', outcome)
  return url.toString()
}
</script>
<template>
  <section class="payment-page">
    <div v-if="loading" class="payment-panel">
      <h1>결제 정보를 확인하고 있어요</h1>
      <span>잠시만 기다려 주세요.</span>
    </div>
    <div v-else-if="payment" class="payment-panel">
      <p class="eyebrow">주문 {{ flow.order?.displayNumber }}</p>
      <h1>{{ review ? '결제 확인이 필요합니다' : '결제를 진행해 주세요' }}</h1>
      <span>{{ message }}</span>
      <div class="amount"><small>결제 금액</small><strong>{{ formatKrw(payment.amount) }}</strong></div>
      <button v-if="!review && !terminal" :disabled="busy || !verified" @click="start">
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
