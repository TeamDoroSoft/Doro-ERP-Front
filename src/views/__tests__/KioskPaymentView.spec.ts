import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentView } from '@/api/payment'
import { saveKioskPaymentFlow } from '@/payments/kioskPaymentFlow'
import KioskPaymentView from '@/views/kiosk/KioskPaymentView.vue'

const api = vi.hoisted(() => ({
  getPayment: vi.fn<(id: string, context?: 'employee' | 'kiosk') => Promise<PaymentView>>(),
  confirmPayment:
    vi.fn<
      (
        id: string,
        paymentKey: string,
        amount: string,
        idempotencyKey: string,
        context?: 'employee' | 'kiosk',
      ) => Promise<PaymentView>
    >(),
}))
vi.mock('@/api/payment', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/payment')>()
  return { ...original, ...api }
})

const orderId = '11111111-1111-4111-8111-111111111111'
const payment: PaymentView = {
  id: '33333333-3333-4333-8333-333333333333',
  orderId,
  providerOrderId: 'kiosk-provider-1',
  amount: '9000',
  currency: 'KRW',
  status: 'PENDING',
}
const confirmKey = '44444444-4444-4444-8444-444444444444'

describe('KioskPaymentView reload recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    saveKioskPaymentFlow({
      order: {
        orderId,
        displayNumber: 104,
        totalAmount: '9000',
        currency: 'KRW',
        status: 'CREATED',
        businessDate: '2026-08-27',
        orderAccessToken: 'short-token',
      },
      payment,
      confirmIdempotencyKey: confirmKey,
      createdAt: Date.now(),
    })
    api.getPayment.mockResolvedValue(payment)
    api.confirmPayment.mockResolvedValue({ ...payment, status: 'PAID' })
  })

  it('restores a full-reload callback, scrubs its query and confirms exactly once', async () => {
    const { wrapper, router } = await mountPayment({
      outcome: 'success',
      paymentKey: 'provider-payment-key',
      orderId: payment.providerOrderId,
      amount: payment.amount,
    })
    await flushPromises()

    expect(api.getPayment).toHaveBeenCalledWith(payment.id, 'kiosk')
    expect(api.confirmPayment).toHaveBeenCalledTimes(1)
    expect(api.confirmPayment).toHaveBeenCalledWith(
      payment.id,
      'provider-payment-key',
      payment.amount,
      confirmKey,
      'kiosk',
    )
    expect(router.currentRoute.value.path).toBe(`/kiosk/orders/${orderId}`)
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.text()).not.toContain('provider-payment-key')
  })

  it('rejects a modified provider amount before confirmation and clears recovery state', async () => {
    const { router } = await mountPayment({
      outcome: 'success',
      paymentKey: 'provider-payment-key',
      orderId: payment.providerOrderId,
      amount: '1',
    })
    await flushPromises()

    expect(api.confirmPayment).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query).toEqual({})
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
  })

  it('uses canonical PAID state after reload without confirming again', async () => {
    api.getPayment.mockResolvedValue({ ...payment, status: 'PAID' })
    const { router } = await mountPayment({})
    await flushPromises()

    expect(api.confirmPayment).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe(`/kiosk/orders/${orderId}`)
  })

  it('does not approve a Toss cancellation or expose its provider message', async () => {
    const { wrapper, router } = await mountPayment({
      outcome: 'fail',
      code: 'PAY_PROCESS_CANCELED',
      message: 'untrusted provider detail',
    })
    await flushPromises()

    expect(api.confirmPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('결제가 취소되었습니다')
    expect(wrapper.text()).not.toContain('untrusted provider detail')
    expect(router.currentRoute.value.query).toEqual({})
  })
})

async function mountPayment(query: Record<string, string>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/kiosk/payments/:paymentId',
        name: 'kiosk-payment',
        component: KioskPaymentView,
      },
      {
        path: '/kiosk/orders/:orderId',
        name: 'kiosk-order',
        component: { template: '<div>order status</div>' },
      },
      { path: '/kiosk/cart', component: { template: '<div>cart</div>' } },
    ],
  })
  await router.push({ path: `/kiosk/payments/${payment.id}`, query })
  await router.isReady()
  const wrapper = mount(KioskPaymentView, {
    global: { plugins: [createPinia(), router] },
  })
  return { wrapper, router }
}
