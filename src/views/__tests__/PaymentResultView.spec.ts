import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentApiError, confirmPayment } from '@/api/payment'
import type { PaymentResponse } from '@/api/payment'
import { readRecentPaymentId, savePendingPayment } from '@/payments/pendingPayment'
import PaymentResultView from '@/views/PaymentResultView.vue'

vi.mock('@/api/payment', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/payment')>()
  return { ...original, confirmPayment: vi.fn<typeof original.confirmPayment>() }
})

const payment = {
  id: '33333333-3333-4333-8333-333333333333',
  orderId: '11111111-1111-4111-8111-111111111111',
  providerOrderId: 'provider-order-123',
  amount: '12000',
  currency: 'KRW',
  status: 'PENDING' as const,
} satisfies PaymentResponse

describe('PaymentResultView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    savePendingPayment('flow-1', {
      payment,
      confirmIdempotencyKey: '44444444-4444-4444-8444-444444444444',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.sessionStorage.clear()
  })

  it('validates the Toss redirect and renders success only after backend PAID', async () => {
    vi.mocked(confirmPayment).mockResolvedValue({ ...payment, status: 'PAID' })
    const { wrapper, router } = await mountResult('success', {
      flow: 'flow-1',
      paymentKey: 'payment-key',
      orderId: payment.providerOrderId,
      amount: String(payment.amount),
    })
    await flushPromises()

    expect(confirmPayment).toHaveBeenCalledWith(
      payment.id,
      'payment-key',
      payment.amount,
      '44444444-4444-4444-8444-444444444444',
    )
    expect(wrapper.text()).toContain('결제가 완료되었습니다')
    expect(wrapper.text()).toContain('결제 완료')
    expect(wrapper.text()).not.toContain('PAID')
    expect(router.currentRoute.value.query.paymentKey).toBeUndefined()
    expect(window.sessionStorage.getItem('doro.payment-flow.flow-1')).toBeNull()
    expect(readRecentPaymentId(payment.orderId)).toBe(payment.id)
  })

  it('keeps provider credentials out of session storage', () => {
    const stored = window.sessionStorage.getItem('doro.payment-flow.flow-1')
    expect(stored).not.toContain('payment-key')
    expect(stored).not.toContain('apiBaseUrl')
    expect(stored).not.toContain('orderName')
  })

  it('rejects a tampered pending-payment snapshot before confirmation', async () => {
    sessionStorage.setItem(
      'doro.payment-flow.flow-1',
      JSON.stringify({
        payment: { ...payment, orderId: 'another-order', amount: -1 },
        confirmIdempotencyKey: 'not-a-command-key',
      }),
    )

    const { wrapper } = await mountResult('success', {
      flow: 'flow-1',
      paymentKey: 'payment-key',
      orderId: payment.providerOrderId,
      amount: String(payment.amount),
    })
    await flushPromises()

    expect(confirmPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('진행 중인 결제 정보를 찾을 수 없습니다')
  })

  it('rejects a modified Toss amount before calling backend confirm', async () => {
    const { wrapper } = await mountResult('success', {
      flow: 'flow-1',
      paymentKey: 'payment-key',
      orderId: payment.providerOrderId,
      amount: '1',
    })
    await flushPromises()

    expect(confirmPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('주문 ID 또는 금액')
  })

  it('shows Toss cancellation and never calls backend confirm', async () => {
    const { wrapper } = await mountResult('fail', {
      flow: 'flow-1',
      code: 'PAY_PROCESS_CANCELED',
      message: 'untrusted provider message',
    })
    await flushPromises()

    expect(confirmPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('결제가 취소되었습니다')
    expect(wrapper.text()).not.toContain('untrusted provider message')
  })

  it('does not expose an unknown provider code', async () => {
    const { wrapper } = await mountResult('fail', {
      flow: 'flow-1',
      code: 'untrusted-provider-code',
      message: 'untrusted provider message',
    })
    await flushPromises()

    expect(confirmPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('untrusted-provider-code')
    expect(wrapper.text()).not.toContain('untrusted provider message')
  })

  it('does not re-approve a refreshed callback after its state was cleaned up', async () => {
    window.sessionStorage.clear()
    const { wrapper, router } = await mountResult('success', { flow: 'flow-1' })
    await flushPromises()

    expect(confirmPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('진행 중인 결제 정보를 찾을 수 없습니다')
    expect(router.currentRoute.value.query).toEqual({ flow: 'flow-1' })
  })

  it('returns to the originating POS order with replace navigation', async () => {
    vi.mocked(confirmPayment).mockResolvedValue({ ...payment, status: 'REVIEW_REQUIRED' })
    const { wrapper, router } = await mountResult('success', {
      flow: 'flow-1',
      paymentKey: 'payment-key',
      orderId: payment.providerOrderId,
      amount: String(payment.amount),
    })
    await flushPromises()

    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('pos-orders-detail')
    expect(router.currentRoute.value.params.orderId).toBe(payment.orderId)
  })

  it('shows a retry path for a temporary Edge or Payment confirm failure', async () => {
    vi.mocked(confirmPayment).mockRejectedValue(
      new PaymentApiError(503, { code: 'PAYMENT_UNAVAILABLE' }),
    )
    const { wrapper } = await mountResult('success', {
      flow: 'flow-1',
      paymentKey: 'payment-key',
      orderId: payment.providerOrderId,
      amount: String(payment.amount),
    })
    await flushPromises()

    expect(wrapper.text()).toContain('결제 서비스를 확인할 수 없습니다')
    expect(wrapper.text()).toContain('결제 서비스를 사용할 수 없습니다')
    expect(wrapper.get('button').text()).toBe('승인 다시 시도')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(confirmPayment).toHaveBeenLastCalledWith(
      payment.id,
      'payment-key',
      payment.amount,
      '44444444-4444-4444-8444-444444444444',
    )
  })

  it('does not retry a provider rejection or expose its detail', async () => {
    vi.mocked(confirmPayment).mockRejectedValue(
      new PaymentApiError(400, {
        code: 'PROVIDER_REJECTED',
        detail: 'untrusted provider decline detail',
      }),
    )
    const { wrapper } = await mountResult('success', {
      flow: 'flow-1',
      paymentKey: 'payment-key',
      orderId: payment.providerOrderId,
      amount: String(payment.amount),
    })
    await flushPromises()

    expect(wrapper.text()).toContain('결제 제공자가 요청을 거절했습니다')
    expect(wrapper.text()).not.toContain('untrusted provider decline detail')
    expect(wrapper.text()).not.toContain('승인 다시 시도')
  })
})

async function mountResult(
  outcome: 'success' | 'fail',
  query: Record<string, string>,
): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/payments/toss/success',
        name: 'payment-toss-success',
        component: PaymentResultView,
      },
      {
        path: '/pos/orders',
        name: 'pos-orders',
        component: { template: '<div>orders</div>' },
      },
      {
        path: '/pos/orders/:orderId',
        name: 'pos-orders-detail',
        component: { template: '<div>order</div>' },
      },
      {
        path: '/payments/toss/fail',
        name: 'payment-toss-fail',
        component: PaymentResultView,
      },
      { path: '/payments/test', component: { template: '<div>checkout</div>' } },
      { path: '/', component: { template: '<div>home</div>' } },
    ],
  })
  await router.push({ path: `/payments/toss/${outcome}`, query })
  await router.isReady()
  return {
    wrapper: mount(PaymentResultView, { global: { plugins: [router] } }),
    router,
  }
}
