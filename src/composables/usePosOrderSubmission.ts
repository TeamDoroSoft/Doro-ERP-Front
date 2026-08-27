import { ref } from 'vue'
import { ApiError } from '@/api/http'
import { createOrder, type CreateOrderRequest, type OrderResponse } from '@/api/order'
import {
  createPayment,
  createPaymentIdempotencyKey,
  getPaymentByOrder,
  type PaymentView,
} from '@/api/payment'
import { createPaymentHandoff, type PaymentHandoff } from '@/api/paymentHandoff'
import {
  addOrderToTableSession,
  getTableSession,
  openTableSession,
  type TableSession,
} from '@/api/tableSessions'

export type PayNowTarget = 'DIRECT' | 'PAYMENT_KIOSK'

export interface PosOrderSubmissionApi {
  createOrder(request: CreateOrderRequest, key: string): Promise<OrderResponse>
  createPayment(orderId: string, key: string): Promise<PaymentView>
  getPaymentByOrder(orderId: string): Promise<PaymentView>
  createPaymentHandoff(paymentId: string, deviceId: string, key: string): Promise<PaymentHandoff>
  openTableSession(tableId: string): Promise<TableSession>
  addOrderToTableSession(sessionId: string, orderId: string): Promise<TableSession>
  getTableSession(sessionId: string): Promise<TableSession>
}

export interface SubmitPosOrderOptions {
  request: CreateOrderRequest
  orderIdempotencyKey: string
  payNowTarget: PayNowTarget
  targetPaymentDeviceId?: string
}

export interface PosOrderSubmissionResult {
  order: OrderResponse
  payment: PaymentView | null
  handoff: PaymentHandoff | null
  tableSession: TableSession | null
}

/**
 * Coordinates the employee workflow while keeping every retry on the same operation keys.
 * No client amount is sent to Payment or Table Session checkout.
 */
export function usePosOrderSubmission(
  api: PosOrderSubmissionApi = defaultApi,
  createKey: () => string = createPaymentIdempotencyKey,
) {
  const submitting = ref(false)
  const result = ref<PosOrderSubmissionResult | null>(null)
  const operationOrderKey = ref('')
  const paymentIdempotencyKey = ref('')
  const handoffIdempotencyKey = ref('')

  async function submit(options: SubmitPosOrderOptions): Promise<PosOrderSubmissionResult | null> {
    if (submitting.value) return null
    submitting.value = true
    try {
      const { request, orderIdempotencyKey } = options
      ensureOperationKeys(orderIdempotencyKey)
      const tableSession =
        request.paymentPolicy === 'PAY_LATER'
          ? await api.openTableSession(required(request.tableId, 'tableId'))
          : null
      const order = await api.createOrder(request, orderIdempotencyKey)

      if (tableSession) {
        const attached = await attachOrRecover(tableSession.sessionId, order.orderId)
        return setResult({ order, payment: null, handoff: null, tableSession: attached })
      }

      if (options.payNowTarget === 'PAYMENT_KIOSK') {
        const deviceId = required(options.targetPaymentDeviceId, 'targetPaymentDeviceId')
        const payment = await createOrRecoverPayment(order, paymentIdempotencyKey.value)
        const handoff = await api.createPaymentHandoff(
          payment.id,
          deviceId,
          handoffIdempotencyKey.value,
        )
        return setResult({ order, payment, handoff, tableSession: null })
      }

      return setResult({ order, payment: null, handoff: null, tableSession: null })
    } finally {
      submitting.value = false
    }
  }

  async function createOrRecoverPayment(order: OrderResponse, key: string) {
    try {
      return await api.createPayment(order.orderId, key)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error
      const recovered = await api.getPaymentByOrder(order.orderId)
      if (recovered.orderId !== order.orderId || recovered.amount !== order.totalAmount) throw error
      return recovered
    }
  }

  async function attachOrRecover(sessionId: string, orderId: string) {
    try {
      return await api.addOrderToTableSession(sessionId, orderId)
    } catch (error) {
      const recovered = await api.getTableSession(sessionId)
      if (!recovered.orders.some((order) => order.orderId === orderId)) throw error
      return recovered
    }
  }

  function setResult(next: PosOrderSubmissionResult) {
    result.value = next
    return next
  }

  function ensureOperationKeys(orderKey: string) {
    if (operationOrderKey.value === orderKey) return
    operationOrderKey.value = orderKey
    paymentIdempotencyKey.value = createKey()
    handoffIdempotencyKey.value = createKey()
  }

  return { submitting, result, paymentIdempotencyKey, handoffIdempotencyKey, submit }
}

function required(value: string | null | undefined, field: string): string {
  if (!value) throw new Error(`${field} is required`)
  return value
}

const defaultApi: PosOrderSubmissionApi = {
  createOrder,
  createPayment,
  getPaymentByOrder,
  createPaymentHandoff,
  openTableSession,
  addOrderToTableSession,
  getTableSession,
}
