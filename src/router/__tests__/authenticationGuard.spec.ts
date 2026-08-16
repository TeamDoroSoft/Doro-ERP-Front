import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import { useOperatorSessionStore } from '@/stores/operatorSession'

describe('admin authentication guard', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    setActivePinia(createPinia())
    await router.push('/login')
  })

  it('redirects an anonymous admin visit to login', async () => {
    await router.push('/admin/dashboard')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/admin/dashboard')
  })

  it('allows an authenticated employee into admin', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false },
      'doro',
    )
    await router.push('/admin/dashboard')
    expect(router.currentRoute.value.path).toBe('/admin/dashboard')
  })

  it('restricts a temporary-password session to password change', async () => {
    useOperatorSessionStore().applyLogin(
      { employeeId: 'employee-1', role: 'OWNER', passwordChangeRequired: true },
      'doro',
    )
    await router.push('/admin/dashboard')
    expect(router.currentRoute.value.path).toBe('/account/change-password')
  })
})
