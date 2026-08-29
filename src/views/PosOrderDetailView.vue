<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import { cancelOrder, completeOrder, getOrder, type OrderResponse } from '@/api/order'
import { cancelPaymentHandoff, recoverPaymentHandoffByOrder } from '@/api/paymentHandoff'
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
class PaidHandoffConflict extends Error {}

onMounted(loadOrder)
watch(
  () => route.params.orderId,
  () => loadOrder(),
)

function orderId(): string {
  return String(route.params.orderId)
}

async function loadOrder(clearOperationError = true, showLoading = true) {
  // `showLoading`은 이 호출이 Foreground 재조회인지 나타낸다: 최초 mount, orderId Route 변경,
  // 사용자의 명시적 재시도. Foreground에서만 이전 주문을 비워서, 다른 주문으로 이동하는 중에
  // 이전 주문의 취소·완료 Button을 누를 수 없게 한다.
  // 결제 상태 변경 후의 Background 동기화는 `false`를 넘겨 `loading`을 건드리지 않는다. 건드리면
  // 아래 `v-else-if="order"` 분기가 OrderPaymentPanel을 unmount하고, 다시 mount되면서 최초 결제
  // 조회가 다시 실행되어 `payment-updated`를 재발행하고 loadOrder를 또 호출하는 무한 Loop가 된다.
  if (showLoading) {
    order.value = null
    loading.value = true
  }
  error.value = null
  if (clearOperationError) operationError.value = ''
  try {
    const fetched = await getOrder(orderId())
    order.value = fetched
    recentPaymentId.value = readRecentPaymentId(fetched.orderId)
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
    try {
      const handoff = await recoverPaymentHandoffByOrder(order.value.orderId)
      if (handoff.status === 'PAID') {
        throw new PaidHandoffConflict()
      }
      if (['QUEUED', 'DISPLAYED', 'PROCESSING'].includes(handoff.status)) {
        await cancelPaymentHandoff(handoff.id, handoff.version)
      }
    } catch (caught) {
      // A missing handoff is a valid order-only cancellation. Conflicts and dependency failures
      // are not: cancelling the Order while a reusable payment handoff remains would split truth.
      if (!(caught instanceof ApiError && caught.status === 404)) throw caught
    }
    order.value = await cancelOrder(order.value.orderId)
  } catch (caught) {
    if (caught instanceof PaidHandoffConflict) {
      await loadOrder(false, false)
      operationError.value = '결제가 이미 완료된 주문은 취소할 수 없습니다. 결제 상태를 다시 확인해 주세요.'
      return
    }
    if (isConflict(caught)) await loadOrder(false, false)
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
    if (isConflict(caught)) await loadOrder(false, false)
    operationError.value = completionMessage(caught)
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

function completionMessage(caught: unknown) {
  if (caught instanceof ApiError && caught.code === 'INVALID_STATE')
    return '조리 현황에서 먼저 ‘준비 완료’를 처리해 주세요. 최신 주문 정보를 다시 확인했습니다.'
  if (caught instanceof ApiError && caught.code === 'DEPENDENCY_UNAVAILABLE')
    return '조리 준비 상태를 확인할 수 없어 주문을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  if (isConflict(caught))
    return '준비 완료 상태가 아니거나 주문 상태가 바뀌었습니다. 최신 주문 정보를 다시 확인했습니다.'
  return mutationMessage(caught, '주문 완료를 처리하지 못했습니다.')
}

// Commerce order errors are `400 VALIDATION_FAILED`, `403 FORBIDDEN`, `404 ORDER_NOT_FOUND`,
// `409 IDP_CONFLICT | INVALID_STATE` and `503 DEPENDENCY_UNAVAILABLE`; Edge adds `401
// UNAUTHENTICATED | SESSION_ABSOLUTE_EXPIRED` and `503 ORDER_UNAVAILABLE`.
function mutationMessage(caught: unknown, fallback: string) {
  if (!(caught instanceof ApiError)) return fallback
  if (caught.status === 403) return '이 주문을 변경할 권한이 없습니다.'
  if (caught.status === 404)
    return '주문을 찾을 수 없습니다. 목록으로 돌아가 최신 주문을 확인해 주세요.'
  if (caught.status === 503) return '주문을 지금 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  if (caught.status === 400 || caught.code === 'VALIDATION_FAILED')
    return '주문 요청을 확인해 주세요.'
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
      detail: '주문을 지금 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.',
    })
  // See `PosOrdersView.queryError`: preserve the real status/code, replace only the message.
  if (caught instanceof ApiError && caught.status !== 0)
    return new ApiError(caught.status, {
      status: caught.status,
      code: caught.code,
      requestId,
      detail: safeApiErrorMessage(caught, '주문을 불러오지 못했습니다.'),
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
    <header class="detail-header"><button class="back" type="button" @click="router.push({ name: 'pos-orders' })">주문 목록</button><span>운영 / 주문 상세</span></header>
    <LoadingState v-if="loading" />
    <ApiErrorNotice
      v-else-if="error"
      :message="safeApiErrorMessage(error)"
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
.detail-header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dedfe3;padding-bottom:12px}.detail-header span{color:#6b7280;font-size:10px;font-weight:700;letter-spacing:.08em}
</style>
