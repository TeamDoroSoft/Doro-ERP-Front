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
  if (!flow.approving)
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
  CREATED: '주문 생성',
  ACCEPTED: '주문 접수',
  COMPLETED: '처리 완료',
  CANCELLED: '주문 취소',
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
  <section class="status">
    <div>
      <p>주문이 접수되었습니다</p>
      <h1>주문번호</h1>
      <strong>{{ order?.displayNumber ?? flow.order?.displayNumber ?? '—' }}</strong>
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
      <button class="refresh" @click="load">수동 새로고침</button
      ><small>{{ remaining }}초 후 다음 고객 화면으로 돌아갑니다.</small
      ><button class="new" @click="finish">새 고객 시작</button
      ><em>기기 인증 상태: {{ device.deviceState }}</em>
    </div>
  </section>
</template>
<style scoped>
.status {
  display: grid;
  min-height: calc(100dvh - 190px);
  place-items: center;
}
.status > div {
  display: grid;
  width: min(760px, 100%);
  place-items: center;
  gap: 14px;
  border-radius: 36px;
  background: #fff;
  padding: 55px;
  text-align: center;
}
.status p {
  color: #126a5a;
  font-weight: 900;
}
.status > div > strong {
  font-size: 100px;
  line-height: 1;
}
.steps {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.steps span {
  display: grid;
  gap: 5px;
  border-radius: 18px;
  background: #f1f3ee;
  padding: 18px;
}
.refresh,
.new {
  width: 100%;
  min-height: 58px;
  border: 0;
  border-radius: 18px;
  font-weight: 900;
}
.refresh {
  background: #e8eee9;
}
.new {
  background: #17211d;
  color: #fff;
}
.status small {
  color: #68766f;
}
.status em {
  font-size: 11px;
  color: #8b9690;
}
@media (max-width: 550px) {
  .steps {
    grid-template-columns: 1fr;
  }
}
</style>
