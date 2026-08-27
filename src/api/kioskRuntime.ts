import { apiRequest } from './http'

export type KioskMode = 'ORDER' | 'ENTRY_QUEUE' | 'PAYMENT'

export interface KioskRuntime {
  deviceId: string
  deviceName: string
  mode: KioskMode
  pairedPaymentDevice: {
    id: string
    name: string
  } | null
}

/** A 401 ends the kiosk session; a mode 403 remains available to the caller for recovery. */
export const getKioskRuntime = () =>
  apiRequest<KioskRuntime>('/kiosk/runtime', {}, { handleUnauthorized: 'kiosk' })

export const kioskModeHome: Record<KioskMode, string> = {
  ORDER: '/kiosk/order',
  ENTRY_QUEUE: '/kiosk/waiting',
  PAYMENT: '/kiosk/payment',
}
