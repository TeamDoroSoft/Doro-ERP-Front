import { apiRequestExact } from './http'

/**
 * Employee-safe projection for choosing an active PAYMENT kiosk.
 * This deliberately does not share the administrator device DTO.
 */
export interface PaymentKioskCandidate {
  deviceId: string
  displayName: string
  mode: 'PAYMENT'
  active: true
}

export function listActivePaymentKioskCandidatesForStaff(): Promise<PaymentKioskCandidate[]> {
  return apiRequestExact<PaymentKioskCandidate[]>('/payment-kiosk-candidates')
}
