import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import { useOperatorSessionStore } from '@/stores/operatorSession'

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
})
