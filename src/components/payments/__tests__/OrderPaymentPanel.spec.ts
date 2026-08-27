import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentApiError, type PaymentResponse } from '@/api/payment'
import type { OrderResponse } from '@/api/order'
import type { PendingPayment } from '@/payments/pendingPayment'
import type { TossPaymentRequest } from '@/payments/tossPayment'

const {
  createPayment,
  createPaymentIdempotencyKey,
  getPayment,
  getPaymentByOrder,
  cancelPayment,
  requestTossPayment,
  savePendingPayment,
  saveRecentPaymentId,
} = vi.hoisted(() => ({
  createPayment: vi.fn<(orderId: string, key: string) => Promise<PaymentResponse>>(),
  createPaymentIdempotencyKey: vi.fn<() => string>(),
  getPayment: vi.fn<(paymentId: string) => Promise<PaymentResponse>>(),
  getPaymentByOrder: vi.fn<(orderId: string) => Promise<PaymentResponse>>(),
  cancelPayment:
    vi.fn<(paymentId: string, reasonCode: string, key: string) => Promise<PaymentResponse>>(),
  requestTossPayment: vi.fn<(request: TossPaymentRequest) => Promise<void>>(),
  savePendingPayment: vi.fn<(flowId: string, pending: PendingPayment) => void>(),
  saveRecentPaymentId: vi.fn<(orderId: string, paymentId: string) => void>(),
}))

vi.mock('@/api/payment', async () => {
  const actual = await vi.importActual<typeof import('@/api/payment')>('@/api/payment')
  return {
    ...actual,
    createPayment,
    getPayment,
    getPaymentByOrder,
    cancelPayment,
    createPaymentIdempotencyKey,
  }
})
vi.mock('@/payments/pendingPayment', () => ({ savePendingPayment, saveRecentPaymentId }))
vi.mock('@/payments/tossPayment', () => ({
  requestTossPayment,
  tossPaymentErrorMessage: () => '결제창을 열지 못했습니다.',
}))

import OrderPaymentPanel from '@/components/payments/OrderPaymentPanel.vue'

const order: OrderResponse = {
  orderId: 'order-1',
  displayNumber: 42,
  totalAmount: '12000',
  currency: 'KRW',
  status: 'CREATED',
  businessDate: '2026-08-17',
  orderAccessToken: null,
}
const payment: PaymentResponse = {
  id: 'payment-1',
  orderId: order.orderId,
  providerOrderId: 'server-order-1',
  amount: '12000',
  currency: 'KRW',
  status: 'PENDING',
}

describe('OrderPaymentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_TOSS_CLIENT_KEY', 'test_gck_123456')
    createPaymentIdempotencyKey
      .mockReturnValueOnce('create-key')
      .mockReturnValueOnce('flow-id')
      .mockReturnValueOnce('confirm-key')
    createPayment.mockResolvedValue(payment)
    getPayment.mockResolvedValue(payment)
    getPaymentByOrder.mockRejectedValue(
      new PaymentApiError(404, { code: 'PAYMENT_NOT_FOUND', detail: 'raw not found detail' }),
    )
    requestTossPayment.mockResolvedValue(undefined)
  })

  it('checks Toss configuration before creating a payment', async () => {
    vi.stubEnv('VITE_TOSS_CLIENT_KEY', '')
    const wrapper = mount(OrderPaymentPanel, { props: { order } })
    await flushPromises()
    await wrapper.get('.payment-panel__primary').trigger('click')

    expect(createPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('결제를 시작할 수 없습니다')
  })

  it('uses only server-generated Toss identifiers and retains the recent payment lookup', async () => {
    const wrapper = mount(OrderPaymentPanel, { props: { order } })
    await flushPromises()
    await wrapper.get('.payment-panel__primary').trigger('click')
    await flushPromises()

    expect(createPayment).toHaveBeenCalledWith(order.orderId, 'create-key')
    expect(saveRecentPaymentId).toHaveBeenCalledWith(order.orderId, payment.id)
    expect(savePendingPayment).toHaveBeenCalledWith(
      'flow-id',
      expect.objectContaining({ confirmIdempotencyKey: 'confirm-key' }),
    )
    expect(requestTossPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '12000', providerOrderId: 'server-order-1' }),
    )
  })

  it('resumes a discovered PENDING payment without creating another payment', async () => {
    getPaymentByOrder.mockResolvedValue(payment)
    const wrapper = mount(OrderPaymentPanel, { props: { order } })
    await flushPromises()

    const resume = wrapper.findAll('button').find((button) => button.text() === '결제 계속하기')!
    await resume.trigger('click')
    await flushPromises()

    expect(getPaymentByOrder).toHaveBeenCalledWith(order.orderId)
    expect(createPayment).not.toHaveBeenCalled()
    expect(savePendingPayment).toHaveBeenCalledWith(
      'create-key',
      expect.objectContaining({
        payment,
        confirmIdempotencyKey: 'flow-id',
      }),
    )
    expect(requestTossPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: payment.amount, providerOrderId: payment.providerOrderId }),
    )
  })

  it('blocks duplicate checkout flows while the Toss window is opening', async () => {
    let finishOpening!: () => void
    getPaymentByOrder.mockResolvedValue(payment)
    requestTossPayment.mockImplementation(
      () => new Promise<void>((resolve) => (finishOpening = resolve)),
    )
    const wrapper = mount(OrderPaymentPanel, { props: { order } })
    await flushPromises()

    const resume = wrapper.findAll('button').find((button) => button.text() === '결제 계속하기')!
    void resume.trigger('click')
    await flushPromises()
    expect(resume.attributes('disabled')).toBeDefined()
    await resume.trigger('click')

    expect(savePendingPayment).toHaveBeenCalledTimes(1)
    expect(requestTossPayment).toHaveBeenCalledTimes(1)
    finishOpening()
    await flushPromises()
  })

  it.each(['REVIEW_REQUIRED', 'PAID', 'FAILED', 'CANCELLED'] as const)(
    'does not reopen Toss for a discovered %s payment',
    async (status) => {
      getPaymentByOrder.mockResolvedValue({ ...payment, status })
      const wrapper = mount(OrderPaymentPanel, { props: { order } })
      await flushPromises()

      expect(wrapper.findAll('button').some((button) => button.text() === '결제 계속하기')).toBe(
        false,
      )
      expect(createPayment).not.toHaveBeenCalled()
      expect(requestTossPayment).not.toHaveBeenCalled()
    },
  )

  it('does not report an initial or repeated PAID snapshot as a status transition', async () => {
    const paid = { ...payment, status: 'PAID' as const }
    const cancelled = { ...payment, status: 'CANCELLED' as const }
    getPayment.mockResolvedValue(paid)
    cancelPayment.mockResolvedValue(cancelled)

    const wrapper = mount(OrderPaymentPanel, {
      props: { order: { ...order, status: 'ACCEPTED' }, recentPaymentId: payment.id },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('결제 완료')
    expect(wrapper.findAll('button').some((button) => button.text() === '전액 취소')).toBe(true)
    expect(wrapper.emitted('payment-updated')).toBeUndefined()

    await wrapper.get('.payment-panel__heading button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('payment-updated')).toBeUndefined()

    await wrapper.get('.payment-panel__actions button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('payment-updated')).toEqual([
      [payment.id, 'CANCELLED', 'PAID'],
    ])
  })
})
