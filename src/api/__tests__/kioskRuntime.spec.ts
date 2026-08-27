import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, registerKioskUnauthorizedHandler } from '@/api/http'
import { getKioskRuntime, kioskModeHome } from '@/api/kioskRuntime'

describe('kiosk runtime api', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    registerKioskUnauthorizedHandler(() => undefined)
  })

  it('uses the kiosk authentication boundary and returns the configured mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ deviceId: 'device-1', deviceName: '입구', mode: 'ENTRY_QUEUE' }),
          { status: 200 },
        ),
      ),
    )

    await expect(getKioskRuntime()).resolves.toMatchObject({ mode: 'ENTRY_QUEUE' })
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
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'KIOSK_AUTHENTICATION_FAILED' }), { status: 401 }),
      ),
    )

    await expect(getKioskRuntime()).rejects.toBeInstanceOf(ApiError)
    expect(unauthorized).toHaveBeenCalledOnce()
  })

  it('surfaces a mode 403 without ending the kiosk session', async () => {
    const unauthorized = vi.fn<() => void>()
    registerKioskUnauthorizedHandler(unauthorized)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'KIOSK_MODE_FORBIDDEN' }), { status: 403 }),
      ),
    )

    await expect(getKioskRuntime()).rejects.toMatchObject({
      status: 403,
      code: 'KIOSK_MODE_FORBIDDEN',
    })
    expect(unauthorized).not.toHaveBeenCalled()
  })
})
