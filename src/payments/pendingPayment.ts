import type { PaymentResponse } from '@/api/payment'

const STORAGE_PREFIX = 'doro.payment-flow.'

export interface PendingPayment {
  apiBaseUrl: string
  payment: PaymentResponse
  orderName: string
  confirmIdempotencyKey: string
}

export function savePendingPayment(flowId: string, pending: PendingPayment): void {
  window.sessionStorage.setItem(`${STORAGE_PREFIX}${flowId}`, JSON.stringify(pending))
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

function isPendingPayment(value: unknown): value is PendingPayment {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const pending = value as Partial<PendingPayment>
  const payment = pending.payment as Partial<PaymentResponse> | undefined
  return (
    typeof pending.apiBaseUrl === 'string' &&
    typeof pending.orderName === 'string' &&
    typeof pending.confirmIdempotencyKey === 'string' &&
    typeof payment?.id === 'string' &&
    typeof payment.orderId === 'string' &&
    typeof payment.providerOrderId === 'string' &&
    typeof payment.amount === 'number' &&
    typeof payment.currency === 'string' &&
    typeof payment.status === 'string'
  )
}
