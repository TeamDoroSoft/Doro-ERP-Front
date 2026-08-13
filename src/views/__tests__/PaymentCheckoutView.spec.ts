import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentApiError, createPayment } from '@/api/payment'
import { requestTossPayment } from '@/payments/tossPayment'
import PaymentCheckoutView from '@/views/PaymentCheckoutView.vue'

vi.mock('@/api/payment', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/payment')>()
  return { ...original, createPayment: vi.fn<typeof original.createPayment>() }
})

vi.mock('@/payments/tossPayment', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/payments/tossPayment')>()
  return { ...original, requestTossPayment: vi.fn<typeof original.requestTossPayment>() }
})

const payment = {
  id: '33333333-3333-4333-8333-333333333333',
  orderId: '11111111-1111-4111-8111-111111111111',
  providerOrderId: 'provider-order-123',
  amount: 12_000,
  currency: 'KRW',
  status: 'PENDING',
}

describe('PaymentCheckoutView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_TOSS_CLIENT_KEY', 'test_gck_client')
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    window.sessionStorage.clear()
  })

  it('creates through Edge and opens Toss with backend-owned payment data', async () => {
    vi.mocked(createPayment).mockResolvedValue(payment)
    vi.mocked(requestTossPayment).mockResolvedValue(undefined)
    const wrapper = await mountCheckout()

    await submitPaymentForm(wrapper)
    await flushPromises()

    expect(createPayment).toHaveBeenCalledWith(
      '',
      payment.orderId,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    expect(requestTossPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientKey: 'test_gck_client',
        amount: payment.amount,
        currency: 'KRW',
        providerOrderId: payment.providerOrderId,
      }),
    )
    expect(wrapper.text()).toContain('PENDING')
    expect(Object.keys(window.sessionStorage)).toHaveLength(1)
  })

  it('blocks duplicate clicks while payment creation is in progress', async () => {
    let resolveCreate!: (value: typeof payment) => void
    vi.mocked(createPayment).mockImplementation(
      () => new Promise((resolve) => (resolveCreate = resolve)),
    )
    const wrapper = await mountCheckout()
    const button = wrapper.get('button')

    await submitPaymentForm(wrapper)
    await submitPaymentForm(wrapper)

    expect(createPayment).toHaveBeenCalledTimes(1)
    expect(button.attributes('disabled')).toBeDefined()

    resolveCreate(payment)
    await flushPromises()
  })

  it('does not create a backend payment when the Toss client key is missing', async () => {
    vi.stubEnv('VITE_TOSS_CLIENT_KEY', '')
    const wrapper = await mountCheckout()

    await submitPaymentForm(wrapper)

    expect(createPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('VITE_TOSS_CLIENT_KEY')
  })

  it('shows a distinct backend payment creation failure', async () => {
    vi.mocked(createPayment).mockRejectedValue(
      new PaymentApiError(422, { code: 'ORDER_NOT_ELIGIBLE' }),
    )
    const wrapper = await mountCheckout()

    await submitPaymentForm(wrapper)
    await flushPromises()

    expect(requestTossPayment).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('결제 생성 실패')
    expect(wrapper.text()).toContain('현재 결제할 수 없는 주문')
  })
})

async function mountCheckout() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/payments/test', component: PaymentCheckoutView },
      { path: '/', component: { template: '<div>home</div>' } },
    ],
  })
  await router.push({
    path: '/payments/test',
    query: {
      orderId: payment.orderId,
      orderNumber: 'A-001',
      amount: '12000.00',
      currency: 'KRW',
    },
  })
  await router.isReady()
  return mount(PaymentCheckoutView, { global: { plugins: [router] } })
}

async function submitPaymentForm(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('form').trigger('submit')
}
