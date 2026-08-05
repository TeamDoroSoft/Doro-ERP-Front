import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CategoryManagementView from '../CategoryManagementView.vue'
import {
  createCategory,
  getCatalogOverview,
  replaceCategoryOrder,
  updateCategory,
} from '@/api/catalog'
import type { CatalogOverview } from '@/types/catalog'

vi.mock('@/api/catalog', () => ({
  getCatalogOverview: vi.fn<typeof getCatalogOverview>(),
  createCategory: vi.fn<typeof createCategory>(),
  updateCategory: vi.fn<typeof updateCategory>(),
  replaceCategoryOrder: vi.fn<typeof replaceCategoryOrder>(),
}))

const overview: CatalogOverview = {
  catalogRevision: 1,
  categories: [
    {
      categoryId: 'cat-1',
      name: '커피',
      displayOrder: 0,
      version: 0,
      products: [],
    },
    {
      categoryId: 'cat-2',
      name: '차',
      displayOrder: 1,
      version: 0,
      products: [{ productId: 'p-1' } as never],
    },
  ],
}

function mountView() {
  return mount(CategoryManagementView, {
    global: { stubs: { RouterLink: true } },
  })
}

describe('CategoryManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(getCatalogOverview).mockResolvedValue(structuredClone(overview))
  })

  it('loads categories and shows their product counts', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(getCatalogOverview).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('커피')
    expect(wrapper.text()).toContain('차')
    expect(wrapper.text()).toContain('상품 1개')
  })

  it('creates a category with the trimmed name', async () => {
    vi.mocked(createCategory).mockResolvedValue({
      category: { categoryId: 'cat-3', name: '디저트', displayOrder: 2, version: 0 },
      catalogRevision: 2,
    })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('#new-category-name').setValue('  디저트  ')
    await wrapper.get('.create-form').trigger('submit')
    await flushPromises()

    expect(createCategory).toHaveBeenCalledWith({ name: '디저트' }, expect.any(String))
    expect(getCatalogOverview).toHaveBeenCalledTimes(2)
  })

  it('rejects a blank category name without calling the API', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.create-form').trigger('submit')
    await flushPromises()

    expect(createCategory).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('1~60자로 입력해 주세요')
  })

  it('moves a category up by swapping its order and calling replaceCategoryOrder', async () => {
    vi.mocked(replaceCategoryOrder).mockResolvedValue({ catalogRevision: 2 })
    const wrapper = mountView()
    await flushPromises()

    const upButtons = wrapper.findAll('button[aria-label$="위로 이동"]')
    await upButtons[1]!.trigger('click')
    await flushPromises()

    expect(replaceCategoryOrder).toHaveBeenCalledWith({ categoryIds: ['cat-2', 'cat-1'] }, 1)
  })
})
