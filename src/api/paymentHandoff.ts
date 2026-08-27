import { apiRequest } from './http'

export type PaymentHandoffDisplayStatus =
  | 'QUEUED'
  | 'DISPLAYED'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface PaymentKioskHandoff {
  /** Used only to avoid regenerating the same QR; never render this value. */
  id: string
  displayCode: string
  status: PaymentHandoffDisplayStatus
  expiresAt: string
}

/** Payment candidate contract, isolated until the Payment OpenAPI is schema-approved. */
export async function getCurrentPaymentHandoff(): Promise<PaymentKioskHandoff | null> {
  const wire = await apiRequest<PaymentKioskHandoff | undefined>(
    '/kiosk/payment-handoffs/current',
    {},
    { handleUnauthorized: 'kiosk' },
  )
  return wire ?? null
}
