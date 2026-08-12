import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PaymentApiError,
  confirmPayment,
  createPayment,
  createPaymentIdempotencyKey,
} from '@/api/payment'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>

describe('payment api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates a payment through the Edge public path with the employee session cookie', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse(paymentResponse()))
    vi.stubGlobal('fetch', fetchMock)

    await createPayment(
      'https://edge.example.test/',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://edge.example.test/api/v1/payments',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ orderId: '11111111-1111-4111-8111-111111111111' }),
      }),
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('Idempotency-Key')).toBe('22222222-2222-4222-8222-222222222222')
    expect(headers.get('Authorization')).toBeNull()
    expect([...headers.keys()].some((name) => name.toLowerCase().startsWith('x-doro-'))).toBe(false)
  })

  it('confirms with only the backend contract body and a separate idempotency key', async () => {
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValue(jsonResponse({ ...paymentResponse(), status: 'PAID' }))
    vi.stubGlobal('fetch', fetchMock)

    await confirmPayment(
      '',
      '33333333-3333-4333-8333-333333333333',
      'payment-key',
      12_000,
      '44444444-4444-4444-8444-444444444444',
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/payments/33333333-3333-4333-8333-333333333333/confirm',
    )
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ paymentKey: 'payment-key', amount: 12_000 }),
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('Idempotency-Key')).toBe('44444444-4444-4444-8444-444444444444')
    expect([...headers.keys()].some((name) => name.toLowerCase().startsWith('x-doro-'))).toBe(false)
  })

  it('normalizes Edge and Payment problem responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<FetchMock>()
        .mockResolvedValue(
          jsonResponse({ code: 'SESSION_ABSOLUTE_EXPIRED', detail: 'expired' }, false, 401),
        ),
    )

    await expect(
      createPayment('', '11111111-1111-4111-8111-111111111111', createPaymentIdempotencyKey()),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PaymentApiError>>({
        status: 401,
        code: 'SESSION_ABSOLUTE_EXPIRED',
      }),
    )
  })

  it('creates UUID idempotency keys required by the Payment backend', () => {
    expect(createPaymentIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })
})

function paymentResponse() {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    orderId: '11111111-1111-4111-8111-111111111111',
    providerOrderId: 'provider-order-123',
    amount: 12_000,
    currency: 'KRW',
    status: 'PENDING',
  }
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: vi.fn<() => Promise<unknown>>().mockResolvedValue(body),
  }
}
