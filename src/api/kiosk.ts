import { apiRequest, apiResponse } from './http'
import { parseJsonWithInt64, type Int64String } from './int64'
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
  version: number
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
  tableId?: string
  lines: Array<{ productId: string; quantity: number }>
}

export const activateKiosk = (tenantCode: string, deviceCode: string, secret: string) =>
  apiRequest<void>(
    '/kiosk-auth/activate',
    { method: 'POST', body: JSON.stringify({ tenantCode, deviceCode, secret }) },
    { handleUnauthorized: false },
  )
export const getKioskMenu = () =>
  exactKioskRequest<KioskMenu>('/catalog/menu', {}, ['price'])
export const getKioskTables = () =>
  apiRequest<KioskTable[]>('/tables', {}, { handleUnauthorized: 'kiosk' })
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

async function exactKioskRequest<T>(
  path: string,
  options: RequestInit,
  fields: readonly string[],
): Promise<T> {
  const response = await apiResponse(path, options, { handleUnauthorized: 'kiosk' })
  return parseJsonWithInt64<T>(await response.text(), fields)
}
