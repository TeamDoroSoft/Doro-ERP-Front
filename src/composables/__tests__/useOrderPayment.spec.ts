import { nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OrderResponse } from '@/api/order'
import { PaymentApiError, type PaymentResponse } from '@/api/payment'
import { useOrderPayment, type OrderPaymentApi } from '@/composables/useOrderPayment'

const order: OrderResponse = {
  orderId: 'order-1',
  displayNumber: 42,
  totalAmount: '12000',
  currency: 'KRW',
  status: 'CREATED',
  businessDate: '2026-08-17',
  orderAccessToken: null,
  sourceType: 'EMPLOYEE_POS',
  sourceDeviceId: null,
  sourceDeviceNameSnapshot: null,
  paymentPolicy: 'PAY_NOW',
  paymentStatus: 'PENDING',
  tableId: null,
}
const pending: PaymentResponse = {
  id: 'payment-1',
  orderId: order.orderId,
  providerOrderId: 'provider-1',
  amount: '12000',
  currency: 'KRW',
  status: 'PENDING',
}

function api(overrides: Partial<OrderPaymentApi> = {}): OrderPaymentApi {
  return {
    createPayment: vi.fn<OrderPaymentApi['createPayment']>().mockResolvedValue(pending),
    getPayment: vi.fn<OrderPaymentApi['getPayment']>().mockResolvedValue(pending),
    getPaymentByOrder: vi
      .fn<OrderPaymentApi['getPaymentByOrder']>()
      .mockRejectedValue(new PaymentApiError(404, { code: 'PAYMENT_NOT_FOUND' })),
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
    await discovery(model)

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
    await discovery(model)
    const created = await model.create()
    expect(created).toEqual(pending)

    const invalid = useOrderPayment(() => order, {
      api: api({
        createPayment: vi
          .fn<OrderPaymentApi['createPayment']>()
          .mockResolvedValue({ ...pending, amount: '0' }),
      }),
    })
    await discovery(invalid)
    expect(await invalid.create()).toBeNull()
    expect(invalid.errorMessage.value).toContain('결제 정보가 주문 내용과 일치하지 않습니다')
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

  it('discovers an order payment before enabling creation and treats only by-order 404 as empty', async () => {
    let resolveLookup!: (payment: PaymentResponse) => void
    const getPaymentByOrder = vi
      .fn<OrderPaymentApi['getPaymentByOrder']>()
      .mockImplementation(() => new Promise((resolve) => (resolveLookup = resolve)))
    const model = useOrderPayment(() => order, { api: api({ getPaymentByOrder }) })

    expect(model.discovering.value).toBe(true)
    expect(model.canCreate.value).toBe(false)
    resolveLookup(pending)
    await discovery(model)

    expect(model.payment.value).toEqual(pending)
    expect(model.canCreate.value).toBe(false)

    const unavailable = useOrderPayment(() => order, {
      api: api({
        getPaymentByOrder: vi
          .fn<OrderPaymentApi['getPaymentByOrder']>()
          .mockRejectedValue(
            new PaymentApiError(503, {
              code: 'PAYMENT_UNAVAILABLE',
              detail: 'raw upstream diagnostic',
            }),
          ),
      }),
    })
    await discovery(unavailable)
    expect(unavailable.canCreate.value).toBe(false)
    expect(unavailable.errorMessage.value).toBe(
      '지금은 결제할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    )
    expect(unavailable.errorMessage.value).not.toContain('raw upstream diagnostic')
  })

  it('falls back from a stale recent payment ID to the canonical order payment', async () => {
    const getPayment = vi
      .fn<OrderPaymentApi['getPayment']>()
      .mockRejectedValue(new PaymentApiError(404, { code: 'PAYMENT_NOT_FOUND' }))
    const getPaymentByOrder = vi
      .fn<OrderPaymentApi['getPaymentByOrder']>()
      .mockResolvedValue(pending)
    const model = useOrderPayment(() => order, {
      api: api({ getPayment, getPaymentByOrder }),
      recentPaymentId: () => 'stale-payment-id',
    })
    await discovery(model)

    expect(getPayment).toHaveBeenCalledWith('stale-payment-id')
    expect(getPaymentByOrder).toHaveBeenCalledWith(order.orderId)
    expect(model.payment.value).toEqual(pending)
    expect(model.canResume.value).toBe(true)
  })

  it('recovers a matching PENDING payment after a create conflict', async () => {
    const createPayment = vi
      .fn<OrderPaymentApi['createPayment']>()
      .mockRejectedValue(
        new PaymentApiError(409, {
          code: 'STATE_CONFLICT',
          detail: '주문에 이미 결제가 존재합니다.',
        }),
      )
    const getPaymentByOrder = vi
      .fn<OrderPaymentApi['getPaymentByOrder']>()
      .mockRejectedValueOnce(new PaymentApiError(404, { code: 'PAYMENT_NOT_FOUND' }))
      .mockResolvedValueOnce(pending)
    const model = useOrderPayment(() => order, {
      api: api({ createPayment, getPaymentByOrder }),
      createKey: () => 'create-1',
    })
    await discovery(model)

    expect(await model.create()).toEqual(pending)
    expect(model.payment.value).toEqual(pending)
    expect(model.errorMessage.value).toBe('')
    expect(getPaymentByOrder).toHaveBeenCalledTimes(2)
  })

  it('does not resume a mismatched or terminal payment after a create conflict', async () => {
    const conflict = new PaymentApiError(409, {
      code: 'STATE_CONFLICT',
      detail: 'raw conflict detail',
    })
    const terminal = useOrderPayment(() => order, {
      api: api({
        createPayment: vi.fn<OrderPaymentApi['createPayment']>().mockRejectedValue(conflict),
        getPaymentByOrder: vi
          .fn<OrderPaymentApi['getPaymentByOrder']>()
          .mockRejectedValueOnce(new PaymentApiError(404, { code: 'PAYMENT_NOT_FOUND' }))
          .mockResolvedValueOnce({ ...pending, status: 'PAID' }),
      }),
    })
    await discovery(terminal)
    expect(await terminal.create()).toBeNull()
    expect(terminal.payment.value?.status).toBe('PAID')
    expect(terminal.canResume.value).toBe(false)
    expect(terminal.errorMessage.value).toBe(
      '현재 결제 상태에서는 요청을 처리할 수 없습니다.',
    )
    expect(terminal.errorMessage.value).not.toContain('raw conflict detail')

    const mismatched = useOrderPayment(() => order, {
      api: api({
        createPayment: vi.fn<OrderPaymentApi['createPayment']>().mockRejectedValue(conflict),
        getPaymentByOrder: vi
          .fn<OrderPaymentApi['getPaymentByOrder']>()
          .mockRejectedValueOnce(new PaymentApiError(404, { code: 'PAYMENT_NOT_FOUND' }))
          .mockResolvedValueOnce({ ...pending, amount: '1' }),
      }),
    })
    await discovery(mismatched)
    expect(await mismatched.create()).toBeNull()
    expect(mismatched.payment.value).toBeNull()
    expect(mismatched.errorMessage.value).toContain('결제 정보가 주문 내용과 일치하지 않습니다')
  })

  it('rejects a stored payment lookup that belongs to another order', async () => {
    const getPayment = vi
      .fn<OrderPaymentApi['getPayment']>()
      .mockResolvedValue({ ...pending, orderId: 'another-order' })
    const model = useOrderPayment(() => order, { api: api({ getPayment }) })
    await discovery(model)

    expect(await model.refresh('payment-1')).toBeNull()
    expect(model.payment.value).toBeNull()
    expect(model.errorMessage.value).toContain('결제 정보가 주문 내용과 일치하지 않습니다')
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
    await discovery(model)
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
    await discovery(model)
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
    await discovery(model)
    model.payment.value = { ...pending, status: 'PAID' }

    await model.cancel()

    expect(model.payment.value?.status).toBe('REVIEW_REQUIRED')
    expect(model.cancellationNotice.value).toContain('성공이나 실패로 판단하지 말고')
    expect(model.polling.value).toBe(true)
  })
})

async function discovery(model: ReturnType<typeof useOrderPayment>) {
  for (let attempt = 0; attempt < 8 && model.discovering.value; attempt += 1) {
    await Promise.resolve()
    await nextTick()
  }
  expect(model.discovering.value).toBe(false)
}
