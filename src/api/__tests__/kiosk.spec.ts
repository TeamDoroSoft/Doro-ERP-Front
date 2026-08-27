import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateKiosk,
  createKioskOrder,
  getKioskMenu,
  getKioskOrder,
  getKioskTables,
} from '@/api/kiosk'
describe('kiosk api', () => {
  beforeEach(() => vi.restoreAllMocks())
  it('activates with the exact credential body and no persistence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    )
    await activateKiosk('tenant', 'K-1', 'one-time')
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/kiosk-auth/activate',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ tenantCode: 'tenant', deviceCode: 'K-1', secret: 'one-time' }),
      }),
    )
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
  it('creates only a KIOSK channel order with its own idempotency key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ orderId: 'o1' }), { status: 201 })),
      ),
    )
    await createKioskOrder(
      {
        orderChannel: 'KIOSK',
        serviceType: 'TAKEOUT',
        paymentPolicy: 'PAY_NOW',
        lines: [{ productId: 'p1', quantity: 1 }],
      },
      'order-key',
    )
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('order-key')
    expect(init.body).toBe(
      JSON.stringify({
        orderChannel: 'KIOSK',
        serviceType: 'TAKEOUT',
        paymentPolicy: 'PAY_NOW',
        lines: [{ productId: 'p1', quantity: 1 }],
      }),
    )
  })
  it('keeps int64 kiosk menu prices and order totals exact', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(async () =>
          new Response(
            '{"currency":"KRW","categories":[{"categoryId":"c1","name":"커피","displayOrder":1,' +
              '"products":[{"productId":"p1","name":"커피","description":"",' +
              '"price":9007199254740993,"displayOrder":1}]}]}',
            { status: 200 },
          ),
        )
        .mockImplementationOnce(async () =>
          new Response(
            '{"orderId":"o1","displayNumber":1,"totalAmount":9007199254740993,"currency":"KRW",' +
              '"status":"CREATED","businessDate":"2026-08-17","orderAccessToken":"t"}',
            { status: 201 },
          ),
        ),
    )

    const menu = await getKioskMenu()
    const order = await createKioskOrder(
      {
        orderChannel: 'KIOSK',
        serviceType: 'TAKEOUT',
        paymentPolicy: 'PAY_NOW',
        lines: [{ productId: 'p1', quantity: 1 }],
      },
      'order-key',
    )

    expect(menu.categories[0]?.products[0]?.price).toBe('9007199254740993')
    expect(order.totalAmount).toBe('9007199254740993')
  })
  it('keeps an int64 kiosk table version exact', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            '[{"id":"t1","tableNumber":"1","displayName":"창가","status":"ACTIVE",' +
              '"version":9007199254740993}]',
            { status: 200 },
          ),
      ),
    )

    const [table] = await getKioskTables()

    expect(table?.version).toBe('9007199254740993')
  })
  it('uses a short-lived header rather than a query for restricted order lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ orderId: 'o1' }), { status: 200 })),
      ),
    )
    await getKioskOrder('o1', 'short-token')
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/v1/orders/o1')
    expect(new Headers(init?.headers).get('X-Order-Access-Token')).toBe('short-token')
    expect(String(url)).not.toContain('short-token')
  })
})
