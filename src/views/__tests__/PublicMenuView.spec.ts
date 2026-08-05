import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PublicMenuView from '../PublicMenuView.vue'
import { getPublishedMenu } from '@/api/catalog'
import type { PublishedMenu } from '@/types/catalog'

vi.mock('@/api/catalog', () => ({
  getPublishedMenu: vi.fn<typeof getPublishedMenu>(),
}))

const menu: PublishedMenu = {
  catalogRevision: 1,
  categories: [
    {
      categoryId: 'cat-1',
      name: '커피',
      products: [
        {
          productId: 'p-1',
          name: '아메리카노',
          description: '진한 에스프레소',
          basePrice: 4500,
          imageUrl: null,
          imageAltText: null,
          soldOut: false,
          orderable: true,
          options: [{ optionId: 'opt-1', name: '샷 추가', additionalPrice: 500 }],
        },
      ],
    },
  ],
}

describe('PublicMenuView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders categories, products, and options from the published menu', async () => {
    vi.mocked(getPublishedMenu).mockResolvedValue(structuredClone(menu))

    const wrapper = mount(PublicMenuView)
    await flushPromises()

    expect(wrapper.text()).toContain('커피')
    expect(wrapper.text()).toContain('아메리카노')
    expect(wrapper.text()).toContain('4,500원')
    expect(wrapper.text()).toContain('샷 추가')
  })

  it('shows a retry panel when the menu fails to load', async () => {
    const { ApiError } = await import('@/api/http')
    vi.mocked(getPublishedMenu).mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', detail: '서버에 연결할 수 없습니다.', requestId: '', fieldErrors: [] }),
    )

    const wrapper = mount(PublicMenuView)
    await flushPromises()

    expect(wrapper.text()).toContain('서버에 연결할 수 없습니다.')
    expect(wrapper.find('button').exists()).toBe(true)
  })
})
