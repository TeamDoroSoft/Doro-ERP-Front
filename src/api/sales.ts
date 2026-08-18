import { apiRequestExact } from './http'
import { formatKrw } from './int64'
export interface DailySales {
  businessDate: string
  approvedAmount: string
  cancelledAmount: string
  netSales: string
  completedOrderCount: string
  cancelledOrderCount: string
  currency: string
  closed: boolean
}
export interface DailyClosing extends Omit<DailySales, 'closed'> {
  closingId: string
  calculatedAt: string
  closedAt: string
}
const SALES_INT64 = {
  fields: [
    'approvedAmount',
    'cancelledAmount',
    'netSales',
    'completedOrderCount',
    'cancelledOrderCount',
  ],
} as const

export function getDailySales(businessDate: string) {
  return apiRequestExact<DailySales>(
    `/sales/daily?${new URLSearchParams({ businessDate })}`,
    {},
    SALES_INT64,
  )
}
export function closeDailySales(businessDate: string) {
  return apiRequestExact<DailyClosing>(
    `/sales/daily/${encodeURIComponent(businessDate)}/close`,
    { method: 'POST' },
    SALES_INT64,
  )
}
export function getDailyClosing(businessDate: string) {
  return apiRequestExact<DailyClosing>(
    `/sales/closings/${encodeURIComponent(businessDate)}`,
    {},
    SALES_INT64,
  )
}
export function formatExactKrw(value: string) {
  return formatKrw(value)
}
