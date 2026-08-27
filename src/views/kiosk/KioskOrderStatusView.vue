<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getKioskOrder, type KioskOrderStatus } from '@/api/kiosk'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import { useKioskSessionStore } from '@/stores/kioskSession'
const RESET_SECONDS = 60,
  route = useRoute(),
  router = useRouter(),
  flow = useKioskFlowStore(),
  device = useKioskSessionStore(),
  order = ref<KioskOrderStatus | null>(null),
  error = ref(false),
  remaining = ref(RESET_SECONDS),
  orderId = computed(() => String(route.params.orderId ?? ''))
let poll: number | undefined, countdown: number | undefined
onMounted(async () => {
  await load()
  poll = window.setInterval(load, 5000)
  countdown = window.setInterval(() => {
    remaining.value--
    if (remaining.value <= 0) void finish()
  }, 1000)
})
onUnmounted(() => {
  clearInterval(poll)
  clearInterval(countdown)
})
async function load() {
  if (flow.order?.orderId !== orderId.value || !flow.accessToken) {
    if (flow.order || flow.payment) flow.resetCustomer()
    error.value = true
    return
  }
  try {
    order.value = await getKioskOrder(orderId.value, flow.accessToken)
    error.value = false
  } catch {
    error.value = true
  }
}
async function finish() {
  flow.resetCustomer()
  await router.replace('/kiosk')
}
const labels: Record<string, string> = {
  CREATED: '결제 대기',
  ACCEPTED: '주문 확정',
  COMPLETED: '주문 완료',
  CANCELLED: '취소',
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
  REVIEW_REQUIRED: '결제 확인 필요',
  PREPARING: '조리 중',
  READY: '준비 완료',
  '': '반영 중',
}
</script>
<template>
  <section class="status-page">
    <div class="status-panel">
      <p class="eyebrow">주문이 접수되었습니다</p>
      <h1>주문번호 <strong>{{ order?.displayNumber ?? flow.order?.displayNumber ?? '—' }}</strong></h1>
      <div v-if="order" class="steps">
        <span
          >주문<b>{{ labels[order.status] }}</b></span
        ><span
          >결제<b>{{ labels[order.paymentStatus] }}</b></span
        ><span
          >준비<b>{{ labels[order.fulfillmentStatus] }}</b></span
        >
      </div>
      <p v-if="error">현재 상태를 불러오지 못했습니다.</p>
      <p class="countdown">{{ remaining }}초 후 다음 고객 화면으로 돌아갑니다.</p>
      <div class="actions"><button class="refresh" @click="load">상태 새로고침</button><button class="new" @click="finish">새 주문 시작</button></div>
      <em>{{ device.deviceState === 'ACTIVE' ? '주문 화면이 연결되어 있습니다.' : '직원에게 기기 연결 상태를 확인해 주세요.' }}</em>
    </div>
  </section>
</template>
<style scoped>
.status-page { display: grid; min-height: calc(100dvh - 190px); place-items: center; }.status-panel { display: grid; width: min(720px, 100%); place-items: center; gap: 16px; border: 1px solid #cfd6d1; border-radius: 7px; background: #fff; padding: clamp(28px, 6vw, 52px); text-align: center; }.eyebrow { margin: 0; color: #087f5b; font-size: 14px; font-weight: 800; }.status-panel h1 { margin: 0; font-size: 20px; font-weight: 600; }.status-panel h1 strong { display: block; margin-top: 6px; font-size: clamp(52px, 10vw, 82px); line-height: 1; letter-spacing: -3px; }
.steps {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, 1fr);
  gap: 0; border: 1px solid #dce1de; border-radius: 5px; overflow: hidden;
}
.steps span {
  display: grid; gap: 5px; background: #fff; padding: 17px; border-right: 1px solid #e5e9e6;
}
.steps span:last-child { border-right: 0; }.steps b { color: #087f5b; }.countdown { margin: 0; color: #687078; font-size: 13px; }.actions { display: grid; width: 100%; grid-template-columns: 1fr 1fr; gap: 10px; }.refresh, .new { min-height: 56px; border-radius: 4px; font-weight: 800; }.refresh { border: 1px solid #d0d7d2; background: #fff; }.new { border: 1px solid #087f5b; background: #087f5b; color: #fff; }.status-panel em { font-size: 11px; color: #8b9690; }
@media (max-width: 550px) {
  .steps { grid-template-columns: 1fr; }.steps span { border-right: 0; border-bottom: 1px solid #e5e9e6; }.steps span:last-child { border-bottom: 0; }.actions { grid-template-columns: 1fr; }
}
</style>
