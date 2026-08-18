<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import { getOrders, type OrderResponse, type OrderStatus } from '@/api/order'
import OrderListPanel from '@/components/orders/OrderListPanel.vue'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'

const router = useRouter()
const orders = ref<OrderResponse[]>([])
const loading = ref(false)
const error = ref<ApiError | null>(null)
const businessDate = ref('')
const status = ref<OrderStatus | ''>('')

onMounted(loadOrders)
watch([businessDate, status], loadOrders)

async function loadOrders() {
  loading.value = true
  error.value = null
  try {
    orders.value = await getOrders({
      businessDate: businessDate.value || undefined,
      status: status.value || undefined,
    })
  } catch (caught) {
    error.value = queryError(caught)
  } finally {
    loading.value = false
  }
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
      detail: '주문 조회 서비스를 일시적으로 사용할 수 없습니다.',
    })
  if (caught instanceof ApiError && caught.status === 404)
    return new ApiError(404, {
      code: caught.code,
      requestId,
      detail: '주문 목록을 불러올 수 없습니다.',
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
    <PageHeader
      eyebrow="POS 주문"
      title="주문 목록"
      description="서버 영업일과 주문 상태로 조회합니다."
    >
      <template #actions
        ><button class="primary" type="button" @click="router.push({ name: 'pos-orders-new' })">
          새 주문
        </button></template
      >
    </PageHeader>
    <section class="filters" aria-label="주문 필터">
      <label>영업일 <input v-model="businessDate" type="date" name="businessDate" /></label>
      <label
        >주문 상태
        <select v-model="status" name="status">
          <option value="">전체 상태</option>
          <option value="CREATED">주문 생성</option>
          <option value="ACCEPTED">주문 접수</option>
          <option value="COMPLETED">처리 완료</option>
          <option value="CANCELLED">취소</option>
        </select></label
      >
      <button type="button" :disabled="loading" @click="loadOrders">새로고침</button>
    </section>
    <LoadingState v-if="loading" />
    <ApiErrorNotice
      v-else-if="error"
      :message="safeApiErrorMessage(error)"
      :request-id="error.requestId"
      retryable
      @retry="loadOrders"
    />
    <EmptyState
      v-else-if="orders.length === 0"
      title="주문이 없습니다"
      description="선택한 영업일과 상태에 해당하는 주문이 없습니다."
    />
    <OrderListPanel v-else :orders="orders" @select="openOrder" />
  </main>
</template>

<style scoped>
.orders-page {
  width: 100%;
}
.filters {
  display: flex;
  align-items: end;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}
.filters label {
  display: grid;
  gap: 0.35rem;
  color: var(--color-muted);
  font-size: 0.875rem;
}
.filters input,
.filters select,
.filters button,
.primary {
  min-height: 2.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: white;
  padding: 0.4rem 0.65rem;
  font: inherit;
}
.primary {
  border: 0;
  background: var(--color-primary);
  color: white;
  font-weight: 700;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
