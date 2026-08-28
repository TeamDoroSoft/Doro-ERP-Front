import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentBusinessDate } from '@/composables/useCurrentBusinessDate'

describe('useCurrentBusinessDate', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts with the browser local calendar date and overrides it with Store Access', async () => {
    vi.setSystemTime(new Date(2026, 7, 28, 23, 30))
    const get = vi.fn<() => Promise<{ businessDate: string }>>()
      .mockResolvedValue({ businessDate: '2026-08-29' })
    const model = effectScope().run(() => useCurrentBusinessDate({ get }))!

    expect(model.businessDate.value).toBe('2026-08-28')
    await model.resolveBusinessDate()

    expect(model.businessDate.value).toBe('2026-08-29')
    expect(get).toHaveBeenCalledOnce()
  })

  it('does not overwrite a date manually changed while Store Access is pending', async () => {
    vi.setSystemTime(new Date(2026, 7, 28))
    let finish!: (value: { businessDate: string }) => void
    const get = vi.fn<() => Promise<{ businessDate: string }>>(() => new Promise<{ businessDate: string }>((resolve) => { finish = resolve }))
    const model = effectScope().run(() => useCurrentBusinessDate({ get }))!
    const pending = model.resolveBusinessDate()
    model.businessDate.value = '2026-08-30'
    finish({ businessDate: '2026-08-29' })
    await pending
    expect(model.businessDate.value).toBe('2026-08-30')
  })

  it('keeps the local date and permits retry after an invalid response', async () => {
    vi.setSystemTime(new Date(2026, 7, 28))
    const get = vi.fn<() => Promise<{ businessDate: string | null }>>().mockResolvedValueOnce({ businessDate: '2026-02-30' })
      .mockResolvedValueOnce({ businessDate: '2026-08-29' })
    const model = effectScope().run(() => useCurrentBusinessDate({ get }))!

    await model.resolveBusinessDate()
    expect(model.businessDate.value).toBe('2026-08-28')
    expect(model.businessDateError.value).toContain('불러오지 못했습니다')

    await model.resolveBusinessDate()
    expect(model.businessDate.value).toBe('2026-08-29')
    expect(model.businessDateError.value).toBe('')
  })

  it('retains the local date when Store Access fails or omits the date', async () => {
    vi.setSystemTime(new Date(2026, 7, 28))
    const get = vi.fn<() => Promise<{ businessDate?: string | null }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ businessDate: null })
    const model = effectScope().run(() => useCurrentBusinessDate({ get }))!

    await model.resolveBusinessDate()
    expect(model.businessDate.value).toBe('2026-08-28')
    expect(model.businessDateError.value).toContain('불러오지 못했습니다')
    await model.resolveBusinessDate()
    expect(model.businessDate.value).toBe('2026-08-28')
  })
})
