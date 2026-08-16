import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { LoginResponse } from '@/api/auth'

export type EmployeeRole = 'OWNER' | 'MANAGER' | 'STAFF'
export type AuthenticationStatus = 'anonymous' | 'authenticated'

interface StoredOperatorSession {
  employeeId: string
  role: EmployeeRole
  tenantCode: string
  passwordChangeRequired: boolean
  isPreview: boolean
}

const sessionStorageKey = 'doro-erp.operator-session'

function isRole(value: unknown): value is EmployeeRole {
  return value === 'OWNER' || value === 'MANAGER' || value === 'STAFF'
}

function readStoredSession(): StoredOperatorSession | null {
  if (typeof sessionStorage === 'undefined') return null
  const serialized = sessionStorage.getItem(sessionStorageKey)
  if (serialized) {
    try {
      const value = JSON.parse(serialized) as Partial<StoredOperatorSession>
      if (
        typeof value.employeeId === 'string' &&
        isRole(value.role) &&
        typeof value.tenantCode === 'string' &&
        typeof value.passwordChangeRequired === 'boolean' &&
        (value.isPreview === undefined || typeof value.isPreview === 'boolean')
      ) {
        const isPreview = value.isPreview === true
        if (isPreview && !import.meta.env.DEV) return null
        return { ...value, isPreview } as StoredOperatorSession
      }
    } catch {
      sessionStorage.removeItem(sessionStorageKey)
    }
  }

  return null
}

export const useOperatorSessionStore = defineStore('operatorSession', () => {
  const stored = readStoredSession()
  const employeeId = ref(stored?.employeeId ?? '')
  const role = ref<EmployeeRole | null>(stored?.role ?? null)
  const tenantCode = ref(stored?.tenantCode ?? '')
  const passwordChangeRequired = ref(stored?.passwordChangeRequired ?? false)
  const isPreview = ref(stored?.isPreview ?? false)
  const status = ref<AuthenticationStatus>(stored ? 'authenticated' : 'anonymous')
  const initialized = ref(true)

  const authenticated = computed(() => status.value === 'authenticated' && role.value !== null)
  const canManageTables = computed(() => role.value === 'OWNER' || role.value === 'MANAGER')
  const roleLabel = computed(() => {
    if (role.value === 'OWNER') return '최고 관리자'
    if (role.value === 'MANAGER') return '관리자'
    if (role.value === 'STAFF') return '직원'
    return '권한 확인 전'
  })

  function applyLogin(response: LoginResponse, authenticatedTenantCode: string) {
    employeeId.value = response.employeeId
    role.value = response.role
    tenantCode.value = authenticatedTenantCode
    passwordChangeRequired.value = response.passwordChangeRequired
    isPreview.value = false
    status.value = 'authenticated'
    persist()
  }

  function applyPreview() {
    if (!import.meta.env.DEV) return
    employeeId.value = ''
    role.value = 'OWNER'
    tenantCode.value = ''
    passwordChangeRequired.value = false
    isPreview.value = true
    status.value = 'authenticated'
    persist()
  }

  function setRole(nextRole: EmployeeRole) {
    role.value = nextRole
    status.value = 'authenticated'
    persist()
  }

  function clearSession() {
    employeeId.value = ''
    role.value = null
    tenantCode.value = ''
    passwordChangeRequired.value = false
    isPreview.value = false
    status.value = 'anonymous'
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(sessionStorageKey)
    }
  }

  function clearRole() {
    clearSession()
  }

  function persist() {
    if (typeof sessionStorage === 'undefined' || role.value === null) return
    const value: StoredOperatorSession = {
      employeeId: employeeId.value,
      role: role.value,
      tenantCode: tenantCode.value,
      passwordChangeRequired: passwordChangeRequired.value,
      isPreview: isPreview.value,
    }
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(value))
  }

  return {
    employeeId,
    role,
    tenantCode,
    passwordChangeRequired,
    isPreview,
    status,
    initialized,
    authenticated,
    canManageTables,
    roleLabel,
    applyLogin,
    applyPreview,
    setRole,
    clearSession,
    clearRole,
  }
})
