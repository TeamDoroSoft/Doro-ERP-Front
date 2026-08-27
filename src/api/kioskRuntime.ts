import { apiRequest } from './http'

export type KioskMode = 'ORDER' | 'ENTRY_QUEUE' | 'PAYMENT'

export interface KioskRuntime {
  deviceId: string
  deviceName: string
  mode: KioskMode
  pairedPaymentDevice?: {
    id: string
    name: string
  }
}

/**
 * Candidate runtime contract. Keep this module as the single adaptation point until the
 * Store Access OpenAPI is approved.
 *
 * A 401 is delegated to the kiosk session boundary. A 403 is deliberately surfaced so the
 * caller can refresh runtime/mode rather than treating the device as unauthenticated.
 */
export const getKioskRuntime = () =>
  apiRequest<KioskRuntime>('/kiosk/runtime', {}, { handleUnauthorized: 'kiosk' })

export const kioskModeHome: Record<KioskMode, string> = {
  ORDER: '/kiosk/order',
  ENTRY_QUEUE: '/kiosk/waiting',
  PAYMENT: '/kiosk/payment',
}
