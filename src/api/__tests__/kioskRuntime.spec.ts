import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, registerKioskUnauthorizedHandler } from '@/api/http'
import { getKioskRuntime, kioskModeHome } from '@/api/kioskRuntime'

describe('kiosk runtime api', () => {
  const deviceId = '88000000-0000-4000-8000-000000000001'

  beforeEach(() => {
    vi.restoreAllMocks()
    registerKioskUnauthorizedHandler(() => undefined)
  })

  it('uses the kiosk authentication boundary and returns the configured mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              deviceId,
              deviceName: '입구',
              mode: 'ENTRY_QUEUE',
              pairedPaymentDevice: null,
            }),
            { status: 200 },
          ),
      ),
    )

    await expect(getKioskRuntime()).resolves.toEqual({
      deviceId,
      deviceName: '입구',
      mode: 'ENTRY_QUEUE',
      pairedPaymentDevice: null,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/kiosk/runtime',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(kioskModeHome).toEqual({
      ORDER: '/kiosk/order',
      ENTRY_QUEUE: '/kiosk/waiting',
      PAYMENT: '/kiosk/payment',
    })
  })

  it('ends the kiosk session on its authentication 401', async () => {
    const unauthorized = vi.fn<() => void>()
    registerKioskUnauthorizedHandler(unauthorized)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'KIOSK_AUTHENTICATION_FAILED' }), { status: 401 }),
      ),
    )

    await expect(getKioskRuntime()).rejects.toBeInstanceOf(ApiError)
    expect(unauthorized).toHaveBeenCalledOnce()
  })

  it('returns the paired payment device projection for an order kiosk', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              deviceId,
              deviceName: '입구 주문 Kiosk 01',
              mode: 'ORDER',
              pairedPaymentDevice: {
                id: '88000000-0000-4000-8000-000000000002',
                name: '카운터 결제 Kiosk 02',
              },
            }),
            { status: 200 },
          ),
      ),
    )

    await expect(getKioskRuntime()).resolves.toMatchObject({
      pairedPaymentDevice: {
        id: '88000000-0000-4000-8000-000000000002',
        name: '카운터 결제 Kiosk 02',
      },
    })
  })

  it('surfaces a mode 403 without ending the kiosk session', async () => {
    const unauthorized = vi.fn<() => void>()
    registerKioskUnauthorizedHandler(unauthorized)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ code: 'KIOSK_MODE_FORBIDDEN' }), { status: 403 }),
      ),
    )

    await expect(getKioskRuntime()).rejects.toMatchObject({
      status: 403,
      code: 'KIOSK_MODE_FORBIDDEN',
    })
    expect(unauthorized).not.toHaveBeenCalled()
  })
})
