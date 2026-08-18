import { apiResponse } from './http'
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
const exactFields =
  /"(approvedAmount|cancelledAmount|netSales|completedOrderCount|cancelledOrderCount)"\s*:\s*(-?\d+)/g
function parse<T>(text: string): T {
  return JSON.parse(text.replace(exactFields, '"$1":"$2"')) as T
}
export function formatExactKrw(value: string) {
  if (!/^-?\d+$/.test(value)) return '금액 확인 필요'
  return `${BigInt(value).toLocaleString('ko-KR')}원`
}
