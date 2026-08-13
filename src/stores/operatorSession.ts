import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type EmployeeRole = 'OWNER' | 'MANAGER' | 'STAFF'

const roleStorageKey = 'doro-erp.employee-role'

function readStoredRole(): EmployeeRole | null {
  if (typeof sessionStorage === 'undefined') return null

  const role = sessionStorage.getItem(roleStorageKey)
  return role === 'OWNER' || role === 'MANAGER' || role === 'STAFF' ? role : null
}

export const useOperatorSessionStore = defineStore('operatorSession', () => {
  const role = ref<EmployeeRole | null>(readStoredRole())
  const canManageTables = computed(() => role.value === 'OWNER' || role.value === 'MANAGER')

  function setRole(nextRole: EmployeeRole) {
    role.value = nextRole
    sessionStorage.setItem(roleStorageKey, nextRole)
  }

  function clearRole() {
    role.value = null
    sessionStorage.removeItem(roleStorageKey)
  }

  return { role, canManageTables, setRole, clearRole }
})
