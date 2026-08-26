import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeProductSoldOut, createCategory, createProduct, getManagedCategories, getManagedProducts, getSalesMenu, updateCategory, updateProduct } from '@/api/catalog'

/** Wire shape exactly as Commerce serialises `SalesMenuView`: `price` is a JSON int64 number. */
const menuWire = {
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

const menu = {
  ...menuWire,
  categories: [
    {
      ...menuWire.categories[0]!,
      products: [{ ...menuWire.categories[0]!.products[0]!, price: '4500' }],
    },
  ],
}

describe('catalog API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=catalog%20csrf; path=/'
  })

  it('loads only the Commerce sales-menu resource', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(menuWire), { status: 200 }))

    await expect(getSalesMenu()).resolves.toEqual(menu)

    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/catalog/menu')
    expect(options?.method).toBe('GET')
    expect(options?.credentials).toBe('include')
  })

  it('keeps an int64 menu price beyond Number.MAX_SAFE_INTEGER exact', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '{"currency":"KRW","categories":[{"categoryId":"category-1","name":"커피",' +
          '"displayOrder":1,"products":[{"productId":"product-1","name":"고가 상품",' +
          '"description":"price 9007199254740993","price":9007199254740993,"displayOrder":1}]}]}',
        { status: 200 },
      ),
    )

    const loaded = await getSalesMenu()

    expect(loaded.categories[0]?.products[0]?.price).toBe('9007199254740993')
    expect(loaded.categories[0]?.products[0]?.description).toBe('price 9007199254740993')
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

  it('keeps an int64 Category version exact and returns the same literal in If-Match', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          '[{"categoryId":"category-1","name":"커피","displayOrder":1,"active":true,' +
            '"version":9007199254740993}]',
          { status: 200 },
        ),
    )

    const [loaded] = await getManagedCategories()
    expect(loaded?.version).toBe('9007199254740993')

    await updateCategory('category-1', { active: false }, loaded!.version)
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('If-Match')).toBe(
      '"9007199254740993"',
    )
  })

  it('keeps an int64 Product version exact and returns the same literal in If-Match', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          '[{"productId":"product-1","categoryId":"category-1","name":"라테","description":"",' +
            '"price":9007199254740993,"soldOut":false,"active":true,"displayOrder":1,' +
            '"version":9007199254740993}]',
          { status: 200 },
        ),
    )

    const [loaded] = await getManagedProducts()
    expect(loaded?.version).toBe('9007199254740993')
    expect(loaded?.price).toBe('9007199254740993')

    await updateProduct('product-1', { price: '5500' }, loaded!.version)
    await changeProductSoldOut('product-1', true, loaded!.version)

    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('If-Match')).toBe(
      '"9007199254740993"',
    )
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('If-Match')).toBe(
      '"9007199254740993"',
    )
  })

  it('accepts a nullable managed Product description from the Commerce contract', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '[{"productId":"product-1","categoryId":"category-1","name":"라테","description":null,' +
          '"price":5000,"soldOut":false,"active":true,"displayOrder":1,"version":3}]',
        { status: 200 },
      ),
    )

    await expect(getManagedProducts()).resolves.toMatchObject([{ description: null, price: '5000' }])
  })

  it('sends an int64 product price as an exact JSON integer, never a string or rounded number', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))

    await createProduct({
      categoryId: 'category-1',
      name: '고가 상품',
      description: '',
      price: '9007199254740993',
      displayOrder: 1,
      active: true,
    })

    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"price":9007199254740993')
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain('"9007199254740993"')
  })

  it('uses the exact create, update, deactivate, and sold-out Product mutation contracts', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))

    await createProduct({
      categoryId: 'category-1',
      name: '라테',
      description: 'ICE',
      price: '5000',
      displayOrder: 2,
      active: true,
    })
    await updateProduct(
      'product/id',
      { name: '카페라테', description: 'HOT', price: '5500', displayOrder: 3 },
      '7',
    )
    await updateProduct('product/id', { active: false }, '8')
    await changeProductSoldOut('product/id', true, '9')

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expectProductMutation(0, '/api/v1/catalog/products', 'POST', {
      categoryId: 'category-1',
      name: '라테',
      description: 'ICE',
      price: 5000,
      displayOrder: 2,
      active: true,
    })
    expectProductMutation(
      1,
      '/api/v1/catalog/products/product%2Fid',
      'PATCH',
      {
        name: '카페라테',
        description: 'HOT',
        price: 5500,
        displayOrder: 3,
      },
      '"7"',
    )
    expectProductMutation(
      2,
      '/api/v1/catalog/products/product%2Fid',
      'PATCH',
      { active: false },
      '"8"',
    )
    expectProductMutation(
      3,
      '/api/v1/catalog/products/product%2Fid/sold-out',
      'PATCH',
      { soldOut: true },
      '"9"',
    )
  })

  it('refuses to send a malformed version as an optimistic lock', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))

    expect(() => updateProduct('product-1', { price: '1' }, '9,007')).toThrow(
      '정수 금액 형식이 올바르지 않습니다.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a non-canonical product price before it can form invalid JSON', () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))

    expect(() =>
      createProduct({
        categoryId: 'category-1',
        name: '라테',
        description: '',
        price: '05000',
        displayOrder: 1,
        active: true,
      }),
    ).toThrow('상품 가격은 앞자리 0이 없는 정수여야 합니다.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps managed Category and Product wires separate from the sales menu', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))
    await getManagedCategories(); await createCategory({ name: '커피', displayOrder: 1, active: true })
    await updateCategory('category/id', { active: false }, '3')
    await getManagedProducts(); await createProduct({ categoryId: 'category-1', name: '라테', description: '', price: '5000', displayOrder: 2, active: true })
    await updateProduct('product/id', { price: '5500' }, '4')
    await changeProductSoldOut('product/id', true, '5')
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

  function expectProductMutation(
    index: number,
    url: string,
    method: 'POST' | 'PATCH',
    body: object,
    ifMatch: string | null = null,
  ) {
    const [actualUrl, options] = fetchMock.mock.calls[index]!
    const headers = new Headers(options?.headers)
    expect(actualUrl).toBe(url)
    expect(options?.method).toBe(method)
    expect(options?.credentials).toBe('include')
    expect(headers.get('If-Match')).toBe(ifMatch)
    expect(headers.get('X-XSRF-TOKEN')).toBe('catalog csrf')
    expect(JSON.parse(String(options?.body))).toEqual(body)
  }
})
