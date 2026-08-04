import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/http'
import {
  getStoreSettings,
  updateStoreFeatures,
  updateStoreProfile,
  updateStoreSchedule,
} from '@/api/storeSettings'
import type { StoreSettings, UpdateStoreScheduleRequest } from '@/types/storeSettings'
import StoreScheduleView from '../StoreScheduleView.vue'

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
  schedule: {
    businessHours: { MONDAY: [{ start: '09:00', end: '22:00' }] },
    regularClosedDays: ['SUNDAY'],
    temporaryClosures: [{ date: '2026-08-15', reason: '시설 점검' }],
    serviceWindows: {
      ORDER: { MONDAY: [{ start: '09:30', end: '21:30' }] },
      RESERVATION: {},
    },
  },
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

describe('StoreScheduleView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(getStoreSettings).mockResolvedValue(structuredClone(settings))
  })

  it('loads and displays all schedule areas', async () => {
    const wrapper = mount(StoreScheduleView)
    await flushPromises()

    expect(getStoreSettings).toHaveBeenCalledOnce()
    expect((wrapper.get('#business-MONDAY-0-start').element as HTMLInputElement).value).toBe(
      '09:00',
    )
    expect((wrapper.get('#order-MONDAY-0-end').element as HTMLInputElement).value).toBe('21:30')
    expect((wrapper.get('#closure-0-date').element as HTMLInputElement).value).toBe('2026-08-15')
    expect(
      (wrapper.get('input[type="checkbox"][value="SUNDAY"]').element as HTMLInputElement).checked,
    ).toBe(true)
  })

  it('adds a period and omits empty day keys from the save payload', async () => {
    const wrapper = mount(StoreScheduleView)
    await flushPromises()

    await wrapper.get('button[aria-label="화요일 영업시간 구간 추가"]').trigger('click')
    await wrapper.get('#business-TUESDAY-0-start').setValue('22:00')
    await wrapper.get('#business-TUESDAY-0-end').setValue('02:00')

    const expectedPayload: UpdateStoreScheduleRequest = {
      businessHours: {
        MONDAY: [{ start: '09:00', end: '22:00' }],
        TUESDAY: [{ start: '22:00', end: '02:00' }],
      },
      regularClosedDays: ['SUNDAY'],
      temporaryClosures: [{ date: '2026-08-15', reason: '시설 점검' }],
      serviceWindows: {
        ORDER: { MONDAY: [{ start: '09:30', end: '21:30' }] },
        RESERVATION: {},
      },
    }
    vi.mocked(updateStoreSchedule).mockResolvedValue({ schedule: expectedPayload, version: 4 })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateStoreSchedule).toHaveBeenCalledWith(expectedPayload, 3)
    expect(wrapper.text()).toContain('저장됐습니다.')
  })

  it('shows the server detail and translates field paths', async () => {
    vi.mocked(updateStoreSchedule).mockRejectedValue(
      new ApiError({
        status: 400,
        code: 'SERVICE_WINDOW_OUTSIDE_BUSINESS_HOURS',
        detail: '서비스 시간이 영업시간을 벗어났습니다.',
        requestId: 'request-1',
        fieldErrors: [
          { field: 'serviceWindows.RESERVATION.MONDAY', code: 'OUTSIDE_BUSINESS_HOURS' },
        ],
      }),
    )
    const wrapper = mount(StoreScheduleView)
    await flushPromises()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('서비스 시간이 영업시간을 벗어났습니다.')
    expect(wrapper.text()).toContain('예약 가능 시간(월요일):')
    expect(wrapper.text()).toContain('OUTSIDE_BUSINESS_HOURS')
  })
})
