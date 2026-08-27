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
  const handoff: PaymentKioskHandoff = {
    publicId: 'public-handoff',
    displayCode: 'A7K9',
    status: 'DISPLAYED',
    expiresAt: '2026-08-27T10:00:10Z',
    amount: '12000',
    currency: 'KRW',
    orderDisplayNumber: 17,
    orderSummary: '아메리카노 외 1건',
    oneTimeToken: 'one_time_token_1234',
  }

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
      ...handoff,
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

  it('keeps the first-claim QR only in memory and never exposes IDs or the token as presentation data', async () => {
    api.getCurrentPaymentHandoff
      .mockResolvedValueOnce(handoff)
      .mockResolvedValueOnce({ ...handoff, oneTimeToken: null })
    const scope = effectScope()
    const display = scope.run(() => usePaymentHandoffDisplay(2_500))!
    display.start()
    await vi.advanceTimersByTimeAsync(0)
    const qr = display.qrValue.value

    expect(qr).toBe(
      `${location.origin}/pay/public-handoff#token=one_time_token_1234`,
    )
    expect(JSON.stringify(display.current.value)).not.toContain('internal-handoff')
    expect(JSON.stringify(display.current.value)).not.toContain('public-handoff')
    expect(JSON.stringify(display.current.value)).not.toContain('one_time_token_1234')

    await vi.advanceTimersByTimeAsync(2_500)
    expect(display.qrValue.value).toBe(qr)
    scope.stop()
  })

  it.each(['PAID', 'FAILED', 'EXPIRED', 'CANCELLED'] as const)(
    'removes the QR immediately when the server reports %s',
    async (status) => {
      api.getCurrentPaymentHandoff
        .mockResolvedValueOnce(handoff)
        .mockResolvedValueOnce({ ...handoff, status, oneTimeToken: null })
      const scope = effectScope()
      const display = scope.run(() => usePaymentHandoffDisplay(2_500))!
      display.start()
      await vi.advanceTimersByTimeAsync(0)
      expect(display.qrValue.value).not.toBe('')

      await vi.advanceTimersByTimeAsync(2_500)
      expect(display.current.value?.status).toBe(status)
      expect(display.qrValue.value).toBe('')
      scope.stop()
    },
  )

  it('keeps a server terminal status for a short dwell before polling the next request', async () => {
    api.getCurrentPaymentHandoff
      .mockResolvedValueOnce({ ...handoff, status: 'PAID', oneTimeToken: null })
      .mockResolvedValueOnce(null)
    const scope = effectScope()
    const display = scope.run(() => usePaymentHandoffDisplay(1_000, 3_000))!
    display.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(display.current.value?.status).toBe('PAID')
    await vi.advanceTimersByTimeAsync(2_999)
    expect(api.getCurrentPaymentHandoff).toHaveBeenCalledTimes(1)
    expect(display.current.value?.status).toBe('PAID')

    await vi.advanceTimersByTimeAsync(1)
    expect(api.getCurrentPaymentHandoff).toHaveBeenCalledTimes(2)
    expect(display.current.value).toBeNull()
    scope.stop()
  })

  it('recovers immediately when the network returns', async () => {
    const scope = effectScope()
    const display = scope.run(() => usePaymentHandoffDisplay(60_000))!
    display.start()
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)

    expect(api.getCurrentPaymentHandoff).toHaveBeenCalledTimes(2)
    scope.stop()
  })
})
