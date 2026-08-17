import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PaymentApiError,
  cancelPayment,
  confirmPayment,
  createPayment,
  createPaymentIdempotencyKey,
  getPayment,
  paymentProblemMessage,
} from '@/api/payment'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>

describe('payment api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates a payment at the common API base with the command idempotency key', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse(paymentView()))
    vi.stubGlobal('fetch', fetchMock)

    await createPayment('11111111-1111-4111-8111-111111111111', key('2'))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/payments',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ orderId: '11111111-1111-4111-8111-111111111111' }),
      }),
    )
    expect(headers(fetchMock).get('Idempotency-Key')).toBe(key('2'))
  })

  it('gets an opaque payment ID using URL encoding', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse(paymentView()))
    vi.stubGlobal('fetch', fetchMock)

    await getPayment('payment/id?retry=1')

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/payments/payment%2Fid%3Fretry%3D1')
  })

  it('confirms and cancels using their exact command bodies and independent UUID keys', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse(paymentView()))
    vi.stubGlobal('fetch', fetchMock)

    await confirmPayment('payment-42', 'provider-payment-key', 12_000, key('3'))
    await cancelPayment('payment-42', 'CUSTOMER_REQUEST', key('4'))

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/payments/payment-42/confirm')
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ paymentKey: 'provider-payment-key', amount: 12_000 }),
    )
    expect(headers(fetchMock, 0).get('Idempotency-Key')).toBe(key('3'))
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/payments/payment-42/cancel')
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ reasonCode: 'CUSTOMER_REQUEST' }),
    )
    expect(headers(fetchMock, 1).get('Idempotency-Key')).toBe(key('4'))
  })

  it.each([
    [409, 'STATE_CONFLICT'],
    [422, 'VALIDATION_FAILED'],
    [503, 'PAYMENT_UNAVAILABLE'],
  ])('keeps %i problem responses as shared API errors', async (status, code) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>().mockResolvedValue(jsonResponse({ code }, false, status)),
    )

    await expect(createPayment('order-1', key('5'))).rejects.toEqual(
      expect.objectContaining<Partial<PaymentApiError>>({ status, code }),
    )
  })

  it('maps network failures and unknown problem details to safe UI text', async () => {
    vi.stubGlobal('fetch', vi.fn<FetchMock>().mockRejectedValue(new TypeError('offline')))

    await expect(createPayment('order-1', key('6'))).rejects.toEqual(
      expect.objectContaining<Partial<PaymentApiError>>({ status: 0, code: 'NETWORK_ERROR' }),
    )
    expect(
      paymentProblemMessage(new PaymentApiError(422, { code: 'UNKNOWN', detail: 'database host' })),
    ).toBe('결제 요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.')
  })

  it('creates UUID idempotency keys required for every payment command', () => {
    expect(createPaymentIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })
})

function headers(fetchMock: ReturnType<typeof vi.fn<FetchMock>>, call = 0): Headers {
  return fetchMock.mock.calls[call]?.[1]?.headers as Headers
}

function key(digit: string) {
  return `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`
}

function paymentView() {
  return {
    id: 'payment-42',
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
