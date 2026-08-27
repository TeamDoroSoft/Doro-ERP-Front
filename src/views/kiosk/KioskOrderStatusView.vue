<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKioskFlowStore } from '@/stores/kioskFlow'

const RESET_SECONDS = 60
const route = useRoute()
const router = useRouter()
const flow = useKioskFlowStore()
const remaining = ref(RESET_SECONDS)
const matchesCustomerOrder = computed(
  () => !!flow.order && flow.order.orderId === String(route.params.orderId ?? ''),
)
let countdown: number | undefined

onMounted(async () => {
  if (!matchesCustomerOrder.value) {
    await finish()
    return
  }
  countdown = window.setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) void finish()
  }, 1_000)
})
onUnmounted(() => clearInterval(countdown))

async function finish() {
  flow.resetCustomer()
  await router.replace('/kiosk/order')
}
</script>

<template>
  <section class="status-page">
    <div class="status-panel">
      <p class="eyebrow">주문이 접수되었습니다</p>
      <h1>주문번호 <strong>{{ matchesCustomerOrder ? flow.order?.displayNumber : '—' }}</strong></h1>
      <p>결제와 준비 상태는 직원에게 문의해 주세요.</p>
      <p class="countdown">{{ remaining }}초 후 다음 고객 화면으로 돌아갑니다.</p>
      <button class="new" @click="finish">새 주문 시작</button>
    </div>
  </section>
</template>

<style scoped>
.status-page { display: grid; min-height: calc(100dvh - 190px); place-items: center; }
.status-panel { display: grid; width: min(720px, 100%); place-items: center; gap: 16px; border: 1px solid #cfd6d1; border-radius: 7px; background: #fff; padding: clamp(28px, 6vw, 52px); text-align: center; }
.eyebrow { margin: 0; color: #087f5b; font-size: 14px; font-weight: 800; }
.status-panel h1 { margin: 0; font-size: 20px; font-weight: 600; }
.status-panel h1 strong { display: block; margin-top: 6px; font-size: clamp(52px, 10vw, 82px); line-height: 1; letter-spacing: -3px; }
.status-panel > p:not(.eyebrow, .countdown) { color: #687078; }
.countdown { margin: 0; color: #687078; font-size: 13px; }
.new { width: 100%; min-height: 56px; border: 1px solid #087f5b; border-radius: 4px; background: #087f5b; color: #fff; font-weight: 800; }
</style>
