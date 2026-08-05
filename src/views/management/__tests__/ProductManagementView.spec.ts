import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductManagementView from '../ProductManagementView.vue'
import {
  changeSalesPolicy,
  changeSoldOut,
  createProduct,
  getCatalogOverview,
  replaceProductOptions,
  replaceProductOrder,
  updateProduct,
} from '@/api/catalog'
import type { CatalogOverview } from '@/types/catalog'

vi.mock('@/api/catalog', () => ({
  getCatalogOverview: vi.fn<typeof getCatalogOverview>(),
  createProduct: vi.fn<typeof createProduct>(),
  updateProduct: vi.fn<typeof updateProduct>(),
  replaceProductOrder: vi.fn<typeof replaceProductOrder>(),
  replaceProductOptions: vi.fn<typeof replaceProductOptions>(),
  changeSalesPolicy: vi.fn<typeof changeSalesPolicy>(),
  changeSoldOut: vi.fn<typeof changeSoldOut>(),
}))

const routerReplace = vi.fn<(...args: unknown[]) => void>()
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: routerReplace }),
}))

const overview: CatalogOverview = {
  catalogRevision: 1,
  categories: [
    {
      categoryId: 'cat-1',
      name: '커피',
      displayOrder: 0,
      version: 0,
      products: [
        {
          productId: 'p-1',
          categoryId: 'cat-1',
          mediaId: null,
          name: '아메리카노',
          description: '진한 에스프레소',
          basePrice: 4500,
          imageAltText: null,
          salesEnabled: true,
          soldOut: false,
          stockManaged: false,
          displayOrder: 0,
          version: 0,
          options: [],
        },
        {
          productId: 'p-2',
          categoryId: 'cat-1',
          mediaId: null,
          name: '카페라떼',
          description: null,
          basePrice: 5000,
          imageAltText: null,
          salesEnabled: true,
          soldOut: false,
          stockManaged: false,
          displayOrder: 1,
          version: 0,
          options: [],
        },
      ],
    },
  ],
}

function mountView() {
  return mount(ProductManagementView)
}

describe('ProductManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(getCatalogOverview).mockResolvedValue(structuredClone(overview))
  })

  it('loads products for the first category by default', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('아메리카노')
    expect(wrapper.text()).toContain('카페라떼')
    expect(wrapper.text()).toContain('4,500원')
  })

  it('creates a product with the entered basic info', async () => {
    vi.mocked(createProduct).mockResolvedValue({
      product: { ...overview.categories[0]!.products[0]!, productId: 'p-3', name: '콜드브루' },
      catalogRevision: 2,
    })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.add-button').trigger('click')
    await wrapper.get('#product-name').setValue('콜드브루')
    await wrapper.get('#product-price').setValue('4800')
    await wrapper.get('.product-form').trigger('submit')
    await flushPromises()

    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1', name: '콜드브루', basePrice: 4800 }),
      expect.any(String),
    )
  })

  it('rejects a non-integer price without calling the API', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.add-button').trigger('click')
    await wrapper.get('#product-name').setValue('콜드브루')
    await wrapper.get('#product-price').setValue('4800.5')
    await wrapper.get('.product-form').trigger('submit')
    await flushPromises()

    expect(createProduct).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('0 이상의 정수로 입력해 주세요')
  })

  it('toggles sold-out status for a product', async () => {
    vi.mocked(changeSoldOut).mockResolvedValue({
      product: { ...overview.categories[0]!.products[0]!, soldOut: true },
      catalogRevision: 2,
    })
    const wrapper = mountView()
    await flushPromises()

    const rows = wrapper.findAll('.product-row')
    await rows[0]!.find('button:nth-of-type(3)').trigger('click')
    await flushPromises()

    expect(changeSoldOut).toHaveBeenCalledWith('p-1', { soldOut: true }, 0)
  })

  it('shows a version-conflict panel and offers a reload when saving fails with 409', async () => {
    const { ApiError } = await import('@/api/http')
    vi.mocked(updateProduct).mockRejectedValue(
      new ApiError({ status: 409, code: 'VERSION_CONFLICT', detail: '이미 변경됨', requestId: 'r-1', fieldErrors: [] }),
    )

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.product-row .product-actions button:first-child').trigger('click')
    await wrapper.get('.product-form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('다른 곳에서 먼저 수정됐습니다')
  })
})
