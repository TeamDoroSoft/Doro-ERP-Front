import { apiResponse } from './http'
import { formatKrw, parseJsonWithInt64 } from './int64'
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
export async function getDailySales(businessDate: string) {
  return parse<DailySales>(
    await (await apiResponse(`/sales/daily?${new URLSearchParams({ businessDate })}`)).text(),
  )
}
export async function closeDailySales(businessDate: string) {
  return parse<DailyClosing>(
    await (
      await apiResponse(`/sales/daily/${encodeURIComponent(businessDate)}/close`, {
        method: 'POST',
      })
    ).text(),
  )
}
export async function getDailyClosing(businessDate: string) {
  return parse<DailyClosing>(
    await (await apiResponse(`/sales/closings/${encodeURIComponent(businessDate)}`)).text(),
  )
}
function parse<T>(text: string): T {
  return parseJsonWithInt64<T>(text, [
    'approvedAmount',
    'cancelledAmount',
    'netSales',
    'completedOrderCount',
    'cancelledOrderCount',
  ])
}
export function formatExactKrw(value: string) {
  return formatKrw(value)
}
