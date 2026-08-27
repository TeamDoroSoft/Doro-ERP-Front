import { beforeEach, describe, expect, it } from 'vitest'
import {
  readKioskPaymentFlow,
  saveKioskPaymentFlow,
  type KioskPaymentFlowSnapshot,
} from '@/payments/kioskPaymentFlow'

const snapshot: KioskPaymentFlowSnapshot = {
  order: {
    orderId: '11111111-1111-4111-8111-111111111111',
    displayNumber: 104,
    totalAmount: '9000',
    currency: 'KRW',
    status: 'CREATED',
    businessDate: '2026-08-27',
    orderAccessToken: 'must-never-be-stored',
  },
  payment: {
    id: '33333333-3333-4333-8333-333333333333',
    orderId: '11111111-1111-4111-8111-111111111111',
    providerOrderId: 'provider-order',
    amount: '9000',
    currency: 'KRW',
    status: 'PENDING',
  },
  confirmIdempotencyKey: '44444444-4444-4444-8444-444444444444',
  createdAt: Date.now(),
}

describe('retired ORDER kiosk payment recovery', () => {
  beforeEach(() => sessionStorage.clear())

  it('fails closed without storing order or payment credentials', () => {
    expect(saveKioskPaymentFlow(snapshot)).toBe(false)
    expect(readKioskPaymentFlow()).toBeNull()
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
    expect(JSON.stringify(sessionStorage)).not.toContain(snapshot.order.orderAccessToken)
  })

  it('removes a record left by an older deployment', () => {
    sessionStorage.setItem('doro.kiosk-payment-flow', JSON.stringify(snapshot))
    expect(readKioskPaymentFlow()).toBeNull()
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
  })
})
