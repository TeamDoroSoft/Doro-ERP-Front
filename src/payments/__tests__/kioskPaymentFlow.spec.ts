import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearKioskPaymentFlow,
  readKioskPaymentFlow,
  saveKioskPaymentFlow,
  type KioskPaymentFlowSnapshot,
} from '@/payments/kioskPaymentFlow'

const NOW = Date.parse('2026-08-27T12:00:00Z')
const snapshot: KioskPaymentFlowSnapshot = {
  order: {
    orderId: '11111111-1111-4111-8111-111111111111',
    displayNumber: 104,
    totalAmount: '9007199254740993',
    currency: 'KRW',
    status: 'CREATED',
    businessDate: '2026-08-27',
    orderAccessToken: 'short-lived-order-token',
  },
  payment: {
    id: '33333333-3333-4333-8333-333333333333',
    orderId: '11111111-1111-4111-8111-111111111111',
    providerOrderId: 'kiosk-provider-1',
    amount: '9007199254740993',
    currency: 'KRW',
    status: 'PENDING',
  },
  confirmIdempotencyKey: '44444444-4444-4444-8444-444444444444',
  createdAt: NOW,
}

describe('Kiosk payment flow recovery', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('restores exact payment and order state without storing a Toss paymentKey', () => {
    expect(saveKioskPaymentFlow(snapshot)).toBe(true)

    expect(readKioskPaymentFlow()).toEqual(snapshot)
    const serialized = String(sessionStorage.getItem('doro.kiosk-payment-flow'))
    expect(serialized).toContain('9007199254740993')
    expect(serialized).not.toContain('paymentKey')
    expect(serialized).not.toContain('activation')
  })

  it('keeps an absolute TTL and removes an expired record', () => {
    expect(saveKioskPaymentFlow(snapshot)).toBe(true)
    expect(readKioskPaymentFlow(NOW + 30 * 60 * 1000)).not.toBeNull()
    expect(readKioskPaymentFlow(NOW + 30 * 60 * 1000 + 1)).toBeNull()
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
  })

  it('removes malformed, future-dated and cross-order records', () => {
    const invalidRecords = [
      '{',
      JSON.stringify({ version: 1, ...snapshot, createdAt: NOW + 60 * 1000 + 1 }),
      JSON.stringify({
        version: 1,
        ...snapshot,
        payment: { ...snapshot.payment, orderId: '22222222-2222-4222-8222-222222222222' },
      }),
      JSON.stringify({
        version: 1,
        ...snapshot,
        payment: { ...snapshot.payment, amount: '-1' },
      }),
      JSON.stringify({ version: 1, ...snapshot, confirmIdempotencyKey: 'not-a-uuid' }),
    ]

    for (const record of invalidRecords) {
      sessionStorage.setItem('doro.kiosk-payment-flow', record)
      expect(readKioskPaymentFlow()).toBeNull()
      expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
    }
  })

  it('drops the confirmation idempotency key after the payment becomes terminal', () => {
    expect(
      saveKioskPaymentFlow({
        ...snapshot,
        payment: { ...snapshot.payment, status: 'PAID' },
      }),
    ).toBe(true)

    expect(readKioskPaymentFlow()?.confirmIdempotencyKey).toBeNull()
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).not.toContain(
      snapshot.confirmIdempotencyKey,
    )
  })

  it('clears the current customer record explicitly', () => {
    saveKioskPaymentFlow(snapshot)
    clearKioskPaymentFlow()
    expect(readKioskPaymentFlow()).toBeNull()
  })
})
