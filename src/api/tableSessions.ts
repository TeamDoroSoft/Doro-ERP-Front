import { apiRequestExact } from './http'
import type { Int64String } from './int64'
import type { OrderPaymentStatus } from './order'
import type { PaymentHandoffStatus } from './paymentHandoff'

export type TableSessionStatus = 'OPEN' | 'CHECKOUT_PENDING' | 'CLOSED'

export interface TableSessionOrder {
  orderId: string
  displayNumber: number
  amount: Int64String
  paymentStatus: OrderPaymentStatus
}

export interface TableSession {
  sessionId: string
  tableId: string
  businessDate: string
  status: TableSessionStatus
  version: Int64String
  openedAt: string
  closedAt: string | null
  orders: TableSessionOrder[]
  unpaidTotal: Int64String
}

export interface TableSessionCheckoutHandoff {
  handoffId: string
  paymentId: string
  displayCode: string
  targetPaymentDeviceId: string
  targetPaymentDeviceName: string
  status: PaymentHandoffStatus
  expiresAt: string
  version: Int64String
}

const TABLE_SESSION_INT64 = { fields: ['version', 'amount', 'unpaidTotal'] } as const

export function openTableSession(tableId: string): Promise<TableSession> {
  return apiRequestExact<TableSession>(
    '/table-sessions',
    { method: 'POST', body: JSON.stringify({ tableId }) },
    TABLE_SESSION_INT64,
  )
}

export function getTableSession(id: string): Promise<TableSession> {
  return apiRequestExact<TableSession>(
    `/table-sessions/${encodeURIComponent(id)}`,
    {},
    TABLE_SESSION_INT64,
  )
}

export function addOrderToTableSession(id: string, orderId: string): Promise<TableSession> {
  return apiRequestExact<TableSession>(
    `/table-sessions/${encodeURIComponent(id)}/orders`,
    { method: 'POST', body: JSON.stringify({ orderId }) },
    TABLE_SESSION_INT64,
  )
}

export function checkoutTableSession(
  id: string,
  targetPaymentDeviceId: string,
): Promise<TableSessionCheckoutHandoff> {
  return apiRequestExact<TableSessionCheckoutHandoff>(
    `/table-sessions/${encodeURIComponent(id)}/checkout`,
    { method: 'POST', body: JSON.stringify({ targetPaymentDeviceId }) },
    TABLE_SESSION_INT64,
  )
}
