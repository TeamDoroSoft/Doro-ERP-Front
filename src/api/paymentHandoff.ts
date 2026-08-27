import { apiRequestExact } from './http'
import { assertInt64, type Int64String } from './int64'

export type PaymentHandoffStatus =
  'QUEUED' | 'DISPLAYED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED'

/** @deprecated Use PaymentHandoffStatus. */
export type PaymentHandoffDisplayStatus = PaymentHandoffStatus

export interface PaymentHandoff {
  id: string
  paymentId: string
  publicId: string
  displayCode: string
  targetPaymentDeviceId: string
  targetPaymentDeviceName: string
  status: PaymentHandoffStatus
  expiresAt: string
  version: Int64String
}

export interface PaymentKioskHandoff {
  publicId: string
  displayCode: string
  status: PaymentHandoffStatus
  expiresAt: string
  amount: Int64String
  currency: 'KRW'
  orderDisplayNumber: number | null
  orderSummary: string
  /** Present only on the atomic first claim and must never be persisted. */
  oneTimeToken: string | null
}

const HANDOFF_INT64 = { fields: ['amount', 'version'] } as const
export type PaymentHandoffRequestContext = 'employee' | 'kiosk'

export function createPaymentHandoff(
  paymentId: string,
  targetPaymentDeviceId: string,
  idempotencyKey: string,
  context: PaymentHandoffRequestContext = 'employee',
): Promise<PaymentHandoff> {
  return apiRequestExact<PaymentHandoff>(
    '/payment-handoffs',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ paymentId, targetPaymentDeviceId }),
    },
    HANDOFF_INT64,
    { handleUnauthorized: context === 'kiosk' ? 'kiosk' : true },
  )
}

export function recoverPaymentHandoffByOrder(orderId: string): Promise<PaymentHandoff> {
  const query = new URLSearchParams({ orderId })
  return apiRequestExact<PaymentHandoff>(
    `/payment-handoffs/recovery?${query.toString()}`,
    {},
    HANDOFF_INT64,
  )
}

export function reissuePaymentHandoff(id: string, version: Int64String): Promise<PaymentHandoff> {
  return handoffMutation(id, 'reissue', version)
}

export function reassignPaymentHandoff(
  id: string,
  targetPaymentDeviceId: string,
  version: Int64String,
): Promise<PaymentHandoff> {
  return handoffMutation(id, 'reassign', version, { targetPaymentDeviceId })
}

export function cancelPaymentHandoff(id: string, version: Int64String): Promise<PaymentHandoff> {
  return handoffMutation(id, 'cancel', version)
}

/** A 204 response means the PAYMENT-mode kiosk currently has no assigned handoff. */
export async function getCurrentPaymentHandoff(): Promise<PaymentKioskHandoff | null> {
  const wire = await apiRequestExact<PaymentKioskHandoff | undefined>(
    '/kiosk/payment-handoffs/current',
    {},
    HANDOFF_INT64,
    { handleUnauthorized: 'kiosk' },
  )
  return wire ?? null
}

function handoffMutation(
  id: string,
  operation: 'reissue' | 'reassign' | 'cancel',
  version: Int64String,
  body?: object,
): Promise<PaymentHandoff> {
  return apiRequestExact<PaymentHandoff>(
    `/payment-handoffs/${encodeURIComponent(id)}/${operation}`,
    {
      method: 'POST',
      headers: { 'If-Match': `"${assertInt64(version)}"` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
    HANDOFF_INT64,
  )
}
