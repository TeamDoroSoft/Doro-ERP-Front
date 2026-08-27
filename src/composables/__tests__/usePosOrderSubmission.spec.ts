import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import {
  usePosOrderSubmission,
  type PosOrderSubmissionApi,
} from '@/composables/usePosOrderSubmission'

const order = {
  orderId: 'order-1',
  displayNumber: 17,
  totalAmount: '9000',
  currency: 'KRW',
  status: 'CREATED' as const,
  businessDate: '2026-08-27',
  orderAccessToken: null,
  sourceType: 'EMPLOYEE_POS' as const,
  sourceDeviceId: null,
  sourceDeviceNameSnapshot: null,
  paymentHandoffDeviceIdSnapshot: null,
  paymentHandoffDeviceNameSnapshot: null,
  paymentPolicy: 'PAY_NOW' as const,
  paymentStatus: 'PENDING' as const,
  tableId: null,
}
const payment = {
  id: 'payment-1',
  orderId: 'order-1',
  providerOrderId: 'provider-1',
  amount: '9000',
  currency: 'KRW',
  status: 'PENDING' as const,
}
const handoff = {
  id: 'handoff-1',
  paymentId: 'payment-1',
  publicId: 'public-1',
  displayCode: 'A7K9',
  targetPaymentDeviceId: 'device-1',
  targetPaymentDeviceName: '결제 01',
  status: 'QUEUED' as const,
  expiresAt: '2026-08-27T10:05:00Z',
  version: '0',
}
const session = {
  sessionId: 'session-1',
  tableId: 'table-1',
  businessDate: '2026-08-27',
  status: 'OPEN' as const,
  version: '0',
  openedAt: '2026-08-27T10:00:00Z',
  closedAt: null,
  orders: [],
  unpaidTotal: '0',
}

function api(): {
  api: PosOrderSubmissionApi
  mocks: Record<keyof PosOrderSubmissionApi, ReturnType<typeof vi.fn>>
} {
  const mocks = {
    createOrder: vi.fn<PosOrderSubmissionApi['createOrder']>().mockResolvedValue(order),
    createPayment: vi.fn<PosOrderSubmissionApi['createPayment']>().mockResolvedValue(payment),
    getPaymentByOrder: vi
      .fn<PosOrderSubmissionApi['getPaymentByOrder']>()
      .mockResolvedValue(payment),
    createPaymentHandoff: vi
      .fn<PosOrderSubmissionApi['createPaymentHandoff']>()
      .mockResolvedValue(handoff),
    recoverPaymentHandoffByOrder: vi
      .fn<PosOrderSubmissionApi['recoverPaymentHandoffByOrder']>()
      .mockResolvedValue(handoff),
    openTableSession: vi.fn<PosOrderSubmissionApi['openTableSession']>().mockResolvedValue(session),
    addOrderToTableSession: vi
      .fn<PosOrderSubmissionApi['addOrderToTableSession']>()
      .mockResolvedValue({
        ...session,
        orders: [
          {
            orderId: 'order-1',
            displayNumber: 17,
            itemSummary: '아메리카노 × 2',
            amount: '9000',
            orderStatus: 'ACCEPTED',
            paymentStatus: 'UNPAID',
          },
        ],
        unpaidTotal: '9000',
      }),
    getTableSession: vi.fn<PosOrderSubmissionApi['getTableSession']>().mockResolvedValue(session),
  }
  return { api: mocks as unknown as PosOrderSubmissionApi, mocks }
}

describe('usePosOrderSubmission', () => {
  it('creates payment and kiosk handoff with deterministic retry keys and no amount', async () => {
    const { api: dependency, mocks } = api()
    const keys = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
    const model = usePosOrderSubmission(dependency, () => keys.shift()!)
    await model.submit({
      request: {
        orderChannel: 'POS',
        serviceType: 'TAKEOUT',
        paymentPolicy: 'PAY_NOW',
        lines: [{ productId: 'product-1', quantity: 2 }],
      },
      orderIdempotencyKey: 'order-key',
      payNowTarget: 'PAYMENT_KIOSK',
      targetPaymentDeviceId: 'device-1',
    })
    expect(mocks.createPayment).toHaveBeenCalledWith(
      'order-1',
      '11111111-1111-4111-8111-111111111111',
    )
    expect(mocks.createPaymentHandoff).toHaveBeenCalledWith(
      'payment-1',
      'device-1',
      '22222222-2222-4222-8222-222222222222',
    )
    await model.submit({
      request: {
        orderChannel: 'POS',
        serviceType: 'TAKEOUT',
        paymentPolicy: 'PAY_NOW',
        lines: [{ productId: 'product-1', quantity: 2 }],
      },
      orderIdempotencyKey: 'order-key',
      payNowTarget: 'PAYMENT_KIOSK',
      targetPaymentDeviceId: 'device-1',
    })
    expect(mocks.createPayment.mock.calls[1]?.[1]).toBe('11111111-1111-4111-8111-111111111111')
    expect(mocks.createPaymentHandoff.mock.calls[1]?.[2]).toBe(
      '22222222-2222-4222-8222-222222222222',
    )
  })

  it('recovers the canonical payment after a create conflict', async () => {
    const { api: dependency, mocks } = api()
    mocks.createPayment.mockRejectedValue(new ApiError(409, { code: 'STATE_CONFLICT' }))
    const result = await usePosOrderSubmission(dependency).submit({
      request: {
        orderChannel: 'POS',
        serviceType: 'TAKEOUT',
        paymentPolicy: 'PAY_NOW',
        lines: [{ productId: 'product-1', quantity: 1 }],
      },
      orderIdempotencyKey: 'key',
      payNowTarget: 'PAYMENT_KIOSK',
      targetPaymentDeviceId: 'device-1',
    })
    expect(mocks.getPaymentByOrder).toHaveBeenCalledWith('order-1')
    expect(result?.payment).toEqual(payment)
  })

  it.each([0, 409, 503])(
    'recovers the canonical handoff by order after a create result %s',
    async (status) => {
      const { api: dependency, mocks } = api()
      mocks.createPaymentHandoff.mockRejectedValue(new ApiError(status))
      const result = await usePosOrderSubmission(dependency).submit({
        request: {
          orderChannel: 'POS',
          serviceType: 'TAKEOUT',
          paymentPolicy: 'PAY_NOW',
          lines: [{ productId: 'product-1', quantity: 1 }],
        },
        orderIdempotencyKey: 'key',
        payNowTarget: 'PAYMENT_KIOSK',
        targetPaymentDeviceId: 'device-1',
      })

      expect(mocks.recoverPaymentHandoffByOrder).toHaveBeenCalledWith('order-1')
      expect(result?.handoff).toEqual(handoff)
    },
  )

  it('opens the table before a PAY_LATER order and treats a lost attach response as recovered', async () => {
    const { api: dependency, mocks } = api()
    const attached = {
      ...session,
      orders: [
        {
          orderId: 'order-1',
          displayNumber: 17,
          itemSummary: '아메리카노 × 2',
          amount: '9000',
          orderStatus: 'ACCEPTED',
          paymentStatus: 'UNPAID' as const,
        },
      ],
      unpaidTotal: '9000',
    }
    mocks.addOrderToTableSession.mockRejectedValue(new ApiError(0))
    mocks.getTableSession.mockResolvedValue(attached)
    const laterOrder = {
      ...order,
      paymentPolicy: 'PAY_LATER' as const,
      paymentStatus: 'UNPAID' as const,
      tableId: 'table-1',
      status: 'ACCEPTED' as const,
    }
    mocks.createOrder.mockResolvedValue(laterOrder)
    const result = await usePosOrderSubmission(dependency).submit({
      request: {
        orderChannel: 'POS',
        serviceType: 'DINE_IN',
        paymentPolicy: 'PAY_LATER',
        tableId: 'table-1',
        lines: [{ productId: 'product-1', quantity: 1 }],
      },
      orderIdempotencyKey: 'key',
      payNowTarget: 'DIRECT',
    })
    expect(mocks.openTableSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createOrder.mock.invocationCallOrder[0]!,
    )
    expect(result?.tableSession).toEqual(attached)
  })
})
