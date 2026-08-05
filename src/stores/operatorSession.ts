import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { OperatorAuth, RoleCode } from '@/api/table'

export const useOperatorSessionStore = defineStore('operatorSession', () => {
  const apiBaseUrl = ref(import.meta.env.VITE_API_BASE_URL ?? '')
  const roleCode = ref<RoleCode>('MANAGER')
  const loginId = ref('')
  const password = ref('')

  const auth = computed<OperatorAuth>(() => ({
    apiBaseUrl: apiBaseUrl.value,
    loginId: loginId.value,
    password: password.value,
  }))

  const isTableManager = computed(() =>
    ['OWNER', 'MANAGER', 'ADMIN'].includes(roleCode.value),
  )
  const canManageSession = computed(() =>
    ['OWNER', 'MANAGER', 'ADMIN', 'STAFF'].includes(roleCode.value),
  )
  const canReadOrders = computed(() =>
    ['OWNER', 'MANAGER', 'ADMIN', 'STAFF'].includes(roleCode.value),
  )

  function clearPassword() {
    password.value = ''
  }

  return {
    apiBaseUrl,
    roleCode,
    loginId,
    password,
    auth,
    isTableManager,
    canManageSession,
    canReadOrders,
    clearPassword,
  }
})
