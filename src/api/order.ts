import { apiRequestExact } from './http'
import type { Int64String } from './int64'

export type OrderChannel = 'POS' | 'KIOSK'
export type OrderServiceType = 'DINE_IN' | 'TAKEOUT'
export type OrderStatus = 'CREATED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'
export type OrderSourceType = 'KIOSK' | 'EMPLOYEE_POS'
export type OrderPaymentPolicy = 'PAY_NOW' | 'PAY_LATER'
export type OrderPaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'CANCELLED'

/** A request can contain at most 100 lines; each quantity must be between 1 and 999. */
export interface CreateOrderLineRequest {
  productId: string
  quantity: number
}

/** Prices, names, and totals are deliberately absent: Commerce calculates them from Catalog. */
export interface CreateOrderRequest {
  orderChannel: OrderChannel
  serviceType: OrderServiceType
  paymentPolicy: OrderPaymentPolicy
  tableId?: string | null
  lines: CreateOrderLineRequest[]
}

/**
 * Current Commerce `OrderView` wire contract. `orderAccessToken` is only populated for Kiosk
 * creation/replay and is null for employee POS responses.
 */
export interface OrderResponse {
  orderId: string
  displayNumber: number
  totalAmount: Int64String
  currency: string
  status: OrderStatus
  businessDate: string
  orderAccessToken: string | null
  sourceType: OrderSourceType
  sourceDeviceId: string | null
  sourceDeviceNameSnapshot: string | null
  paymentPolicy: OrderPaymentPolicy
  paymentStatus: OrderPaymentStatus
  tableId: string | null
}

export interface OrderListQuery {
  businessDate?: string
  status?: OrderStatus
}

export function createOrder(
  request: CreateOrderRequest,
  idempotencyKey: string,
): Promise<OrderResponse> {
  return exactOrderRequest<OrderResponse>('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(request),
  })
}

export function getOrders(query: OrderListQuery = {}): Promise<OrderResponse[]> {
  const search = new URLSearchParams()
  if (query.businessDate) search.set('businessDate', query.businessDate)
  if (query.status) search.set('status', query.status)
  const suffix = search.size === 0 ? '' : `?${search.toString()}`

  return exactOrderRequest<OrderResponse[]>(`/orders${suffix}`)
}

export function getOrder(orderId: string): Promise<OrderResponse> {
  return exactOrderRequest<OrderResponse>(`/orders/${encodeURIComponent(orderId)}`)
}

export function cancelOrder(orderId: string): Promise<OrderResponse> {
  return exactOrderRequest<OrderResponse>(`/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
  })
}

export function completeOrder(orderId: string): Promise<OrderResponse> {
  return exactOrderRequest<OrderResponse>(`/orders/${encodeURIComponent(orderId)}/complete`, {
    method: 'POST',
  })
}

function exactOrderRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequestExact<T>(path, options, { fields: ['totalAmount'] })
}
