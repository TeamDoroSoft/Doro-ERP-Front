import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StoreProfileView from '../StoreProfileView.vue'
import {
  getStoreSettings,
  updateStoreFeatures,
  updateStoreProfile,
  updateStoreSchedule,
} from '@/api/storeSettings'
import type { StoreSettings } from '@/types/storeSettings'

vi.mock('@/api/storeSettings', () => ({
  getStoreSettings: vi.fn<typeof getStoreSettings>(),
  updateStoreProfile: vi.fn<typeof updateStoreProfile>(),
  updateStoreSchedule: vi.fn<typeof updateStoreSchedule>(),
  updateStoreFeatures: vi.fn<typeof updateStoreFeatures>(),
}))

const settings: StoreSettings = {
  profile: {
    name: '도루 카페',
    address: '서울특별시 중구 예시로 1',
    contact: '02-1234-5678',
    timeZone: 'Asia/Seoul',
  },
  schedule: { businessHours: {}, regularClosedDays: [], temporaryClosures: [], serviceWindows: {} },
  features: {
    customerFeatures: {
      WAITING: false,
      RESERVATION: false,
      QR_ORDER: false,
      PICKUP_ORDER: false,
    },
    notificationEvents: {
      WAITING_REGISTERED: false,
      WAITING_CALLED: false,
      RESERVATION_REQUESTED: false,
      RESERVATION_APPROVED: false,
      RESERVATION_REJECTED: false,
      RESERVATION_CHANGED: false,
      RESERVATION_CHANGE_REJECTED: false,
      RESERVATION_CANCELLED: false,
      RESERVATION_REMINDER: false,
      PICKUP_ORDER_RECEIVED: false,
      PICKUP_READY: false,
      PAYMENT_COMPLETED: false,
      PAYMENT_CANCELLED: false,
    },
  },
  version: 3,
}

describe('StoreProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(getStoreSettings).mockResolvedValue(structuredClone(settings))
  })

  it('loads the store settings and fills the form', async () => {
    const wrapper = mount(StoreProfileView)
    await flushPromises()

    expect(getStoreSettings).toHaveBeenCalledOnce()
    expect((wrapper.get('#store-name').element as HTMLInputElement).value).toBe('도루 카페')
    expect((wrapper.get('#store-address').element as HTMLInputElement).value).toBe(
      '서울특별시 중구 예시로 1',
    )
    expect((wrapper.get('#store-contact').element as HTMLInputElement).value).toBe('02-1234-5678')
    expect((wrapper.get('#store-time-zone').element as HTMLInputElement).value).toBe('Asia/Seoul')
  })

  it('saves the trimmed form values with the current version', async () => {
    vi.mocked(updateStoreProfile).mockResolvedValue({
      profile: {
        name: '새 매장',
        address: '새 주소',
        contact: '010-1111-2222',
        timeZone: 'Asia/Seoul',
      },
      version: 4,
    })
    const wrapper = mount(StoreProfileView)
    await flushPromises()

    await wrapper.get('#store-name').setValue('  새 매장  ')
    await wrapper.get('#store-address').setValue(' 새 주소 ')
    await wrapper.get('#store-contact').setValue(' 010-1111-2222 ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateStoreProfile).toHaveBeenCalledWith(
      {
        name: '새 매장',
        address: '새 주소',
        contact: '010-1111-2222',
        timeZone: 'Asia/Seoul',
      },
      3,
    )
    expect(wrapper.text()).toContain('저장됐습니다.')
  })
})
