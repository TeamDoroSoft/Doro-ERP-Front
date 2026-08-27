import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePaymentHandoffDisplay } from '@/composables/usePaymentHandoffDisplay'
import type { PaymentKioskHandoff } from '@/api/paymentHandoff'

const api = vi.hoisted(() => ({
  getCurrentPaymentHandoff: vi.fn<() => Promise<PaymentKioskHandoff | null>>(),
}))
vi.mock('@/api/paymentHandoff', () => ({ ...api }))

describe('usePaymentHandoffDisplay', () => {
  let visibility: DocumentVisibilityState

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-27T10:00:00Z'))
    vi.clearAllMocks()
    visibility = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    api.getCurrentPaymentHandoff.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('polls while visible, pauses while hidden, and refreshes immediately on return', async () => {
    const scope = effectScope()
    const display = scope.run(() => usePaymentHandoffDisplay(2_500))!
    display.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(api.getCurrentPaymentHandoff).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_500)
    expect(api.getCurrentPaymentHandoff).toHaveBeenCalledTimes(2)
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.getCurrentPaymentHandoff).toHaveBeenCalledTimes(2)

    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(api.getCurrentPaymentHandoff).toHaveBeenCalledTimes(3)
    scope.stop()
  })

  it('does not turn a local countdown into a paid or expired server status', async () => {
    api.getCurrentPaymentHandoff.mockResolvedValue({
      id: 'internal-handoff',
      displayCode: 'A7K9',
      status: 'DISPLAYED',
      expiresAt: '2026-08-27T10:00:01Z',
    })
    const scope = effectScope()
    const display = scope.run(() => usePaymentHandoffDisplay(60_000))!
    display.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(display.remainingSeconds.value).toBe(0)
    expect(display.current.value?.status).toBe('DISPLAYED')
    expect(display.canDisplayQr.value).toBe(false)
    scope.stop()
  })
})
