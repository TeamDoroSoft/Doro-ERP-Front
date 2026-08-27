import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listActivePaymentKioskCandidatesForStaff } from '@/api/paymentKioskCandidates'

describe('payment kiosk candidates API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('uses the employee-safe candidate route and returns only its minimal projection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              deviceId: '11111111-1111-4111-8111-111111111111',
              displayName: '카운터 결제 01',
              mode: 'PAYMENT',
              active: true,
            },
          ]),
        ),
      ),
    )

    await expect(listActivePaymentKioskCandidatesForStaff()).resolves.toEqual([
      {
        deviceId: '11111111-1111-4111-8111-111111111111',
        displayName: '카운터 결제 01',
        mode: 'PAYMENT',
        active: true,
      },
    ])
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/payment-kiosk-candidates',
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})
