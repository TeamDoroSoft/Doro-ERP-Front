import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentApiError, confirmPayment } from '@/api/payment'
import { savePendingPayment } from '@/payments/pendingPayment'
import PaymentResultView from '@/views/PaymentResultView.vue'

vi.mock('@/api/payment', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/payment')>()
  return { ...original, confirmPayment: vi.fn<typeof original.confirmPayment>() }
})

const payment = {
  id: '33333333-3333-4333-8333-333333333333',
  orderId: '11111111-1111-4111-8111-111111111111',
  providerOrderId: 'provider-order-123',
  amount: 12_000,
  currency: 'KRW',
  status: 'PENDING',
}

describe('PaymentResultView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    savePendingPayment('flow-1', {
      apiBaseUrl: 'https://edge.example.test',
      payment,
      orderName: '주문 A-001',
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
      'https://edge.example.test',
      payment.id,
      'payment-key',
      payment.amount,
      '44444444-4444-4444-8444-444444444444',
    )
    expect(wrapper.text()).toContain('결제가 완료되었습니다')
    expect(wrapper.text()).toContain('PAID')
    expect(router.currentRoute.value.query.paymentKey).toBeUndefined()
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
