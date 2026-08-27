import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentPaymentHandoff } from '@/api/paymentHandoff'

describe('payment handoff api', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requests the documented current-slot candidate path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: 'h1',
            displayCode: 'A7K9',
            status: 'DISPLAYED',
            expiresAt: '2026-08-27T10:05:00Z',
          }),
          { status: 200 },
        ),
      ),
    )

    await expect(getCurrentPaymentHandoff()).resolves.toEqual({
      id: 'h1',
      displayCode: 'A7K9',
      status: 'DISPLAYED',
      expiresAt: '2026-08-27T10:05:00Z',
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/kiosk/payment-handoffs/current',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('maps an empty current slot to null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(getCurrentPaymentHandoff()).resolves.toBeNull()
  })
})
