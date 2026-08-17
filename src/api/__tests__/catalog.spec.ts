import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSalesMenu } from '@/api/catalog'

const menu = {
  currency: 'KRW',
  categories: [
    {
      categoryId: 'category-1',
      name: '커피',
      displayOrder: 1,
      products: [
        { productId: 'product-1', name: '아메리카노', description: 'ICE', price: 4500, displayOrder: 1 },
      ],
    },
  ],
}

describe('catalog API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('loads only the Commerce sales-menu resource', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(menu), { status: 200 }))

    await expect(getSalesMenu()).resolves.toEqual(menu)

    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/catalog/menu')
    expect(options?.method).toBe('GET')
    expect(options?.credentials).toBe('include')
  })

  it('preserves a service-unavailable Problem Detail', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' }), { status: 503 }),
    )

    await expect(getSalesMenu()).rejects.toMatchObject({
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    })
  })
})
