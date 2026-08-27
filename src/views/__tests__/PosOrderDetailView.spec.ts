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
  totalAmount: '9000',
  currency: 'KRW',
  status: 'CREATED',
  businessDate: '2026-08-17',
  orderAccessToken: null,
}

describe('PosOrderDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    api.getOrder.mockResolvedValue(created)
    api.cancelOrder.mockResolvedValue({ ...created, status: 'CANCELLED' })
    api.completeOrder.mockResolvedValue({ ...created, status: 'COMPLETED' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('cancels only after loading a CREATED order from the server', async () => {
    const wrapper = await mountView()
    expect(wrapper.get('#order-payment-title').text()).toBe('주문 결제')
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
    expect(wrapper.text()).toContain('조리 현황에서 먼저 ‘준비 완료’를 처리해 주세요.')
    expect(wrapper.text()).toContain('최신 주문 정보를 다시 확인했습니다.')
    expect(wrapper.text()).toContain('주문 확정')
  })

  it('explains a 503 dependency failure without exposing its raw detail', async () => {
    api.getOrder.mockResolvedValueOnce({ ...created, status: 'ACCEPTED' })
    api.completeOrder.mockRejectedValueOnce(
      new ApiError(503, {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        detail: 'internal queue host name',
      }),
    )
    const wrapper = await mountView()
    await findButton(wrapper, '주문 완료').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      '조리 준비 상태를 확인할 수 없어 주문을 완료하지 못했습니다.',
    )
    expect(wrapper.text()).not.toContain('internal queue host name')
  })

  it('uses the generic completion message for an internal server error', async () => {
    api.getOrder.mockResolvedValueOnce({ ...created, status: 'ACCEPTED' })
    api.completeOrder.mockRejectedValueOnce(
      new ApiError(500, {
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        detail: 'internal stack trace',
      }),
    )
    const wrapper = await mountView()
    await findButton(wrapper, '주문 완료').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('주문 완료를 처리하지 못했습니다.')
    expect(wrapper.text()).not.toContain('internal stack trace')
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
