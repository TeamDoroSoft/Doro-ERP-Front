import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createPayment, confirmPayment, getPayment } from '@/api/payment'
import { getKioskMenu } from '@/api/kiosk'
import { getOrders } from '@/api/order'
import { registerKioskUnauthorizedHandler, registerUnauthorizedHandler } from '@/api/http'
import router from '@/router'
import { registerSessionBoundaries } from '@/router/sessionBoundary'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskSessionStore } from '@/stores/kioskSession'
import { useOperatorSessionStore } from '@/stores/operatorSession'

const ACTIVE_MARKER = 'doro.kiosk-device-active'

describe('401 boundaries for the two independent sessions', () => {
  let pinia: Pinia

  beforeEach(async () => {
    sessionStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
    registerSessionBoundaries(router, pinia)
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => unauthorized('UNAUTHENTICATED')))
    await router.push('/pos/login')
  })

  afterEach(() => {
    registerUnauthorizedHandler(() => undefined)
    registerKioskUnauthorizedHandler(() => undefined)
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  async function signIn(role: 'OWNER' | 'MANAGER' | 'STAFF' = 'OWNER') {
    useOperatorSessionStore(pinia).applyLogin(
      { employeeId: 'employee-1', role, passwordChangeRequired: false },
      'doro',
    )
  }

  it('ends the employee session on a POS payment 401 and keeps the safe return path', async () => {
    await signIn()
    await router.push('/pos/settings')

    await expect(createPayment('order-1', 'key-1')).rejects.toMatchObject({ status: 401 })
    await flushPromises()

    expect(useOperatorSessionStore(pinia).authenticated).toBe(false)
    expect(router.currentRoute.value.path).toBe('/pos/login')
    expect(router.currentRoute.value.query.reason).toBe('session-expired')
    expect(router.currentRoute.value.query.redirect).toBe('/pos/settings')
  })

  it('drops query and hash from the preserved return path', async () => {
    await signIn()
    await router.push('/pos/orders/11111111-1111-4111-8111-111111111111?paymentKey=secret#fragment')

    await expect(getOrders()).rejects.toMatchObject({ status: 401 })
    await flushPromises()

    expect(router.currentRoute.value.query.redirect).toBe(
      '/pos/orders/11111111-1111-4111-8111-111111111111',
    )
    expect(String(router.currentRoute.value.query.redirect)).not.toContain('paymentKey')
    expect(router.currentRoute.value.hash).toBe('')
  })

  it.each([
    ['payment creation', () => createPayment('order-1', 'key-1', 'kiosk')],
    ['payment confirmation', () => confirmPayment('payment-1', 'toss-key', '12000', 'key-2', 'kiosk')],
    ['menu loading', () => getKioskMenu()],
  ])('isolates a kiosk %s 401 from the employee session', async (_label, call) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => unauthorized('KIOSK_AUTHENTICATION_FAILED')),
    )
    await signIn('STAFF')
    const kiosk = useKioskSessionStore(pinia)
    kiosk.markAuthenticated()
    useKioskCartStore(pinia).addItem({
      productId: 'p1',
      name: '커피',
      description: '',
      price: '4500',
      displayOrder: 1,
    })
    await router.push('/kiosk/cart')

    await expect(call()).rejects.toMatchObject({ status: 401 })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/kiosk/activate')
    expect(router.currentRoute.value.path).not.toBe('/pos/login')
    expect(useOperatorSessionStore(pinia).authenticated).toBe(true)
    expect(useOperatorSessionStore(pinia).role).toBe('STAFF')
    expect(sessionStorage.getItem(ACTIVE_MARKER)).toBeNull()
    expect(kiosk.canAccessProtected).toBe(false)
    expect(useKioskCartStore(pinia).lines).toHaveLength(0)
  })

  it('shows a neutral re-authentication state instead of guessing REVOKED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => unauthorized('KIOSK_AUTHENTICATION_FAILED')),
    )
    const kiosk = useKioskSessionStore(pinia)
    kiosk.markAuthenticated()
    await router.push('/kiosk')

    await expect(getKioskMenu()).rejects.toMatchObject({ status: 401 })
    await flushPromises()

    expect(kiosk.deviceState).toBe('AUTH_FAILED')
    expect(kiosk.deviceState).not.toBe('REVOKED')
  })

  it('ends only the kiosk session for the Payment Edge UNAUTHENTICATED response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => unauthorized('UNAUTHENTICATED')),
    )
    await signIn('STAFF')
    const kiosk = useKioskSessionStore(pinia)
    kiosk.markAuthenticated()
    await router.push('/kiosk')

    await expect(getPayment('payment-1', 'kiosk')).rejects.toMatchObject({ status: 401 })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/kiosk/activate')
    expect(useOperatorSessionStore(pinia).authenticated).toBe(true)
    expect(kiosk.deviceState).toBe('AUTH_FAILED')
    expect(sessionStorage.getItem(ACTIVE_MARKER)).toBeNull()
  })
})

function unauthorized(code: string) {
  return new Response(JSON.stringify({ status: 401, code }), {
    status: 401,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
