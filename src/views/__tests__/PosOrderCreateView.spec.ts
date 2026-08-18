import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import PosOrderCreateView from '@/views/PosOrderCreateView.vue'
import type * as CatalogApi from '@/api/catalog'
import type * as OrderApi from '@/api/order'
import type * as TableApi from '@/api/table'

const catalogApi = vi.hoisted(() => ({
  getSalesMenu: vi.fn<typeof CatalogApi.getSalesMenu>(),
}))
const orderApi = vi.hoisted(() => ({ createOrder: vi.fn<typeof OrderApi.createOrder>() }))
const tableApi = vi.hoisted(() => ({ getTables: vi.fn<typeof TableApi.getTables>() }))
vi.mock('@/api/catalog', () => catalogApi)
vi.mock('@/api/order', () => orderApi)
vi.mock('@/api/table', () => tableApi)

const menu = {
  currency: 'KRW',
  categories: [
    {
      categoryId: 'category-1',
      name: '커피',
      displayOrder: 1,
      products: [
        {
          productId: 'product-1',
          name: '아메리카노',
          description: '',
          price: '4500',
          displayOrder: 1,
        },
      ],
    },
  ],
}
const table = {
  id: 'table-1',
  tableNumber: 'A-1',
  displayName: '창가',
  status: 'ACTIVE' as const,
  version: '0',
}
const createdOrder = {
  orderId: 'order-1',
  displayNumber: 1,
  totalAmount: '4500',
  currency: 'KRW',
  status: 'CREATED' as const,
  businessDate: '2026-08-17',
  orderAccessToken: null,
}

describe('PosOrderCreateView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    catalogApi.getSalesMenu.mockResolvedValue(menu)
    tableApi.getTables.mockResolvedValue([table])
    orderApi.createOrder.mockResolvedValue(createdOrder)
  })

  it('requires an active table for dine-in creation', async () => {
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.findAll('input[name="serviceType"]')[0]!.setValue()
    await flushPromises()
    await findButton(wrapper, '담기').trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('활성 테이블을 선택해야 합니다.')
    await wrapper.get('#order-table').setValue('table-1')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(orderApi.createOrder).toHaveBeenCalledWith(
      {
        orderChannel: 'POS',
        serviceType: 'DINE_IN',
        tableId: 'table-1',
        lines: [{ productId: 'product-1', quantity: 1 }],
      },
      expect.any(String),
    )
  })

  it('omits tableId from takeout creation', async () => {
    const wrapper = await mountView()
    await flushPromises()
    await findButton(wrapper, '담기').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(orderApi.createOrder).toHaveBeenCalledWith(
      {
        orderChannel: 'POS',
        serviceType: 'TAKEOUT',
        lines: [{ productId: 'product-1', quantity: 1 }],
      },
      expect.any(String),
    )
    expect(tableApi.getTables).not.toHaveBeenCalled()
  })

  it('keeps the same idempotency key for retry after a network failure', async () => {
    orderApi.createOrder
      .mockRejectedValueOnce(new ApiError(0, { detail: '연결 실패' }))
      .mockResolvedValueOnce(createdOrder)
    const wrapper = await mountView()
    await flushPromises()
    await findButton(wrapper, '담기').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('같은 주문 다시 시도')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const firstKey = orderApi.createOrder.mock.calls[0]?.[1]
    expect(orderApi.createOrder.mock.calls[1]?.[1]).toBe(firstKey)
  })

  it('explains a payload-conflict response without exposing problem details', async () => {
    orderApi.createOrder.mockRejectedValue(
      new ApiError(409, { code: 'IDP_CONFLICT', detail: 'raw tenant data' }),
    )
    const wrapper = await mountView()
    await flushPromises()
    await findButton(wrapper, '담기').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('같은 요청 키가 다른 주문에 사용되었습니다.')
    expect(wrapper.text()).not.toContain('raw tenant data')
  })

  async function mountView() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/pos/orders/new', component: PosOrderCreateView },
        {
          path: '/pos/orders/:orderId',
          name: 'pos-orders-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/pos/orders/new')
    await router.isReady()
    return mount(PosOrderCreateView, { global: { plugins: [router] } })
  }

  function findButton(wrapper: ReturnType<typeof mount>, label: string) {
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
    if (!button) throw new Error(`button not found: ${label}`)
    return button
  }
})
