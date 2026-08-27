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

    await expect(resolvePublicCheckout('public/1', 'one-time-secret')).resolves.toMatchObject({
      amount: '12000',
      status: 'DISPLAYED',
    })

    const [url, options] = fetchMock.mock.calls[0]!
    const headers = new Headers(options?.headers)
    expect(url).toBe('/api/v1/public/payment-handoffs/public%2F1/resolve')
    expect(options?.credentials).toBe('include')
    expect(headers.get('Authorization')).toBe('Bearer one-time-secret')
    expect(headers.has('X-XSRF-TOKEN')).toBe(false)
  })

  it('keeps a public 401 isolated from employee and kiosk session handlers', async () => {
    const employee = vi.fn<() => void>()
    const kiosk = vi.fn<() => void>()
    registerUnauthorizedHandler(employee)
    registerKioskUnauthorizedHandler(kiosk)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(401, 'PUBLIC_CHECKOUT_INVALID')))

    await expect(resolvePublicCheckout('public-1', 'expired')).rejects.toMatchObject({
      status: 401,
      code: 'PUBLIC_CHECKOUT_INVALID',
    })
    expect(employee).not.toHaveBeenCalled()
    expect(kiosk).not.toHaveBeenCalled()
  })

  it('uses the candidate start, confirm and status operations with exact amounts', async () => {
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
      .mockResolvedValueOnce(
        json({ status: 'PROCESSING' }),
      )
      .mockResolvedValueOnce(
        json({ status: 'PAID' }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(startPublicCheckout('public-1', 'secret')).resolves.toMatchObject({
      amount: '9007199254740991',
    })
    await confirmPublicCheckout('public-1', {
      paymentKey: 'payment-key',
      providerOrderId: 'provider-1',
      amount: '12000',
    })
    await expect(getPublicCheckoutStatus('public-1')).resolves.toMatchObject({ status: 'PAID' })

    const [, confirmOptions] = fetchMock.mock.calls[1]!
    expect(confirmOptions?.body).toBe(
      '{"paymentKey":"payment-key","providerOrderId":"provider-1","amount":12000}',
    )
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/v1/public/payment-handoffs/public-1/status',
    )
  })

  it('fails closed when the pending backend wire differs from the candidate contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({ amount: 12000, currency: 'KRW', status: 'UNKNOWN' }),
      ),
    )

    await expect(resolvePublicCheckout('public-1', 'secret')).rejects.toBeInstanceOf(
      PublicCheckoutContractError,
    )
  })
})

function json(body: object) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
