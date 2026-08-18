import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeProductSoldOut, createCategory, createProduct, getManagedCategories, getManagedProducts, getSalesMenu, updateCategory, updateProduct } from '@/api/catalog'

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

  it('keeps managed Category and Product wires separate from the sales menu', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))
    await getManagedCategories(); await createCategory({ name: '커피', displayOrder: 1, active: true })
    await updateCategory('category/id', { active: false }, 3)
    await getManagedProducts(); await createProduct({ categoryId: 'category-1', name: '라테', description: '', price: 5000, displayOrder: 2, active: true })
    await updateProduct('product/id', { price: 5500 }, 4)
    await changeProductSoldOut('product/id', true, 5)
    const calls = fetchMock.mock.calls.map(([url, options]) => ({ url, method: options?.method, body: options?.body && JSON.parse(String(options.body)), match: new Headers(options?.headers).get('If-Match') }))
    expect(calls).toEqual([
      { url: '/api/v1/catalog/categories', method: 'GET', body: undefined, match: null },
      { url: '/api/v1/catalog/categories', method: 'POST', body: { name: '커피', displayOrder: 1, active: true }, match: null },
      { url: '/api/v1/catalog/categories/category%2Fid', method: 'PATCH', body: { active: false }, match: '"3"' },
      { url: '/api/v1/catalog/products', method: 'GET', body: undefined, match: null },
      { url: '/api/v1/catalog/products', method: 'POST', body: { categoryId: 'category-1', name: '라테', description: '', price: 5000, displayOrder: 2, active: true }, match: null },
      { url: '/api/v1/catalog/products/product%2Fid', method: 'PATCH', body: { price: 5500 }, match: '"4"' },
      { url: '/api/v1/catalog/products/product%2Fid/sold-out', method: 'PATCH', body: { soldOut: true }, match: '"5"' },
    ])
  })
})
