import { ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError } from '@/api/http'
import { activateKiosk, type KioskDeviceState } from '@/api/kiosk'

export const useKioskSessionStore = defineStore('kioskSession', () => {
  const activeMarkerKey = 'doro.kiosk-device-active'
  const deviceState = ref<KioskDeviceState>(
      typeof sessionStorage !== 'undefined' && sessionStorage.getItem(activeMarkerKey) === '1'
        ? 'ACTIVE'
        : 'UNREGISTERED',
    ),
    activating = ref(false)
  async function activate(tenantCode: string, deviceCode: string, secret: string) {
    activating.value = true
    try {
      await activateKiosk(tenantCode, deviceCode, secret)
      deviceState.value = 'ACTIVE'
      sessionStorage.setItem(activeMarkerKey, '1')
    } catch (reason) {
      deviceState.value = stateFor(reason)
      sessionStorage.removeItem(activeMarkerKey)
      throw reason
    } finally {
      activating.value = false
    }
  }
  function stateFor(reason: unknown): KioskDeviceState {
    if (reason instanceof ApiError) {
      if (reason.code.includes('INACTIVE') || reason.status === 409) return 'INACTIVE'
    }
    return 'AUTH_FAILED'
  }
  function markUnauthenticated() {
    deviceState.value = 'UNREGISTERED'
    sessionStorage.removeItem(activeMarkerKey)
  }
  return { deviceState, activating, activate, markUnauthenticated }
})
