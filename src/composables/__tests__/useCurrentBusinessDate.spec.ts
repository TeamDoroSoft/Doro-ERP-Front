import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useCurrentBusinessDate } from '@/composables/useCurrentBusinessDate'

describe('useCurrentBusinessDate', () => {
  it('uses the Store Access value without consulting the browser clock', async () => {
    const get = vi.fn<() => Promise<{ businessDate: string }>>()
      .mockResolvedValue({ businessDate: '2026-08-28' })
    const model = effectScope().run(() => useCurrentBusinessDate({ get }))!

    await model.resolveBusinessDate()

    expect(model.businessDate.value).toBe('2026-08-28')
    expect(get).toHaveBeenCalledOnce()
  })

  it('keeps the date unset and permits retry after an invalid response', async () => {
    const get = vi.fn<() => Promise<{ businessDate: string }>>().mockResolvedValueOnce({ businessDate: '2026-02-30' })
      .mockResolvedValueOnce({ businessDate: '2026-08-29' })
    const model = effectScope().run(() => useCurrentBusinessDate({ get }))!

    await model.resolveBusinessDate()
    expect(model.businessDate.value).toBe('')
    expect(model.businessDateError.value).toContain('불러오지 못했습니다')

    await model.resolveBusinessDate()
    expect(model.businessDate.value).toBe('2026-08-29')
    expect(model.businessDateError.value).toBe('')
  })
})
