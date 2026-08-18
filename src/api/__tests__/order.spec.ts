import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelOrder,
  completeOrder,
  createOrder,
  getOrder,
  getOrders,
  type CreateOrderRequest,
} from '@/api/order'

/** Wire shape exactly as Commerce serialises `OrderView`: `totalAmount` is a JSON int64 number. */
const orderWire = {
  orderId: '11111111-1111-4111-8111-111111111111',
  displayNumber: 7,
  totalAmount: 9000,
  currency: 'KRW',
  status: 'CREATED' as const,
  businessDate: '2026-08-17',
  orderAccessToken: null,
}

const order = { ...orderWire, totalAmount: '9000' }

const createRequest: CreateOrderRequest = {
  orderChannel: 'POS',
  serviceType: 'DINE_IN',
  tableId: '22222222-2222-4222-8222-222222222222',
  lines: [{ productId: '33333333-3333-4333-8333-333333333333', quantity: 2 }],
}

describe('order API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=csrf%20token; path=/'
  })

  it('creates an order with its operation idempotency key and no client price fields', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(orderWire), { status: 201 }))

    await expect(createOrder(createRequest, 'key-1')).resolves.toEqual(order)

    const [url, options] = fetchMock.mock.calls[0]!
    const headers = new Headers(options?.headers)
    expect(url).toBe('/api/v1/orders')
    expect(options?.method).toBe('POST')
    expect(options?.credentials).toBe('include')
    expect(headers.get('Idempotency-Key')).toBe('key-1')
    expect(headers.get('X-XSRF-TOKEN')).toBe('csrf token')
    expect(JSON.parse(String(options?.body))).toEqual(createRequest)
  })

  it('uses only the confirmed list filters and encodes them', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([orderWire]), { status: 200 }))

    await expect(getOrders({ businessDate: '2026-08-17', status: 'ACCEPTED' })).resolves.toEqual([
      order,
    ])

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/orders?businessDate=2026-08-17&status=ACCEPTED',
    )
  })

  it('gets, cancels, and completes an opaque order id with the confirmed paths', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(orderWire), { status: 200 }))

    await getOrder('order/id')
    await cancelOrder('order/id')
    await completeOrder('order/id')

    expect(
      fetchMock.mock.calls.map(([url, options]) => ({
        url,
        method: options?.method,
        credentials: options?.credentials,
      })),
    ).toEqual([
      { url: '/api/v1/orders/order%2Fid', method: 'GET', credentials: 'include' },
      { url: '/api/v1/orders/order%2Fid/cancel', method: 'POST', credentials: 'include' },
      { url: '/api/v1/orders/order%2Fid/complete', method: 'POST', credentials: 'include' },
    ])
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-XSRF-TOKEN')).toBe(
      'csrf token',
    )
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('X-XSRF-TOKEN')).toBe(
      'csrf token',
    )
  })

  it('keeps an int64 totalAmount beyond Number.MAX_SAFE_INTEGER exact', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '{"orderId":"11111111-1111-4111-8111-111111111111","displayNumber":7,' +
          '"totalAmount":9007199254740993,"currency":"KRW","status":"CREATED",' +
          '"businessDate":"2026-08-17","orderAccessToken":null}',
        { status: 200 },
      ),
    )

    await expect(getOrder('order-1')).resolves.toMatchObject({
      totalAmount: '9007199254740993',
    })
  })

  it('exposes idempotency payload conflicts as Problem Details', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 409, code: 'IDP_CONFLICT', detail: 'key reused for another request' }),
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    )

    await expect(createOrder(createRequest, 'key-1')).rejects.toMatchObject({
      status: 409,
      code: 'IDP_CONFLICT',
    })
  })
})
