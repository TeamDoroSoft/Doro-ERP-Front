import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError } from '@/api/http'
import { activateKiosk, logoutKiosk, type KioskDeviceState } from '@/api/kiosk'

export const useKioskSessionStore = defineStore('kioskSession', () => {
  const activeMarkerKey = 'doro.kiosk-device-active'
  const restoring = ref(
      typeof sessionStorage !== 'undefined' && sessionStorage.getItem(activeMarkerKey) === '1',
    ),
    deviceState = ref<KioskDeviceState>('UNREGISTERED'),
    activating = ref(false)
  const canAccessProtected = computed(() => deviceState.value === 'ACTIVE' || restoring.value)
  async function activate(tenantCode: string, deviceCode: string, secret: string) {
    activating.value = true
    try {
      await activateKiosk(tenantCode, deviceCode, secret)
      markAuthenticated()
    } catch (reason) {
      deviceState.value = stateFor(reason)
      sessionStorage.removeItem(activeMarkerKey)
      throw reason
    } finally {
      activating.value = false
    }
  }
  async function logout(secret: string) {
    await logoutKiosk(secret)
    markUnauthenticated()
  }
  function stateFor(reason: unknown): KioskDeviceState {
    if (reason instanceof ApiError) {
      if (reason.code.includes('INACTIVE') || reason.status === 409) return 'INACTIVE'
    }
    return 'AUTH_FAILED'
  }
  function markUnauthenticated() {
    deviceState.value = 'UNREGISTERED'
    restoring.value = false
    sessionStorage.removeItem(activeMarkerKey)
  }
  function markAuthenticationFailed() {
    deviceState.value = 'AUTH_FAILED'
    restoring.value = false
    sessionStorage.removeItem(activeMarkerKey)
  }
  function markAuthenticated() {
    deviceState.value = 'ACTIVE'
    restoring.value = false
    sessionStorage.setItem(activeMarkerKey, '1')
  }
  return {
    deviceState,
    restoring,
    canAccessProtected,
    activating,
    activate,
    logout,
    markAuthenticated,
    markUnauthenticated,
    markAuthenticationFailed,
  }
})
