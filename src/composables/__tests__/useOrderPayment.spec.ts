import { nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OrderResponse } from '@/api/order'
import type { PaymentResponse } from '@/api/payment'
import { useOrderPayment, type OrderPaymentApi } from '@/composables/useOrderPayment'

const order: OrderResponse = {
  orderId: 'order-1',
  displayNumber: 42,
  totalAmount: 12000,
  currency: 'KRW',
  status: 'CREATED',
  businessDate: '2026-08-17',
  orderAccessToken: null,
}
const pending: PaymentResponse = {
  id: 'payment-1',
  orderId: order.orderId,
  providerOrderId: 'provider-1',
  amount: 12000,
  currency: 'KRW',
  status: 'PENDING',
}

function api(overrides: Partial<OrderPaymentApi> = {}): OrderPaymentApi {
  return {
    createPayment: vi.fn<OrderPaymentApi['createPayment']>().mockResolvedValue(pending),
    getPayment: vi.fn<OrderPaymentApi['getPayment']>().mockResolvedValue(pending),
    cancelPayment: vi
      .fn<OrderPaymentApi['cancelPayment']>()
      .mockResolvedValue({ ...pending, status: 'CANCELLED' }),
    ...overrides,
  }
}

describe('useOrderPayment', () => {
  afterEach(() => vi.useRealTimers())

  it('creates only a CREATED order, blocks duplicate clicks, and retains the create key for retries', async () => {
    let rejectFirst!: (reason: unknown) => void
    const createPayment = vi
      .fn<OrderPaymentApi['createPayment']>()
      .mockImplementationOnce(() => new Promise((_, reject) => (rejectFirst = reject)))
      .mockResolvedValueOnce(pending)
    const model = useOrderPayment(() => order, {
      api: api({ createPayment }),
      createKey: vi
        .fn<() => string>()
        .mockReturnValueOnce('create-1')
        .mockReturnValueOnce('cancel-1'),
    })

    const first = model.create()
    await nextTick()
    await model.create()
    expect(createPayment).toHaveBeenCalledTimes(1)
    rejectFirst(new Error('offline'))
    await first
    await model.create()

    expect(createPayment).toHaveBeenNthCalledWith(1, order.orderId, 'create-1')
    expect(createPayment).toHaveBeenNthCalledWith(2, order.orderId, 'create-1')
  })

  it('uses the server PENDING amount and provider order id only when the create contract matches', async () => {
    const model = useOrderPayment(() => order, { api: api() })
    const created = await model.create()
    expect(created).toEqual(pending)

    const invalid = useOrderPayment(() => order, {
      api: api({
        createPayment: vi
          .fn<OrderPaymentApi['createPayment']>()
          .mockResolvedValue({ ...pending, amount: 0 }),
      }),
    })
    expect(await invalid.create()).toBeNull()
    expect(invalid.errorMessage.value).toContain('서버 결제 정보')
  })

  it('refreshes a recent payment and polls PENDING state only for the configured limit', async () => {
    vi.useFakeTimers()
    const getPayment = vi.fn<OrderPaymentApi['getPayment']>().mockResolvedValue(pending)
    const recentPaymentId = ref<string | null>('payment-1')
    const model = useOrderPayment(() => order, {
      api: api({ getPayment }),
      recentPaymentId,
      pollIntervalMs: 10,
      maxPollAttempts: 2,
    })
    await Promise.resolve()
    await nextTick()
    expect(getPayment).toHaveBeenCalledWith('payment-1')
    await vi.advanceTimersByTimeAsync(25)

    expect(getPayment).toHaveBeenCalledTimes(3)
    expect(model.polling.value).toBe(false)
  })

  it('rejects a stored payment lookup that belongs to another order', async () => {
    const getPayment = vi
      .fn<OrderPaymentApi['getPayment']>()
      .mockResolvedValue({ ...pending, orderId: 'another-order' })
    const model = useOrderPayment(() => order, { api: api({ getPayment }) })

    expect(await model.refresh('payment-1')).toBeNull()
    expect(model.payment.value).toBeNull()
    expect(model.errorMessage.value).toContain('서버 결제 정보')
  })

  it('cancels PAID with a separate customer-request key and does not change the order', async () => {
    const cancelPayment = vi
      .fn<OrderPaymentApi['cancelPayment']>()
      .mockResolvedValue({ ...pending, status: 'CANCELLED' })
    const model = useOrderPayment(() => order, {
      api: api({ cancelPayment }),
      createKey: vi
        .fn<() => string>()
        .mockReturnValueOnce('create-1')
        .mockReturnValueOnce('cancel-1'),
    })
    await model.create()
    model.payment.value = { ...pending, status: 'PAID' }

    await model.cancel()
    await model.cancel()

    expect(cancelPayment).toHaveBeenCalledWith('payment-1', 'CUSTOMER_REQUEST', 'cancel-1')
    expect(order.status).toBe('CREATED')
    expect(model.cancellationNotice.value).toContain('잠시 시간')
  })

  it('does not infer REVIEW_REQUIRED as success or failure', async () => {
    const model = useOrderPayment(() => order, { api: api() })
    model.payment.value = { ...pending, status: 'REVIEW_REQUIRED' }
    expect(model.canCancel.value).toBe(false)
    model.startPolling()
    expect(model.polling.value).toBe(true)
  })

  it('keeps an uncertain cancellation in REVIEW_REQUIRED and starts status polling', async () => {
    vi.useFakeTimers()
    const model = useOrderPayment(() => order, {
      api: api({
        cancelPayment: vi
          .fn<OrderPaymentApi['cancelPayment']>()
          .mockResolvedValue({ ...pending, status: 'REVIEW_REQUIRED' }),
      }),
      pollIntervalMs: 10,
    })
    model.payment.value = { ...pending, status: 'PAID' }

    await model.cancel()

    expect(model.payment.value?.status).toBe('REVIEW_REQUIRED')
    expect(model.cancellationNotice.value).toContain('성공이나 실패로 판단하지 말고')
    expect(model.polling.value).toBe(true)
  })
})
