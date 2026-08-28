<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import { getOrders, type OrderResponse, type OrderStatus } from '@/api/order'
import OrderListPanel from '@/components/orders/OrderListPanel.vue'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useCurrentBusinessDate } from '@/composables/useCurrentBusinessDate'

const router = useRouter()
const orders = ref<OrderResponse[]>([])
const loading = ref(false)
const error = ref<ApiError | null>(null)
const { businessDate, loadingBusinessDate, businessDateError, resolveBusinessDate } =
  useCurrentBusinessDate()
const status = ref<OrderStatus | ''>('')
const source = ref('')
let loadSequence = 0
const kioskSources = computed(() =>
  Array.from(
    new Set(
      orders.value
        .filter((order) => order.sourceType === 'KIOSK' && order.sourceDeviceNameSnapshot)
        .map((order) => order.sourceDeviceNameSnapshot as string),
    ),
  ).sort((a, b) => a.localeCompare(b, 'ko')),
)
const visibleOrders = computed(() => {
  if (!source.value) return orders.value
  if (source.value === 'EMPLOYEE_POS')
    return orders.value.filter((order) => order.sourceType === 'EMPLOYEE_POS')
  if (source.value === 'KIOSK') return orders.value.filter((order) => order.sourceType === 'KIOSK')
  if (source.value === 'UNKNOWN') return orders.value.filter((order) => !order.sourceType)
  return orders.value.filter(
    (order) =>
      order.sourceType === 'KIOSK' && order.sourceDeviceNameSnapshot === source.value.slice(6),
  )
})

watch([businessDate, status], () => {
  if (businessDate.value) businessDateError.value = ''
  void loadOrders()
}, { immediate: true })
onMounted(resolveBusinessDate)

async function loadOrders() {
  if (!businessDate.value) {
    loadSequence += 1
    orders.value = []
    error.value = null
    loading.value = false
    return
  }
  const sequence = ++loadSequence
  const requestedDate = businessDate.value
  const requestedStatus = status.value
  loading.value = true
  error.value = null
  try {
    const response = await getOrders({
      businessDate: requestedDate,
      status: requestedStatus || undefined,
    })
    if (sequence === loadSequence && requestedDate === businessDate.value && requestedStatus === status.value)
      orders.value = response
  } catch (caught) {
    if (sequence === loadSequence) error.value = queryError(caught)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function retry() {
  if (businessDate.value) await loadOrders()
  else await resolveBusinessDate()
}

function queryError(caught: unknown): ApiError {
  const requestId = caught instanceof ApiError ? caught.requestId : ''
  if (caught instanceof ApiError && caught.status === 403)
    return new ApiError(403, {
      code: caught.code,
      requestId,
      detail: '주문 목록을 조회할 권한이 없습니다.',
    })
  if (caught instanceof ApiError && caught.status === 503)
    return new ApiError(503, {
      code: caught.code,
      requestId,
      detail: '주문 목록을 지금 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.',
    })
  if (caught instanceof ApiError && caught.status === 404)
    return new ApiError(404, {
      code: caught.code,
      requestId,
      detail: '주문 목록을 불러올 수 없습니다.',
    })
  // Anything else keeps its real Edge/Commerce status and `code` (400 VALIDATION_FAILED, 409
  // INVALID_STATE, 401 ...) so the notice is accurate and the request id stays traceable; only
  // the message is replaced with a safe one, because Problem Detail `detail` may carry
  // upstream information.
  if (caught instanceof ApiError && caught.status !== 0)
    return new ApiError(caught.status, {
      status: caught.status,
      code: caught.code,
      requestId,
      detail: safeApiErrorMessage(caught, '주문 목록을 불러오지 못했습니다.'),
    })
  return new ApiError(0, {
    code: 'NETWORK_ERROR',
    requestId,
    detail: '주문 목록을 불러오지 못했습니다.',
  })
}

function openOrder(orderId: string) {
  void router.push({ name: 'pos-orders-detail', params: { orderId } })
}
</script>

<template>
  <main class="orders-page">
    <header class="orders-topbar">
      <div class="title-block"><p>주문 관리</p><h1>주문</h1><span>매장 주문을 확인하고 처리합니다.</span></div>
      <div class="top-actions"><button type="button" class="quiet-action" :disabled="loading || loadingBusinessDate" @click="retry">새로고침</button><button class="primary order-create-action" type="button" @click="router.push({ name: 'pos-orders-new' })">주문 등록</button></div>
    </header>
    <section class="order-navigation" aria-label="주문 보기 설정">
      <div class="status-tabs" role="tablist" aria-label="주문 상태 빠른 필터">
        <button :class="{ active: status === '' }" type="button" @click="status = ''">모든 주문</button>
        <button :class="{ active: status === 'CREATED' }" type="button" @click="status = 'CREATED'">결제 대기</button>
        <button :class="{ active: status === 'ACCEPTED' }" type="button" @click="status = 'ACCEPTED'">주문 확정</button>
        <button :class="{ active: status === 'COMPLETED' }" type="button" @click="status = 'COMPLETED'">주문 완료</button>
      </div>
      <div class="filter-actions"><label><span>영업일</span><input v-model="businessDate" type="date" name="businessDate" :disabled="loadingBusinessDate" /></label><label><span>상태</span><select v-model="status" name="status"><option value="">전체</option><option value="CREATED">결제 대기</option><option value="ACCEPTED">주문 확정</option><option value="COMPLETED">주문 완료</option><option value="CANCELLED">취소</option></select></label><label><span>주문 생성</span><select v-model="source" name="source"><option value="">전체</option><option value="EMPLOYEE_POS">직원 POS</option><option value="KIOSK">모든 Kiosk</option><option v-for="name in kioskSources" :key="name" :value="`KIOSK:${name}`">{{ name }}</option><option value="UNKNOWN">출처 정보 없음</option></select></label></div>
    </section>
    <section class="orders-list-area" aria-label="주문 목록">
      <div class="list-caption"><strong>주문 목록</strong><span v-if="!loading">{{ orders.length }}건</span><span v-else>불러오는 중</span></div>
      <LoadingState v-if="loading || loadingBusinessDate" />
      <ApiErrorNotice v-if="businessDateError" :message="businessDateError" retryable @retry="resolveBusinessDate" />
      <ApiErrorNotice v-if="!loading && !loadingBusinessDate && error" :message="safeApiErrorMessage(error)" :request-id="error.requestId" retryable @retry="loadOrders" />
      <EmptyState v-if="!loading && !loadingBusinessDate && !error && visibleOrders.length === 0" title="주문이 없습니다" description="선택한 조건에 해당하는 주문이 없습니다." />
      <OrderListPanel v-if="!loading && !loadingBusinessDate && !error && visibleOrders.length > 0" :orders="visibleOrders" @select="openOrder" />
    </section>
  </main>
</template>

<style scoped>
.orders-page{display:grid;gap:0;width:100%;background:transparent;border:0;overflow:visible;box-shadow:none}.orders-topbar{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:0 0 16px;border-bottom:0;background:transparent}.title-block p{margin:0 0 4px;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:.08em}.title-block h1{margin:0;color:#202124;font-size:20px;letter-spacing:-.025em}.title-block span{display:block;margin-top:4px;color:#6b7280;font-size:12px}.top-actions{display:flex;gap:8px}.quiet-action,.order-create-action{min-height:32px;border-radius:3px;padding:0 11px;font-size:12px;font-weight:650}.quiet-action{border:1px solid #d5d7dc;background:#fff;color:#394150}.order-create-action{border:1px solid #009b6b;background:#009b6b;color:#fff;box-shadow:none}.order-navigation{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 14px;border:1px solid #dedfe3;border-bottom:0;background:#fff}.status-tabs{display:flex;gap:24px;align-self:stretch}.status-tabs button{position:relative;min-height:38px;border:0;background:transparent;padding:0;color:#6c707a;font-size:12px;font-weight:600}.status-tabs button.active{color:#007f5b;font-weight:750}.status-tabs button.active::after{position:absolute;right:0;bottom:0;left:0;height:2px;background:#00a878;content:''}.filter-actions{display:flex;gap:7px}.filter-actions label{display:flex;align-items:center;gap:5px;color:#7a7d86;font-size:10px;font-weight:600}.filter-actions input,.filter-actions select{height:28px;border:1px solid #d8dade;border-radius:3px;background:#fff;padding:0 7px;color:#343740;font-size:11px}.orders-list-area{min-height:430px;padding:0;border:1px solid #dedfe3;background:#fff}.list-caption{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e9eaed;color:#6e737e;font-size:11px}.list-caption strong{color:#2b2e35;font-size:12px}.orders-list-area :deep(.order-table-wrap){border:0;border-radius:0}.orders-list-area :deep(.api-error){margin:0}@media(max-width:760px){.orders-topbar,.order-navigation{align-items:stretch;flex-direction:column}.order-navigation{padding:0 14px}.status-tabs{overflow:auto}.filter-actions{padding-bottom:10px}.top-actions{justify-content:flex-end}}
</style>
