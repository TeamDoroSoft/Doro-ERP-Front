import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOperatorSessionStore } from '@/stores/operatorSession'

describe('operatorSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('applies the login response and role without storing a credential', () => {
    const store = useOperatorSessionStore()
    store.applyLogin(
      { employeeId: 'employee-1', role: 'MANAGER', passwordChangeRequired: true },
      'doro-store',
    )

    expect(store.authenticated).toBe(true)
    expect(store.role).toBe('MANAGER')
    expect(store.roleLabel).toBe('관리자')
    expect(store.passwordChangeRequired).toBe(true)
    const persisted = JSON.parse(String(sessionStorage.getItem('doro-erp.operator-session')))
    expect(persisted).toEqual({
      employeeId: 'employee-1',
      role: 'MANAGER',
      tenantCode: 'doro-store',
      passwordChangeRequired: true,
      isPreview: false,
    })
    expect(persisted).not.toHaveProperty('credential')
  })

  it('clears all frontend authentication hints', () => {
    const store = useOperatorSessionStore()
    store.applyLogin({ employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: false }, 'doro')
    store.clearSession()

    expect(store.authenticated).toBe(false)
    expect(store.role).toBeNull()
    expect(sessionStorage.getItem('doro-erp.operator-session')).toBeNull()
    expect(sessionStorage.getItem('doro-erp.employee-role')).toBeNull()
  })

  it('does not authenticate from the retired role-only storage hint', () => {
    sessionStorage.setItem('doro-erp.employee-role', 'OWNER')
    const store = useOperatorSessionStore()

    expect(store.authenticated).toBe(false)
    expect(store.role).toBeNull()
  })

  it('applies an OWNER-only frontend preview state in development', () => {
    const store = useOperatorSessionStore()
    store.applyPreview()

    expect(store.authenticated).toBe(true)
    expect(store.role).toBe('OWNER')
    expect(store.isPreview).toBe(true)
    expect(store.employeeId).toBe('')
    expect(store.tenantCode).toBe('')
  })
})
