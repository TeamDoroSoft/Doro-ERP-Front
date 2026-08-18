import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentResponse } from '@/api/payment'
import type { OrderResponse } from '@/api/order'
import type { PendingPayment } from '@/payments/pendingPayment'
import type { TossPaymentRequest } from '@/payments/tossPayment'

const {
  createPayment,
  createPaymentIdempotencyKey,
  getPayment,
  cancelPayment,
  requestTossPayment,
  savePendingPayment,
  saveRecentPaymentId,
} = vi.hoisted(() => ({
  createPayment: vi.fn<(orderId: string, key: string) => Promise<PaymentResponse>>(),
  createPaymentIdempotencyKey: vi.fn<() => string>(),
  getPayment: vi.fn<(paymentId: string) => Promise<PaymentResponse>>(),
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
  totalAmount: 1,
  currency: 'KRW',
  status: 'CREATED',
  businessDate: '2026-08-17',
  orderAccessToken: null,
}
const payment: PaymentResponse = {
  id: 'payment-1',
  orderId: order.orderId,
  providerOrderId: 'server-order-1',
  amount: 12000,
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
    requestTossPayment.mockResolvedValue(undefined)
  })

  it('checks Toss configuration before creating a payment', async () => {
    vi.stubEnv('VITE_TOSS_CLIENT_KEY', '')
    const wrapper = mount(OrderPaymentPanel, { props: { order } })
    await wrapper.get('.payment-panel__primary').trigger('click')

    expect(createPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('테스트 결제 설정')
  })

  it('uses only server-generated Toss identifiers and retains the recent payment lookup', async () => {
    const wrapper = mount(OrderPaymentPanel, { props: { order } })
    await wrapper.get('.payment-panel__primary').trigger('click')
    await flushPromises()

    expect(createPayment).toHaveBeenCalledWith(order.orderId, 'create-key')
    expect(saveRecentPaymentId).toHaveBeenCalledWith(order.orderId, payment.id)
    expect(savePendingPayment).toHaveBeenCalledWith(
      'flow-id',
      expect.objectContaining({ confirmIdempotencyKey: 'confirm-key' }),
    )
    expect(requestTossPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 12000, providerOrderId: 'server-order-1' }),
    )
  })
})
