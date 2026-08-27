import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import {
  getKioskRuntime,
  kioskModeHome,
  type KioskRuntime,
} from '@/api/kioskRuntime'

export const useKioskRuntimeStore = defineStore('kioskRuntime', () => {
  const runtime = ref<KioskRuntime | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')
  const homePath = computed(() => (runtime.value ? kioskModeHome[runtime.value.mode] : null))

  async function load() {
    loading.value = true
    errorMessage.value = ''
    try {
      runtime.value = await getKioskRuntime()
      return runtime.value
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) runtime.value = null
      errorMessage.value = safeApiErrorMessage(
        error,
        '기기 설정을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      )
      throw error
    } finally {
      loading.value = false
    }
  }

  /** A mode 403 means the authenticated device may have changed modes; reload, do not log out. */
  async function recoverModeMismatch(error: unknown) {
    if (!(error instanceof ApiError) || error.code !== 'KIOSK_MODE_FORBIDDEN') return false
    await load()
    return true
  }

  function clear() {
    runtime.value = null
    errorMessage.value = ''
  }

  return { runtime, loading, errorMessage, homePath, load, recoverModeMismatch, clear }
})
