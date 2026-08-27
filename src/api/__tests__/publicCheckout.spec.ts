import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  confirmPublicCheckout,
  getPublicCheckoutStatus,
  PublicCheckoutContractError,
  resolvePublicCheckout,
  startPublicCheckout,
} from '@/api/publicCheckout'
import { registerKioskUnauthorizedHandler, registerUnauthorizedHandler } from '@/api/http'

describe('public checkout API boundary', () => {
  const publicId = '77000000-0000-4000-8000-000000000001'

  afterEach(() => {
    registerUnauthorizedHandler(() => undefined)
    registerKioskUnauthorizedHandler(() => undefined)
    vi.unstubAllGlobals()
    document.cookie = 'XSRF-TOKEN=; max-age=0; path=/'
  })

  it('resolves with an in-memory token and never attaches employee CSRF state', async () => {
    document.cookie = 'XSRF-TOKEN=employee-secret; path=/'
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        orderName: '아메리카노 외 1건',
        amount: 12000,
        currency: 'KRW',
        expiresAt: '2026-08-27T12:30:00Z',
        status: 'DISPLAYED',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolvePublicCheckout(publicId, 'one-time-secret-1')).resolves.toMatchObject({
      amount: '12000',
      status: 'DISPLAYED',
    })

    const [url, options] = fetchMock.mock.calls[0]!
    const headers = new Headers(options?.headers)
    expect(url).toBe(`/api/v1/public/payment-handoffs/${publicId}/resolve`)
    expect(options?.credentials).toBe('include')
    expect(headers.get('Authorization')).toBe('Bearer one-time-secret-1')
    expect(headers.has('X-XSRF-TOKEN')).toBe(false)
  })

  it('keeps a public 401 isolated from employee and kiosk session handlers', async () => {
    const employee = vi.fn<() => void>()
    const kiosk = vi.fn<() => void>()
    registerUnauthorizedHandler(employee)
    registerKioskUnauthorizedHandler(kiosk)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(401, 'UNAUTHENTICATED')))

    await expect(resolvePublicCheckout(publicId, 'expired-secret-1')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    })
    expect(employee).not.toHaveBeenCalled()
    expect(kiosk).not.toHaveBeenCalled()
  })

  it('uses the approved start, confirm and status operations with exact amounts', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          clientKey: 'test_gck_client',
          providerOrderId: 'provider-1',
          orderName: '주문 1052',
          amount: 9007199254740991,
          currency: 'KRW',
        }),
      )
      .mockResolvedValueOnce(json({ status: 'PROCESSING' }))
      .mockResolvedValueOnce(json({ status: 'PAID' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(startPublicCheckout(publicId, 'one-time-secret-1')).resolves.toMatchObject({
      amount: '9007199254740991',
    })
    await confirmPublicCheckout(publicId, {
      paymentKey: 'payment-key',
      providerOrderId: 'provider-1',
      amount: '12000',
    })
    await expect(getPublicCheckoutStatus(publicId)).resolves.toMatchObject({ status: 'PAID' })

    const [, confirmOptions] = fetchMock.mock.calls[1]!
    expect(confirmOptions?.body).toBe(
      '{"paymentKey":"payment-key","providerOrderId":"provider-1","amount":12000}',
    )
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`/api/v1/public/payment-handoffs/${publicId}/status`)
  })

  it('fails closed when the backend wire differs from the approved contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ amount: 12000, currency: 'KRW', status: 'UNKNOWN' })),
    )

    await expect(resolvePublicCheckout(publicId, 'one-time-secret-1')).rejects.toBeInstanceOf(
      PublicCheckoutContractError,
    )
  })

  it('rejects response fields outside the public checkout projection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          orderName: '주문 결제',
          amount: 12000,
          currency: 'KRW',
          expiresAt: '2026-08-27T12:30:00Z',
          status: 'DISPLAYED',
          oneTimeToken: 'must-never-be-returned',
        }),
      ),
    )

    await expect(resolvePublicCheckout(publicId, 'one-time-secret-1')).rejects.toBeInstanceOf(
      PublicCheckoutContractError,
    )
  })

  it('rejects a malformed one-time token without issuing a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolvePublicCheckout(publicId, ' one-time-secret-1 ')).rejects.toBeInstanceOf(
      PublicCheckoutContractError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

function json(body: object) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
