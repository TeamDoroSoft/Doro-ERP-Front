import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { requestTossPayment } from '@/payments/tossPayment'

const requestPayment = vi.fn<(input: unknown) => Promise<void>>()

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: '@@ANONYMOUS',
  loadTossPayments: vi.fn<(clientKey: string) => Promise<unknown>>(async () => ({
    payment: vi.fn<() => { requestPayment: typeof requestPayment }>(() => ({ requestPayment })),
  })),
}))

describe('Toss payment adapter', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses the official SDK with only the test client request fields', async () => {
    requestPayment.mockResolvedValue(undefined)

    await requestTossPayment({
      clientKey: 'test_ck_client',
      amount: 12_000,
      currency: 'KRW',
      providerOrderId: 'provider-order-123',
      orderName: '주문 A-001',
      successUrl: 'https://front.example/payments/toss/success?flow=flow-1',
      failUrl: 'https://front.example/payments/toss/fail?flow=flow-1',
    })

    expect(loadTossPayments).toHaveBeenCalledWith('test_ck_client')
    expect(requestPayment).toHaveBeenCalledWith({
      method: 'CARD',
      amount: { currency: 'KRW', value: 12_000 },
      orderId: 'provider-order-123',
      orderName: '주문 A-001',
      successUrl: 'https://front.example/payments/toss/success?flow=flow-1',
      failUrl: 'https://front.example/payments/toss/fail?flow=flow-1',
    })
  })
})
