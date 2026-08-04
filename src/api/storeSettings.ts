import { request } from './http'
import type {
  StoreFeatureSettingsUpdateResult,
  StoreProfileUpdateResult,
  StoreScheduleUpdateResult,
  StoreSettings,
  UpdateStoreFeaturesRequest,
  UpdateStoreProfileRequest,
  UpdateStoreScheduleRequest,
} from '@/types/storeSettings'

export function getStoreSettings(): Promise<StoreSettings> {
  return request<StoreSettings>('/store-settings')
}

export function updateStoreProfile(
  payload: UpdateStoreProfileRequest,
  version: number,
): Promise<StoreProfileUpdateResult> {
  return request<StoreProfileUpdateResult>('/store-settings/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
    version,
  })
}

export function updateStoreSchedule(
  payload: UpdateStoreScheduleRequest,
  version: number,
): Promise<StoreScheduleUpdateResult> {
  return request<StoreScheduleUpdateResult>('/store-settings/schedule', {
    method: 'PUT',
    body: JSON.stringify(payload),
    version,
  })
}

export function updateStoreFeatures(
  payload: UpdateStoreFeaturesRequest,
  version: number,
): Promise<StoreFeatureSettingsUpdateResult> {
  return request<StoreFeatureSettingsUpdateResult>('/store-settings/features', {
    method: 'PUT',
    body: JSON.stringify(payload),
    version,
  })
}
