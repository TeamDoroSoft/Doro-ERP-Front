import type { KioskCreatedOrder } from '@/api/kiosk'
import type { PaymentView } from '@/api/payment'

const STORAGE_KEY = 'doro.kiosk-payment-flow'

/** @deprecated ORDER Kiosk payment is now handed off to a PAYMENT Kiosk. */
export interface KioskPaymentFlowSnapshot {
  order: KioskCreatedOrder
  payment: PaymentView
  confirmIdempotencyKey: string | null
  createdAt: number
}

/**
 * Direct Toss checkout on an ORDER Kiosk has been retired. Keeping this compatibility function
 * fail-closed ensures an older caller can never persist an order access token or payment state.
 */
export function saveKioskPaymentFlow(_snapshot: KioskPaymentFlowSnapshot): boolean {
  clearKioskPaymentFlow()
  return false
}

/** No legacy checkout credential is recoverable from browser storage. */
export function readKioskPaymentFlow(): KioskPaymentFlowSnapshot | null {
  clearKioskPaymentFlow()
  return null
}

export function clearKioskPaymentFlow(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage cleanup is best effort and no credential is copied elsewhere as a fallback.
  }
}
