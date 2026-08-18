import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import { useKioskSessionStore } from '@/stores/kioskSession'

describe('POS authentication & role guard', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    setActivePinia(createPinia())
    await router.push('/pos/login')
  })

  it('redirects an anonymous visit to /pos/login with redirect query', async () => {
    await router.push('/pos/orders?paymentKey=must-not-survive#secret')
    expect(router.currentRoute.value.path).toBe('/pos/login')
    expect(router.currentRoute.value.query.redirect).toBe('/pos/orders')
    expect(router.currentRoute.value.hash).toBe('')
  })

  it('redirects root / and /pos to /pos/orders', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false },
      'doro',
    )
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/pos/orders')

    await router.push('/pos')
    expect(router.currentRoute.value.path).toBe('/pos/orders')
  })

  it('allows an authenticated employee into /pos/orders', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false },
      'doro',
    )
    await router.push('/pos/orders')
    expect(router.currentRoute.value.path).toBe('/pos/orders')
  })

  it('restricts a temporary-password session to /pos/account/change-password', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'OWNER', passwordChangeRequired: true },
      'doro',
    )
    await router.push('/pos/orders')
    expect(router.currentRoute.value.path).toBe('/pos/account/change-password')
  })

  it('restricts STAFF role from accessing manager-only routes (/pos/tables, /pos/settings)', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false },
      'doro',
    )
    await router.push('/pos/tables')
    expect(router.currentRoute.value.path).toBe('/pos/orders')
    expect(router.currentRoute.value.query.reason).toBe('forbidden')

    await router.push('/pos/settings')
    expect(router.currentRoute.value.path).toBe('/pos/orders')
    expect(router.currentRoute.value.query.reason).toBe('forbidden')
  })

  it('allows MANAGER and OWNER roles into manager-only routes', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'manager-1', role: 'MANAGER', passwordChangeRequired: false },
      'doro',
    )
    await router.push('/pos/tables')
    expect(router.currentRoute.value.path).toBe('/pos/tables')

    await router.push('/pos/settings')
    expect(router.currentRoute.value.path).toBe('/pos/settings')
  })

  it('redirects legacy /admin routes to corresponding /pos routes', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'owner-1', role: 'OWNER', passwordChangeRequired: false },
      'doro',
    )
    await router.push('/admin/dashboard?paymentKey=must-not-survive#secret')
    expect(router.currentRoute.value.path).toBe('/pos/orders')
    expect(router.currentRoute.value.query).toEqual({})
    expect(router.currentRoute.value.hash).toBe('')

    await router.push('/admin/tables')
    expect(router.currentRoute.value.path).toBe('/pos/tables')
  })

  it('removes the retired standalone payment screen without forwarding input query values', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false },
      'doro',
    )

    await router.push('/payments/test?orderId=untrusted&amount=1#secret')

    expect(router.currentRoute.value.path).toBe('/pos/orders')
    expect(router.currentRoute.value.query).toEqual({})
    expect(router.currentRoute.value.hash).toBe('')
  })

  it('requires an employee session for Toss callback processing and drops sensitive query values', async () => {
    await router.push(
      '/payments/toss/success?flow=flow-1&paymentKey=must-not-survive&orderId=provider&amount=1',
    )

    expect(router.currentRoute.value.path).toBe('/pos/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/payments/toss/success' })
  })

  it('safely handles an unknown route without retaining its location data', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false },
      'doro',
    )

    await router.push('/unknown/path?paymentKey=must-not-survive#secret')

    expect(router.currentRoute.value.path).toBe('/pos/orders')
    expect(router.currentRoute.value.query).toEqual({ reason: 'not-found' })
    expect(router.currentRoute.value.hash).toBe('')
  })
  it('blocks STAFF from the owner/manager security history screen', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false },
      'doro',
    )

    await router.push('/pos/history')

    expect(router.currentRoute.value.path).toBe('/pos/orders')
    expect(router.currentRoute.value.query.reason).toBe('forbidden')
  })

  it('never accepts a kiosk device session as employee authentication', async () => {
    useKioskSessionStore().markAuthenticated()

    for (const path of ['/pos/orders', '/pos/history', '/pos/settings']) {
      await router.push(path)
      expect(router.currentRoute.value.path).toBe('/pos/login')
      expect(router.currentRoute.value.query.redirect).toBe(path)
    }
  })

  it('never activates the kiosk device from an employee session or its stored hint', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'owner', role: 'OWNER', passwordChangeRequired: false },
      'doro',
    )
    const kiosk = useKioskSessionStore()
    expect(kiosk.deviceState).toBe('UNREGISTERED')
    expect(kiosk.canAccessProtected).toBe(false)

    await router.push('/kiosk/cart')
    expect(router.currentRoute.value.path).toBe('/kiosk/activate')

    // A stale UX hint alone must not survive a rejected device authentication.
    kiosk.markAuthenticated()
    kiosk.markAuthenticationFailed()
    await router.push('/kiosk/cart')
    expect(router.currentRoute.value.path).toBe('/kiosk/activate')
  })

  it('keeps kiosk guards independent from employee authentication', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'owner', role: 'OWNER', passwordChangeRequired: false },
      'doro',
    )
    await router.push('/kiosk')
    expect(router.currentRoute.value.path).toBe('/kiosk/activate')
    useKioskSessionStore().deviceState = 'ACTIVE'
    await router.push('/kiosk')
    expect(router.currentRoute.value.name).toBe('kiosk-menu')
    useOperatorSessionStore().clearSession()
    await router.push('/kiosk/cart')
    expect(router.currentRoute.value.path).toBe('/kiosk/cart')
  })
})
