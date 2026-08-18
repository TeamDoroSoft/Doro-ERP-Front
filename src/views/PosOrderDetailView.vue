<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { cancelOrder, completeOrder, getOrder, type OrderResponse } from '@/api/order'
import OrderDetailPanel from '@/components/orders/OrderDetailPanel.vue'
import OrderPaymentPanel from '@/components/payments/OrderPaymentPanel.vue'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { readRecentPaymentId } from '@/payments/pendingPayment'

const route = useRoute()
const router = useRouter()
const order = ref<OrderResponse | null>(null)
const loading = ref(false)
const error = ref<ApiError | null>(null)
const operationError = ref('')
const recentPaymentId = ref<string | null>(null)
const cancelling = ref(false)
const completing = ref(false)

onMounted(loadOrder)
watch(
  () => route.params.orderId,
  () => loadOrder(),
)

function orderId(): string {
  return String(route.params.orderId)
}

async function loadOrder(clearOperationError = true, showLoading = true) {
  if (showLoading) loading.value = true
  error.value = null
  if (clearOperationError) operationError.value = ''
  try {
    order.value = await getOrder(orderId())
    recentPaymentId.value = readRecentPaymentId(order.value.orderId)
  } catch (caught) {
    error.value = queryError(caught)
  } finally {
    if (showLoading) loading.value = false
  }
}

function handlePaymentUpdated(paymentId: string, status: string, previousStatus: string) {
  recentPaymentId.value = paymentId
  if (
    status !== previousStatus &&
    (status === 'PAID' || (previousStatus === 'PAID' && status === 'CANCELLED'))
  ) {
    void loadOrder(false, false)
  }
}

async function cancel() {
  if (!order.value || !window.confirm('결제 전 주문을 취소할까요?')) return
  cancelling.value = true
  operationError.value = ''
  try {
    order.value = await cancelOrder(order.value.orderId)
  } catch (caught) {
    if (isConflict(caught)) await loadOrder(false)
    operationError.value = mutationMessage(caught, '주문을 취소하지 못했습니다.')
  } finally {
    cancelling.value = false
  }
}

async function complete() {
  if (!order.value) return
  completing.value = true
  operationError.value = ''
  try {
    order.value = await completeOrder(order.value.orderId)
  } catch (caught) {
    if (isConflict(caught)) await loadOrder(false)
    operationError.value = isConflict(caught)
      ? '준비 완료 상태가 아니거나 주문 상태가 바뀌었습니다. 최신 주문 정보를 다시 확인했습니다.'
      : mutationMessage(caught, '주문 완료를 처리하지 못했습니다.')
  } finally {
    completing.value = false
  }
}

function isConflict(caught: unknown) {
  return (
    caught instanceof ApiError &&
    (caught.status === 409 || caught.status === 422 || caught.code === 'INVALID_STATE')
  )
}

function mutationMessage(caught: unknown, fallback: string) {
  if (!(caught instanceof ApiError)) return fallback
  if (caught.status === 403) return '이 주문을 변경할 권한이 없습니다.'
  if (caught.status === 404)
    return '주문을 찾을 수 없습니다. 목록으로 돌아가 최신 주문을 확인해 주세요.'
  if (caught.status === 503) return '주문 서비스를 일시적으로 사용할 수 없습니다.'
  return fallback
}

function queryError(caught: unknown): ApiError {
  const requestId = caught instanceof ApiError ? caught.requestId : ''
  if (caught instanceof ApiError && caught.status === 403)
    return new ApiError(403, {
      code: caught.code,
      requestId,
      detail: '주문을 조회할 권한이 없습니다.',
    })
  if (caught instanceof ApiError && caught.status === 404)
    return new ApiError(404, { code: caught.code, requestId, detail: '주문을 찾을 수 없습니다.' })
  if (caught instanceof ApiError && caught.status === 503)
    return new ApiError(503, {
      code: caught.code,
      requestId,
      detail: '주문 서비스를 일시적으로 사용할 수 없습니다.',
    })
  return new ApiError(0, {
    code: 'NETWORK_ERROR',
    requestId,
    detail: '주문을 불러오지 못했습니다.',
  })
}
</script>

<template>
  <main class="detail-page">
    <button class="back" type="button" @click="router.push({ name: 'pos-orders' })">
      주문 목록
    </button>
    <LoadingState v-if="loading" />
    <ApiErrorNotice
      v-else-if="error"
      :message="error.message"
      :request-id="error.requestId"
      retryable
      @retry="loadOrder"
    />
    <template v-else-if="order">
      <ApiErrorNotice v-if="operationError" :message="operationError" />
      <OrderDetailPanel
        :order="order"
        :cancelling="cancelling"
        :completing="completing"
        @cancel="cancel"
        @complete="complete"
      />
      <OrderPaymentPanel
        :order="order"
        :recent-payment-id="recentPaymentId"
        @payment-updated="handlePaymentUpdated"
      />
    </template>
  </main>
</template>

<style scoped>
.detail-page {
  display: grid;
  gap: 1.25rem;
  width: 100%;
}
.back {
  justify-self: start;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
</style>
