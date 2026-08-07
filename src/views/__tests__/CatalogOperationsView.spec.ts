import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CatalogOperationsView from '@/views/CatalogOperationsView.vue'
import { useCatalogSessionStore } from '@/stores/catalogSession'
import type { CatalogRoleCode } from '@/api/catalog'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>

const CATEGORY_ID = 'c-1'
const PRODUCT_ID = 'p-1'

const salesMenu = {
  currency: 'KRW',
  categories: [
    {
      categoryId: CATEGORY_ID,
      name: '커피',
      displayOrder: 0,
      products: [
        {
          productId: PRODUCT_ID,
          name: '아메리카노',
          description: null,
          price: 4500,
          soldOut: false,
          sellable: true,
          displayOrder: 0,
          version: 2,
        },
      ],
    },
  ],
}

const categories = [
  { categoryId: CATEGORY_ID, name: '커피', displayOrder: 0, active: true, version: 1 },
]

const products = [
  {
    productId: PRODUCT_ID,
    categoryId: CATEGORY_ID,
    name: '아메리카노',
    description: null,
    price: 4500,
    soldOut: false,
    active: true,
    displayOrder: 0,
    version: 2,
  },
]

describe('CatalogOperationsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows the sales menu and manager controls for a MANAGER', async () => {
    stubFetch(defaultHandler())
    const wrapper = await mountView('MANAGER')

    expect(wrapper.text()).toContain('아메리카노')
    expect(wrapper.text()).toContain('4,500원')
    expect(wrapper.find('[data-testid="open-category-create"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="open-product-create"]').exists()).toBe(true)
    expect(wrapper.find(`[data-testid="sold-out-${PRODUCT_ID}"]`).exists()).toBe(true)
  })

  it('hides catalog editing from STAFF but keeps the sold out toggle', async () => {
    stubFetch(defaultHandler())
    const wrapper = await mountView('STAFF')

    expect(wrapper.find('[data-testid="open-category-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="open-product-create"]').exists()).toBe(false)
    expect(wrapper.find(`[data-testid="sold-out-${PRODUCT_ID}"]`).exists()).toBe(true)
    expect(wrapper.get('[data-testid="role-notice"]').text()).toContain('품절 변경만 가능')
  })

  it('hides every mutation from a KIOSK_DEVICE', async () => {
    stubFetch(defaultHandler())
    const wrapper = await mountView('KIOSK_DEVICE')

    expect(wrapper.find('[data-testid="open-category-create"]').exists()).toBe(false)
    expect(wrapper.find(`[data-testid="sold-out-${PRODUCT_ID}"]`).exists()).toBe(false)
    expect(wrapper.find('[data-testid="sold-out-readonly"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="kiosk-note"]').exists()).toBe(true)
  })

  it('sends the sold out change with the current version', async () => {
    const fetchMock = stubFetch(defaultHandler())
    const wrapper = await mountView('STAFF')

    await wrapper.get(`[data-testid="sold-out-${PRODUCT_ID}"]`).trigger('click')
    await flushPromises()

    const call = fetchMock.mock.calls.find(([input, init]) =>
      String(input).endsWith('/sold-out') && init?.method === 'PATCH',
    )
    expect(call).toBeDefined()
    const init = call?.[1] as RequestInit
    expect(init.body).toBe(JSON.stringify({ soldOut: true }))
    expect((init.headers as Headers).get('If-Match')).toBe('2')
    expect(wrapper.get('[data-testid="notice"]').text()).toContain('품절로 변경')
  })

  it('shows a permission message when the server rejects with 403', async () => {
    stubFetch((path, method) => {
      if (path.endsWith('/sold-out') && method === 'PATCH') {
        return problemResponse(403, { code: 'FORBIDDEN', detail: '현재 권한으로 수행할 수 없습니다.' })
      }
      return defaultHandler()(path, method)
    })
    const wrapper = await mountView('STAFF')

    await wrapper.get(`[data-testid="sold-out-${PRODUCT_ID}"]`).trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="api-error-kind"]').text()).toBe('권한 부족')
    expect(wrapper.get('[data-testid="api-error-message"]').text()).toContain('권한이 부족')
  })

  it('shows a conflict message when another user changed the product first', async () => {
    stubFetch((path, method) => {
      if (path.endsWith('/sold-out') && method === 'PATCH') {
        return problemResponse(409, { code: 'CATALOG_VERSION_CONFLICT' })
      }
      return defaultHandler()(path, method)
    })
    const wrapper = await mountView('STAFF')

    await wrapper.get(`[data-testid="sold-out-${PRODUCT_ID}"]`).trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="api-error-kind"]').text()).toBe('동시 수정 충돌')
    expect(wrapper.get('[data-testid="api-error-message"]').text()).toContain('다른 사용자가 먼저 변경')
  })

  it('shows an authentication message when the session is missing', async () => {
    stubFetch(() => problemResponse(401, { code: 'AUTHENTICATION_REQUIRED' }))
    const wrapper = await mountView('MANAGER')

    expect(wrapper.get('[data-testid="api-error-kind"]').text()).toBe('인증 오류')
  })

  it('shows a server error message on 500', async () => {
    stubFetch(() => problemResponse(500, { code: 'INTERNAL_SERVER_ERROR' }))
    const wrapper = await mountView('MANAGER')

    expect(wrapper.get('[data-testid="api-error-kind"]').text()).toBe('서버 오류')
  })

  it('shows a network error message when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>(() => Promise.reject(new Error('offline'))),
    )
    const wrapper = await mountView('MANAGER')

    expect(wrapper.get('[data-testid="api-error-kind"]').text()).toBe('네트워크 오류')
  })

  it('reports field level validation errors from the product form', async () => {
    const fetchMock = stubFetch((path, method) => {
      if (path.endsWith('/api/v1/catalog/products') && method === 'POST') {
        return problemResponse(400, {
          code: 'VALIDATION_FAILED',
          detail: '가격은 0원 이상의 정수여야 합니다.',
          fieldErrors: [{ field: 'price', code: 'PRICE_NEGATIVE' }],
        })
      }
      return defaultHandler()(path, method)
    })
    const wrapper = await mountView('MANAGER')

    await wrapper.get('[data-testid="open-product-create"]').trigger('click')
    await wrapper.get('#product-name').setValue('음수 상품')
    await wrapper.get('#product-price').setValue(-1)
    await wrapper.get('[data-testid="product-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="api-error-kind"]').text()).toBe('입력 오류')
    expect(wrapper.get('[data-testid="api-error-fields"]').text()).toContain(
      '가격은 0원 이상의 정수로 입력하세요.',
    )
    expect(fetchMock).toHaveBeenCalled()
  })

  it('deactivates a category instead of deleting it', async () => {
    const fetchMock = stubFetch(defaultHandler())
    const wrapper = await mountView('MANAGER')

    await wrapper.get(`[data-testid="category-activation-${CATEGORY_ID}"]`).trigger('click')
    await flushPromises()

    const call = fetchMock.mock.calls.find(([input, init]) =>
      String(input).includes(`/categories/${CATEGORY_ID}`) && init?.method === 'PATCH',
    )
    expect(call).toBeDefined()
    expect(call?.[1]?.method).not.toBe('DELETE')
    expect(call?.[1]?.body).toBe(JSON.stringify({ active: false }))
    expect(wrapper.get('[data-testid="notice"]').text()).toContain('삭제되지 않습니다')
  })
})

type Handler = (path: string, method: string) => Response

function defaultHandler(): Handler {
  return (path, method) => {
    if (path.endsWith('/api/v1/catalog/menu') && method === 'GET') {
      return jsonResponse(salesMenu)
    }
    if (path.endsWith('/api/v1/catalog/categories') && method === 'GET') {
      return jsonResponse(categories)
    }
    if (path.endsWith('/api/v1/catalog/products') && method === 'GET') {
      return jsonResponse(products)
    }
    return jsonResponse({})
  }
}

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn<FetchMock>((input, init) =>
    Promise.resolve(handler(String(input), init?.method ?? 'GET')),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function mountView(role: CatalogRoleCode): Promise<VueWrapper> {
  const pinia = createPinia()
  setActivePinia(pinia)
  useCatalogSessionStore().roleCode = role
  const wrapper = mount(CatalogOperationsView, { global: { plugins: [pinia] } })
  await flushPromises()
  return wrapper
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: true,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function problemResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  } as unknown as Response
}
