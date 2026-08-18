import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { ApiError } from '@/api/http'
import type { OrderListQuery, OrderResponse } from '@/api/order'
import PosOrdersView from '@/views/PosOrdersView.vue'

const api = vi.hoisted(() => ({
  getOrders: vi.fn<(query?: OrderListQuery) => Promise<OrderResponse[]>>(),
}))
vi.mock('@/api/order', () => api)

const order: OrderResponse = {
  orderId: 'order-1',
  displayNumber: 7,
  totalAmount: '9000',
  currency: 'KRW',
  status: 'CREATED',
  businessDate: '2026-08-17',
  orderAccessToken: null,
}

describe('PosOrdersView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getOrders.mockResolvedValue([order])
  })

  it('queries only an explicitly selected business date and status', async () => {
    const wrapper = await mountView()
    expect(api.getOrders).toHaveBeenLastCalledWith({ businessDate: undefined, status: undefined })

    await wrapper.get('input[name="businessDate"]').setValue('2026-08-17')
    await wrapper.get('select[name="status"]').setValue('CREATED')
    await flushPromises()
    expect(api.getOrders).toHaveBeenLastCalledWith({
      businessDate: '2026-08-17',
      status: 'CREATED',
    })
  })

  it('renders empty and retryable error states', async () => {
    api.getOrders.mockResolvedValueOnce([])
    const empty = await mountView()
    expect(empty.text()).toContain('주문이 없습니다')

    api.getOrders.mockRejectedValueOnce(
      new ApiError(503, { status: 503, detail: 'internal upstream detail' }),
    )
    const failed = await mountView()
    expect(failed.get('[role="alert"]').text()).toContain('일시적으로 사용할 수 없습니다.')
    expect(failed.text()).not.toContain('internal upstream detail')
    expect(failed.text()).toContain('다시 시도')
  })

  async function mountView() {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/pos/orders', name: 'pos-orders', component: PosOrdersView },
        {
          path: '/pos/orders/:orderId',
          name: 'pos-orders-detail',
          component: { template: '<div />' },
        },
        { path: '/pos/orders/new', name: 'pos-orders-new', component: { template: '<div />' } },
      ],
    })
    await router.push('/pos/orders')
    await router.isReady()
    const wrapper = mount(PosOrdersView, { global: { plugins: [router] } })
    await flushPromises()
    return wrapper
  }
})
