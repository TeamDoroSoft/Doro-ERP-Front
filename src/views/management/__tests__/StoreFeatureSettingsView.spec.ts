import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StoreFeatureSettingsView from '../StoreFeatureSettingsView.vue'
import {
  getStoreSettings,
  updateStoreFeatures,
  updateStoreProfile,
  updateStoreSchedule,
} from '@/api/storeSettings'
import type { StoreSettings, UpdateStoreFeaturesRequest } from '@/types/storeSettings'

vi.mock('@/api/storeSettings', () => ({
  getStoreSettings: vi.fn<typeof getStoreSettings>(),
  updateStoreProfile: vi.fn<typeof updateStoreProfile>(),
  updateStoreSchedule: vi.fn<typeof updateStoreSchedule>(),
  updateStoreFeatures: vi.fn<typeof updateStoreFeatures>(),
}))

const features: UpdateStoreFeaturesRequest = {
  customerFeatures: {
    WAITING: true,
    RESERVATION: false,
    QR_ORDER: true,
    PICKUP_ORDER: false,
  },
  notificationEvents: {
    WAITING_REGISTERED: true,
    WAITING_CALLED: false,
    RESERVATION_REQUESTED: true,
    RESERVATION_APPROVED: false,
    RESERVATION_REJECTED: true,
    RESERVATION_CHANGED: false,
    RESERVATION_CHANGE_REJECTED: true,
    RESERVATION_CANCELLED: false,
    RESERVATION_REMINDER: true,
    PICKUP_ORDER_RECEIVED: false,
    PICKUP_READY: true,
    PAYMENT_COMPLETED: false,
    PAYMENT_CANCELLED: true,
  },
}

const settings: StoreSettings = {
  profile: { name: '도루 카페', address: '서울', contact: '02-1234-5678', timeZone: 'Asia/Seoul' },
  schedule: { businessHours: {}, regularClosedDays: [], temporaryClosures: [], serviceWindows: {} },
  features,
  version: 3,
}

describe('StoreFeatureSettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(getStoreSettings).mockResolvedValue(structuredClone(settings))
  })

  it('reflects all loaded feature and notification settings', async () => {
    const wrapper = mount(StoreFeatureSettingsView)
    await flushPromises()

    expect(getStoreSettings).toHaveBeenCalledOnce()
    for (const [code, checked] of Object.entries(features.customerFeatures)) {
      expect((wrapper.get(`#feature-${code}`).element as HTMLInputElement).checked).toBe(checked)
    }
    for (const [code, checked] of Object.entries(features.notificationEvents)) {
      expect((wrapper.get(`#notification-${code}`).element as HTMLInputElement).checked).toBe(
        checked,
      )
    }
  })

  it('saves all 17 values after toggles change', async () => {
    const expected: UpdateStoreFeaturesRequest = {
      customerFeatures: { ...features.customerFeatures, RESERVATION: true },
      notificationEvents: { ...features.notificationEvents, PAYMENT_COMPLETED: true },
    }
    vi.mocked(updateStoreFeatures).mockResolvedValue({ features: expected, version: 4 })
    const wrapper = mount(StoreFeatureSettingsView)
    await flushPromises()

    await wrapper.get('#feature-RESERVATION').setValue(true)
    await wrapper.get('#notification-PAYMENT_COMPLETED').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateStoreFeatures).toHaveBeenCalledWith(expected, 3)
    const payload = vi.mocked(updateStoreFeatures).mock.calls[0]?.[0]
    expect(Object.keys(payload?.customerFeatures ?? {})).toHaveLength(4)
    expect(Object.keys(payload?.notificationEvents ?? {})).toHaveLength(13)
    expect(wrapper.text()).toContain('저장됐습니다.')
  })
})
