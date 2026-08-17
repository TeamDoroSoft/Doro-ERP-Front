import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { ApiError } from '@/api/http'
import type { OrderResponse } from '@/api/order'
import PosOrderDetailView from '@/views/PosOrderDetailView.vue'

const api = vi.hoisted(() => ({
  getOrder: vi.fn<(id: string) => Promise<OrderResponse>>(),
  cancelOrder: vi.fn<(id: string) => Promise<OrderResponse>>(),
  completeOrder: vi.fn<(id: string) => Promise<OrderResponse>>(),
}))
vi.mock('@/api/order', () => api)

const created: OrderResponse = {
  orderId: 'order-1',
  displayNumber: 7,
  totalAmount: 9000,
  currency: 'KRW',
  status: 'CREATED',
  businessDate: '2026-08-17',
  orderAccessToken: null,
}

describe('PosOrderDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getOrder.mockResolvedValue(created)
    api.cancelOrder.mockResolvedValue({ ...created, status: 'CANCELLED' })
    api.completeOrder.mockResolvedValue({ ...created, status: 'COMPLETED' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('cancels only after loading a CREATED order from the server', async () => {
    const wrapper = await mountView()
    await findButton(wrapper, '주문 취소').trigger('click')
    await flushPromises()
    expect(api.cancelOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('취소')
  })

  it('re-queries server state when completion conflicts with READY verification', async () => {
    api.getOrder
      .mockResolvedValueOnce({ ...created, status: 'ACCEPTED' })
      .mockResolvedValueOnce({ ...created, status: 'ACCEPTED' })
    api.completeOrder.mockRejectedValue(
      new ApiError(409, { status: 409, code: 'INVALID_STATE', detail: 'fulfillment is not READY' }),
    )
    const wrapper = await mountView()
    await findButton(wrapper, '주문 완료').trigger('click')
    await flushPromises()
    expect(api.completeOrder).toHaveBeenCalledWith('order-1')
    expect(api.getOrder).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('최신 주문 정보를 다시 확인했습니다.')
    expect(wrapper.text()).toContain('주문 접수')
  })

  it('does not expose raw unavailable-service detail', async () => {
    api.getOrder.mockRejectedValueOnce(
      new ApiError(503, { status: 503, detail: 'internal queue host name' }),
    )
    const wrapper = await mountView()
    expect(wrapper.get('[role="alert"]').text()).toContain('일시적으로 사용할 수 없습니다.')
    expect(wrapper.text()).not.toContain('internal queue host name')
  })

  async function mountView() {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/pos/orders', name: 'pos-orders', component: { template: '<div />' } },
        { path: '/pos/orders/:orderId', name: 'pos-orders-detail', component: PosOrderDetailView },
      ],
    })
    await router.push('/pos/orders/order-1')
    await router.isReady()
    const wrapper = mount(PosOrderDetailView, { global: { plugins: [router] } })
    await flushPromises()
    return wrapper
  }
  function findButton(wrapper: ReturnType<typeof mount>, label: string) {
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
    if (!button) throw new Error(`button not found: ${label}`)
    return button
  }
})
