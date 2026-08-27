import { isPositiveInt64 } from '@/api/int64'
import type { KioskCreatedOrder } from '@/api/kiosk'
import type { PaymentView } from '@/api/payment'

const STORAGE_KEY = 'doro.kiosk-payment-flow'
const FLOW_TTL_MS = 30 * 60 * 1000
const CLOCK_SKEW_MS = 60 * 1000
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface KioskPaymentFlowSnapshot {
  order: KioskCreatedOrder
  payment: PaymentView
  confirmIdempotencyKey: string | null
  createdAt: number
}

interface StoredKioskPaymentFlow extends KioskPaymentFlowSnapshot {
  version: 1
}

/**
 * Persists only the current customer checkout state needed after Toss performs a document reload.
 * Provider credentials such as Toss `paymentKey` and the Kiosk activation Secret must never be
 * added here. The order access token is scoped to this order and remains in sessionStorage only.
 */
export function saveKioskPaymentFlow(snapshot: KioskPaymentFlowSnapshot, now = Date.now()): boolean {
  if (
    !storageAvailable() ||
    !isKioskPaymentFlow(snapshot) ||
    !validTimestamp(snapshot.createdAt, now)
  )
    return false

  try {
    const stored: StoredKioskPaymentFlow = {
      version: 1,
      ...snapshot,
      confirmIdempotencyKey:
        snapshot.payment.status === 'PENDING' ? snapshot.confirmIdempotencyKey : null,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

export function readKioskPaymentFlow(now = Date.now()): KioskPaymentFlowSnapshot | null {
  if (!storageAvailable()) return null

  try {
    const serialized = sessionStorage.getItem(STORAGE_KEY)
    if (!serialized) return null
    const stored = JSON.parse(serialized) as unknown
    if (!isStoredKioskPaymentFlow(stored) || !validTimestamp(stored.createdAt, now)) {
      clearKioskPaymentFlow()
      return null
    }
    return {
      order: stored.order,
      payment: stored.payment,
      confirmIdempotencyKey: stored.confirmIdempotencyKey,
      createdAt: stored.createdAt,
    }
  } catch {
    clearKioskPaymentFlow()
    return null
  }
}

export function clearKioskPaymentFlow(): void {
  if (!storageAvailable()) return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage cleanup is best effort; no checkout credential is copied elsewhere as a fallback.
  }
}

function storageAvailable(): boolean {
  return typeof sessionStorage !== 'undefined'
}

function validTimestamp(savedAt: number, now: number): boolean {
  return (
    Number.isFinite(savedAt) &&
    Number.isFinite(now) &&
    savedAt > 0 &&
    savedAt <= now + CLOCK_SKEW_MS &&
    now - savedAt <= FLOW_TTL_MS
  )
}

function isStoredKioskPaymentFlow(value: unknown): value is StoredKioskPaymentFlow {
  if (typeof value !== 'object' || value === null) return false
  const stored = value as Partial<StoredKioskPaymentFlow>
  return stored.version === 1 && typeof stored.createdAt === 'number' && isKioskPaymentFlow(stored)
}

function isKioskPaymentFlow(value: unknown): value is KioskPaymentFlowSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const snapshot = value as Partial<KioskPaymentFlowSnapshot>
  const order = snapshot.order as Partial<KioskCreatedOrder> | undefined
  const payment = snapshot.payment as Partial<PaymentView> | undefined

  return (
    typeof snapshot.createdAt === 'number' &&
    (snapshot.payment?.status === 'PENDING'
      ? typeof snapshot.confirmIdempotencyKey === 'string' &&
        UUID_PATTERN.test(snapshot.confirmIdempotencyKey)
      : snapshot.confirmIdempotencyKey === null ||
        (typeof snapshot.confirmIdempotencyKey === 'string' &&
          UUID_PATTERN.test(snapshot.confirmIdempotencyKey))) &&
    typeof order?.orderId === 'string' &&
    UUID_PATTERN.test(order.orderId) &&
    Number.isSafeInteger(order.displayNumber) &&
    Number(order.displayNumber) > 0 &&
    typeof order.totalAmount === 'string' &&
    isPositiveInt64(order.totalAmount) &&
    order.currency === 'KRW' &&
    ['CREATED', 'ACCEPTED', 'COMPLETED', 'CANCELLED'].includes(String(order.status)) &&
    typeof order.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(order.businessDate) &&
    typeof order.orderAccessToken === 'string' &&
    /^[^\s]{1,2048}$/.test(order.orderAccessToken) &&
    typeof payment?.id === 'string' &&
    UUID_PATTERN.test(payment.id) &&
    payment.orderId === order.orderId &&
    typeof payment.providerOrderId === 'string' &&
    /^[A-Za-z0-9_-]{6,64}$/.test(payment.providerOrderId) &&
    payment.amount === order.totalAmount &&
    payment.currency === order.currency &&
    ['PENDING', 'PAID', 'FAILED', 'REVIEW_REQUIRED', 'CANCELLED'].includes(
      String(payment.status),
    )
  )
}
