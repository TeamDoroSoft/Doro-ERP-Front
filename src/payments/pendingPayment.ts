import type { PaymentResponse } from '@/api/payment'

const STORAGE_PREFIX = 'doro.payment-flow.'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface PendingPayment {
  payment: Pick<
    PaymentResponse,
    'id' | 'orderId' | 'providerOrderId' | 'amount' | 'currency' | 'status'
  >
  confirmIdempotencyKey: string
}

export function savePendingPayment(flowId: string, pending: PendingPayment): void {
  if (!flowId || !isPendingPayment(pending)) {
    return
  }
  // Never persist provider credentials (such as Toss paymentKey).
  window.sessionStorage.setItem(
    `${STORAGE_PREFIX}${flowId}`,
    JSON.stringify({
      payment: pending.payment,
      confirmIdempotencyKey: pending.confirmIdempotencyKey,
    }),
  )
}

export function readPendingPayment(flowId: string): PendingPayment | null {
  if (!flowId) {
    return null
  }
  const stored = window.sessionStorage.getItem(`${STORAGE_PREFIX}${flowId}`)
  if (!stored) {
    return null
  }

  try {
    const value = JSON.parse(stored) as unknown
    return isPendingPayment(value) ? value : null
  } catch {
    return null
  }
}

export function clearPendingPayment(flowId: string): void {
  if (flowId) {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${flowId}`)
  }
}

const RECENT_PAYMENT_PREFIX = 'doro.payment-order.'

/** Retains only a non-sensitive payment lookup after one-time callback cleanup. */
export function saveRecentPaymentId(orderId: string, paymentId: string): void {
  if (orderId && paymentId) {
    window.sessionStorage.setItem(`${RECENT_PAYMENT_PREFIX}${orderId}`, paymentId)
  }
}

export function readRecentPaymentId(orderId: string): string | null {
  return orderId ? window.sessionStorage.getItem(`${RECENT_PAYMENT_PREFIX}${orderId}`) : null
}

function isPendingPayment(value: unknown): value is PendingPayment {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const pending = value as Partial<PendingPayment>
  const payment = pending.payment as Partial<PaymentResponse> | undefined
  return (
    typeof pending.confirmIdempotencyKey === 'string' &&
    UUID_PATTERN.test(pending.confirmIdempotencyKey) &&
    typeof payment?.id === 'string' &&
    UUID_PATTERN.test(payment.id) &&
    typeof payment.orderId === 'string' &&
    UUID_PATTERN.test(payment.orderId) &&
    typeof payment.providerOrderId === 'string' &&
    /^[A-Za-z0-9_-]{6,64}$/.test(payment.providerOrderId) &&
    typeof payment.amount === 'number' &&
    Number.isSafeInteger(payment.amount) &&
    payment.amount > 0 &&
    payment.currency === 'KRW' &&
    payment.status === 'PENDING'
  )
}
