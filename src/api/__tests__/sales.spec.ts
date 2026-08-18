import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatExactKrw, getDailySales } from '@/api/sales'
describe('sales api exact integers', () => {
  beforeEach(() => vi.restoreAllMocks())
  it('preserves integers beyond Number.MAX_SAFE_INTEGER', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            '{"businessDate":"2026-08-18","approvedAmount":9007199254740993,"cancelledAmount":0,"netSales":9007199254740993,"completedOrderCount":9007199254740995,"cancelledOrderCount":0,"currency":"KRW","closed":false}',
            { status: 200 },
          ),
        ),
      ),
    )
    const result = await getDailySales('2026-08-18')
    expect(result.netSales).toBe('9007199254740993')
    expect(result.completedOrderCount).toBe('9007199254740995')
    expect(formatExactKrw(result.netSales)).toBe('9,007,199,254,740,993원')
  })
})
