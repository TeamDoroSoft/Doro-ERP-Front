import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getStoreSettings,
  updateStoreFeatures,
  updateStoreProfile,
  updateStoreSchedule,
} from '@/api/storeSettings'
import { ApiError } from '@/api/http'
import type {
  StoreSettings,
  UpdateStoreFeaturesRequest,
  UpdateStoreProfileRequest,
  UpdateStoreScheduleRequest,
} from '@/types/storeSettings'

export const useStoreSettingsStore = defineStore('storeSettings', () => {
  const settings = ref<StoreSettings | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  function requireSettings(): StoreSettings {
    if (settings.value) {
      return settings.value
    }

    throw new ApiError({
      status: 0,
      code: 'STORE_SETTINGS_NOT_LOADED',
      detail: '매장 설정을 먼저 불러와 주세요.',
      requestId: '',
      fieldErrors: [],
    })
  }

  async function run<T>(operation: () => Promise<T>): Promise<T> {
    loading.value = true
    error.value = null
    try {
      return await operation()
    } catch (caught) {
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError({
              status: 0,
              code: 'UNKNOWN_ERROR',
              detail: '알 수 없는 오류가 발생했습니다.',
              requestId: '',
              fieldErrors: [],
            })
      error.value = apiError
      throw apiError
    } finally {
      loading.value = false
    }
  }

  async function load(): Promise<void> {
    await run(async () => {
      settings.value = await getStoreSettings()
    })
  }

  async function saveProfile(payload: UpdateStoreProfileRequest): Promise<void> {
    await run(async () => {
      const current = requireSettings()
      const result = await updateStoreProfile(payload, current.version)
      current.profile = result.profile
      current.version = result.version
    })
  }

  async function saveSchedule(payload: UpdateStoreScheduleRequest): Promise<void> {
    await run(async () => {
      const current = requireSettings()
      const result = await updateStoreSchedule(payload, current.version)
      current.schedule = result.schedule
      current.version = result.version
    })
  }

  async function saveFeatures(payload: UpdateStoreFeaturesRequest): Promise<void> {
    await run(async () => {
      const current = requireSettings()
      const result = await updateStoreFeatures(payload, current.version)
      current.features = result.features
      current.version = result.version
    })
  }

  return { settings, loading, error, load, saveProfile, saveSchedule, saveFeatures }
})
