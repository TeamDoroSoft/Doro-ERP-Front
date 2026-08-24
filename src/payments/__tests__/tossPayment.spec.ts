import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { requestTossPayment } from '@/payments/tossPayment'

const setAmount = vi.fn<(input: unknown) => Promise<void>>()
const requestPayment = vi.fn<(input: unknown) => Promise<void>>()
const onPaymentWindow = vi.fn<
  (eventName: string, callback: (input: unknown) => Promise<void>) => void
>()
const renderPaymentWindow = vi.fn<() => Promise<{ on: typeof onPaymentWindow }>>()
const widgets = vi.fn<
  (input: unknown) => { setAmount: typeof setAmount; renderPaymentWindow: typeof renderPaymentWindow; requestPayment: typeof requestPayment }
>(() => ({ setAmount, renderPaymentWindow, requestPayment }))

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: '@@ANONYMOUS',
  loadTossPayments: vi.fn<(clientKey: string) => Promise<unknown>>(async () => ({
    widgets,
  })),
}))

describe('Toss payment adapter', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses the official SDK with only the test client request fields', async () => {
    setAmount.mockResolvedValue(undefined)
    requestPayment.mockResolvedValue(undefined)
    renderPaymentWindow.mockResolvedValue({ on: onPaymentWindow })

    await requestTossPayment({
      clientKey: 'test_gck_client',
      amount: '12000',
      currency: 'KRW',
      providerOrderId: 'provider-order-123',
      orderName: '주문 A-001',
      successUrl: 'https://front.example/payments/toss/success?flow=flow-1',
      failUrl: 'https://front.example/payments/toss/fail?flow=flow-1',
    })

    expect(loadTossPayments).toHaveBeenCalledWith('test_gck_client')
    expect(widgets).toHaveBeenCalledWith({ customerKey: '@@ANONYMOUS' })
    expect(setAmount).toHaveBeenCalledWith({ currency: 'KRW', value: 12_000 })
    expect(renderPaymentWindow).toHaveBeenCalledOnce()
    expect(onPaymentWindow).toHaveBeenCalledWith('paymentRequest', expect.any(Function))

    const paymentRequestHandler = onPaymentWindow.mock.calls[0]?.[1]
    expect(paymentRequestHandler).toBeDefined()
    await paymentRequestHandler?.({ paymentMethod: { code: 'CARD' } })
    expect(requestPayment).toHaveBeenCalledWith({
      orderId: 'provider-order-123',
      orderName: '주문 A-001',
      successUrl: 'https://front.example/payments/toss/success?flow=flow-1',
      failUrl: 'https://front.example/payments/toss/fail?flow=flow-1',
    })
  })

  it('rejects non-widget and live client keys before loading the SDK', async () => {
    await expect(
      requestTossPayment({
        clientKey: 'live_gck_not_allowed',
        amount: '12000',
        currency: 'KRW',
        providerOrderId: 'provider-order-123',
        orderName: '주문 A-001',
        successUrl: 'https://front.example/payments/toss/success',
        failUrl: 'https://front.example/payments/toss/fail',
      }),
    ).rejects.toThrow('결제를 시작할 수 없습니다')

    expect(loadTossPayments).not.toHaveBeenCalled()
  })

  it.each(['9007199254740992', '9007199254740993', '0', '12000.5'])(
    'never opens the provider window for an amount the SDK cannot represent exactly: %s',
    async (amount) => {
      await expect(
        requestTossPayment({
          clientKey: 'test_gck_client',
          amount,
          currency: 'KRW',
          providerOrderId: 'provider-order-123',
          orderName: '주문 A-001',
          successUrl: 'https://front.example/payments/toss/success',
          failUrl: 'https://front.example/payments/toss/fail',
        }),
      ).rejects.toThrow('결제 가능한 금액 범위를 확인해 주세요')

      expect(loadTossPayments).not.toHaveBeenCalled()
      expect(setAmount).not.toHaveBeenCalled()
    },
  )

  it('passes the largest safely representable amount through unchanged', async () => {
    setAmount.mockResolvedValue(undefined)
    renderPaymentWindow.mockResolvedValue({ on: onPaymentWindow })

    await requestTossPayment({
      clientKey: 'test_gck_client',
      amount: '9007199254740991',
      currency: 'KRW',
      providerOrderId: 'provider-order-123',
      orderName: '주문 A-001',
      successUrl: 'https://front.example/payments/toss/success',
      failUrl: 'https://front.example/payments/toss/fail',
    })

    expect(setAmount).toHaveBeenCalledWith({ currency: 'KRW', value: 9007199254740991 })
  })
})
