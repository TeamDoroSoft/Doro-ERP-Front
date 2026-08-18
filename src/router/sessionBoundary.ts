import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { registerKioskUnauthorizedHandler, registerUnauthorizedHandler } from '@/api/http'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import { useKioskSessionStore } from '@/stores/kioskSession'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import { safePosReturnPath } from './safePosReturn'

/**
 * A `401` means different things to the two independent sessions, so each caller context has its
 * own boundary. An employee `401` ends the POS Session; a Kiosk `401` never touches it.
 */
export function registerSessionBoundaries(router: Router, pinia: Pinia): void {
  registerUnauthorizedHandler(() => employeeSessionExpired(router, pinia))
  registerKioskUnauthorizedHandler(() => kioskDeviceUnauthenticated(router, pinia))
}

export function employeeSessionExpired(router: Router, pinia: Pinia): void {
  useOperatorSessionStore(pinia).clearSession()
  if (router.currentRoute.value.path === '/pos/login') return

  // Only the path is carried back: query and hash are dropped before the login round trip.
  const redirect = safePosReturnPath(router, router.currentRoute.value.path)
  void router.replace({
    path: '/pos/login',
    query: { reason: 'session-expired', ...(redirect ? { redirect } : {}) },
  })
}

/**
 * The Service masks a revoked device and a wrong Secret behind one `KIOSK_AUTHENTICATION_FAILED`,
 * so the customer flow is cleared, the stored ACTIVE hint is discarded, and the device is sent to
 * its own re-activation screen. The employee Session Store and `/pos/**` are never involved.
 */
export function kioskDeviceUnauthenticated(router: Router, pinia: Pinia): void {
  useKioskFlowStore(pinia).resetCustomer()
  useKioskSessionStore(pinia).markAuthenticationFailed()
  if (router.currentRoute.value.path !== '/kiosk/activate') {
    void router.replace('/kiosk/activate')
  }
}
