import { apiRequest } from './http'
import type { PaymentStatus } from './payment'
import type { OrderStatus, OrderServiceType } from './order'

export type KioskDeviceState = 'UNREGISTERED' | 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'AUTH_FAILED'
export interface KioskMenuItem {
  productId: string
  name: string
  description: string
  price: number
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
  totalAmount: number
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
  apiRequest<KioskMenu>('/catalog/menu', {}, { handleUnauthorized: false })
export const getKioskTables = () =>
  apiRequest<KioskTable[]>('/tables', {}, { handleUnauthorized: false })
export const createKioskOrder = (body: KioskOrderRequest, key: string) =>
  apiRequest<KioskCreatedOrder>(
    '/orders',
    { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
    { handleUnauthorized: false },
  )
export const getKioskOrder = (id: string, token: string) =>
  apiRequest<KioskOrderStatus>(
    `/orders/${encodeURIComponent(id)}`,
    { headers: { 'X-Order-Access-Token': token } },
    { handleUnauthorized: false },
  )
