import { apiRequest, apiRequestExact } from './http'
import type { Int64String } from './int64'
import type { PaymentStatus } from './payment'
import type { OrderStatus, OrderServiceType } from './order'

export type KioskDeviceState = 'UNREGISTERED' | 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'AUTH_FAILED'
export interface KioskMenuItem {
  productId: string
  name: string
  description: string
  price: Int64String
  displayOrder: number
}
export interface KioskMenuCategory {
  categoryId: string
  name: string
  displayOrder: number
  products: KioskMenuItem[]
}
export interface KioskMenu {
  currency: string
  categories: KioskMenuCategory[]
}
export interface KioskTable {
  id: string
  tableNumber: string
  displayName: string
  status: 'ACTIVE' | 'INACTIVE'
  /** Store Access optimistic-lock counter (Java `long`). */
  version: Int64String
}
export interface KioskCreatedOrder {
  orderId: string
  displayNumber: number
  totalAmount: Int64String
  currency: string
  status: OrderStatus
  businessDate: string
  orderAccessToken: string
}
export interface KioskOrderStatus {
  orderId: string
  displayNumber: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: 'PREPARING' | 'READY' | 'CANCELLED' | ''
}
export interface KioskOrderRequest {
  orderChannel: 'KIOSK'
  serviceType: OrderServiceType
  paymentPolicy: 'PAY_NOW'
  lines: Array<{ productId: string; quantity: number }>
}

export const activateKiosk = (tenantCode: string, deviceCode: string, secret: string) =>
  apiRequest<void>(
    '/kiosk-auth/activate',
    { method: 'POST', body: JSON.stringify({ tenantCode, deviceCode, secret }) },
    { handleUnauthorized: false },
  )
export const getKioskMenu = () => exactKioskRequest<KioskMenu>('/catalog/menu', {}, ['price'])
export const getKioskTables = () => exactKioskRequest<KioskTable[]>('/tables', {}, ['version'])
export const createKioskOrder = (body: KioskOrderRequest, key: string) =>
  exactKioskRequest<KioskCreatedOrder>(
    '/orders',
    { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
    ['totalAmount'],
  )
export const getKioskOrder = (id: string, token: string) =>
  apiRequest<KioskOrderStatus>(
    `/orders/${encodeURIComponent(id)}`,
    { headers: { 'X-Order-Access-Token': token } },
    { handleUnauthorized: 'kiosk' },
  )

function exactKioskRequest<T>(
  path: string,
  options: RequestInit,
  fields: readonly string[],
): Promise<T> {
  return apiRequestExact<T>(path, options, { fields }, { handleUnauthorized: 'kiosk' })
}
