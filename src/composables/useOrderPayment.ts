import { computed, onScopeDispose, ref, watch, type MaybeRefOrGetter, toValue } from 'vue'
import {
  cancelPayment as requestCancellation,
  createPayment as requestPayment,
  createPaymentIdempotencyKey,
  getPayment as requestPaymentStatus,
  paymentProblemMessage,
  type PaymentResponse,
} from '@/api/payment'
import type { OrderResponse } from '@/api/order'
import { isPositiveInt64 } from '@/api/int64'

const DEFAULT_POLL_INTERVAL_MS = 3_000
const DEFAULT_MAX_POLL_ATTEMPTS = 5

export interface OrderPaymentApi {
  createPayment(orderId: string, idempotencyKey: string): Promise<PaymentResponse>
  getPayment(paymentId: string): Promise<PaymentResponse>
  cancelPayment(
    paymentId: string,
    reasonCode: 'CUSTOMER_REQUEST',
    idempotencyKey: string,
  ): Promise<PaymentResponse>
}

export interface UseOrderPaymentOptions {
  api?: OrderPaymentApi
  recentPaymentId?: MaybeRefOrGetter<string | null | undefined>
  createKey?: () => string
  pollIntervalMs?: number
  maxPollAttempts?: number
}

/**
 * Keeps payment operation keys stable across retries and owns only payment state.
 * The order is intentionally not updated after cancellation because Commerce can lag payment events.
 */
export function useOrderPayment(
  order: MaybeRefOrGetter<OrderResponse>,
  options: UseOrderPaymentOptions = {},
) {
  const api = options.api ?? defaultApi
  const createKey = options.createKey ?? createPaymentIdempotencyKey
  const payment = ref<PaymentResponse | null>(null)
  const loading = ref(false)
  const cancelling = ref(false)
  const errorMessage = ref('')
  const cancellationNotice = ref('')
  const polling = ref(false)
  const createIdempotencyKey = ref<string | null>(null)
  const cancelIdempotencyKey = ref<string | null>(null)
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let pollAttempts = 0

  const canCreate = computed(() => toValue(order).status === 'CREATED' && !payment.value)
  const canCancel = computed(() => payment.value?.status === 'PAID')
  const isBusy = computed(() => loading.value || cancelling.value)

  watch(
    () => toValue(options.recentPaymentId),
    (paymentId) => {
      if (paymentId && paymentId !== payment.value?.id) {
        void refresh(paymentId)
      }
    },
    { immediate: true },
  )

  async function create(): Promise<PaymentResponse | null> {
    if (!canCreate.value || isBusy.value) return payment.value
    createIdempotencyKey.value ??= createKey()
    loading.value = true
    errorMessage.value = ''
    cancellationNotice.value = ''
    try {
      const created = await api.createPayment(toValue(order).orderId, createIdempotencyKey.value)
      if (!isMatchingPendingPayment(created, toValue(order))) {
        throw new Error('PAYMENT_CONTRACT_ERROR')
      }
      payment.value = created
      return created
    } catch (error) {
      errorMessage.value = userMessage(error)
      return null
    } finally {
      loading.value = false
    }
  }

  async function refresh(
    paymentId = payment.value?.id,
    beginPollingAfterRefresh = true,
  ): Promise<PaymentResponse | null> {
    if (!paymentId || isBusy.value) return payment.value
    loading.value = true
    errorMessage.value = ''
    try {
      const latest = await api.getPayment(paymentId)
      if (!isMatchingPayment(latest, toValue(order), paymentId)) {
        throw new Error('PAYMENT_CONTRACT_ERROR')
      }
      payment.value = latest
      if (beginPollingAfterRefresh && shouldPoll(latest.status) && !polling.value) {
        startPolling()
      }
      return latest
    } catch (error) {
      errorMessage.value = userMessage(error)
      return null
    } finally {
      loading.value = false
    }
  }

  async function cancel(): Promise<PaymentResponse | null> {
    if (!payment.value || !canCancel.value || isBusy.value) return null
    cancelIdempotencyKey.value ??= createKey()
    cancelling.value = true
    errorMessage.value = ''
    cancellationNotice.value = ''
    try {
      const cancelled = await api.cancelPayment(
        payment.value.id,
        'CUSTOMER_REQUEST',
        cancelIdempotencyKey.value,
      )
      if (
        !isMatchingPayment(cancelled, toValue(order), payment.value.id) ||
        !['CANCELLED', 'REVIEW_REQUIRED'].includes(cancelled.status)
      ) {
        throw new Error('PAYMENT_CONTRACT_ERROR')
      }
      payment.value = cancelled
      cancellationNotice.value =
        cancelled.status === 'REVIEW_REQUIRED'
          ? '결제 취소 결과를 확인해야 합니다. 성공이나 실패로 판단하지 말고 상태를 다시 확인하세요.'
          : '결제 취소 요청이 처리되었습니다. 주문 상태 반영에는 잠시 시간이 걸릴 수 있으니 새로고침해 확인하세요.'
      if (cancelled.status === 'REVIEW_REQUIRED') startPolling()
      return cancelled
    } catch (error) {
      errorMessage.value = userMessage(error)
      return null
    } finally {
      cancelling.value = false
    }
  }

  function startPolling(): void {
    stopPolling()
    if (!payment.value || !shouldPoll(payment.value.status)) return
    polling.value = true
    pollAttempts = 0
    schedulePoll()
  }

  function stopPolling(): void {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = undefined
    polling.value = false
  }

  function schedulePoll(): void {
    const interval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    pollTimer = setTimeout(async () => {
      pollAttempts += 1
      const latest = await refresh(undefined, false)
      if (
        latest &&
        shouldPoll(latest.status) &&
        pollAttempts < (options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS)
      ) {
        schedulePoll()
      } else {
        polling.value = false
      }
    }, interval)
  }

  onScopeDispose(stopPolling)

  return {
    payment,
    loading,
    cancelling,
    errorMessage,
    cancellationNotice,
    polling,
    createIdempotencyKey,
    cancelIdempotencyKey,
    canCreate,
    canCancel,
    isBusy,
    create,
    refresh,
    cancel,
    startPolling,
    stopPolling,
  }
}

const defaultApi: OrderPaymentApi = {
  createPayment: requestPayment,
  getPayment: requestPaymentStatus,
  cancelPayment: requestCancellation,
}

function isMatchingPendingPayment(payment: PaymentResponse, order: OrderResponse): boolean {
  return (
    isMatchingPayment(payment, order, payment.id) &&
    payment.status === 'PENDING' &&
    /^[A-Za-z0-9_-]{6,64}$/.test(payment.providerOrderId)
  )
}

function isMatchingPayment(
  payment: PaymentResponse,
  order: OrderResponse,
  expectedPaymentId: string,
): boolean {
  return (
    payment.id.length > 0 &&
    payment.id === expectedPaymentId &&
    payment.orderId === order.orderId &&
    isPositiveInt64(payment.amount) &&
    payment.currency === order.currency &&
    ['PENDING', 'PAID', 'FAILED', 'REVIEW_REQUIRED', 'CANCELLED'].includes(payment.status)
  )
}

function shouldPoll(status: string): boolean {
  return status === 'PENDING' || status === 'REVIEW_REQUIRED'
}

function userMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'PAYMENT_CONTRACT_ERROR') {
    return '서버 결제 정보가 주문 또는 결제 요청 조건과 일치하지 않습니다.'
  }
  return paymentProblemMessage(error)
}
