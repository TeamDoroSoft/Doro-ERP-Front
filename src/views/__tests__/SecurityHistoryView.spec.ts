import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiError } from '@/api/http'
import type { SecurityPage } from '@/api/administration'
import SecurityHistoryView from '@/views/SecurityHistoryView.vue'

const administrationApi = vi.hoisted(() => ({
  getSecurityHistory: vi.fn<() => Promise<SecurityPage>>(),
}))

vi.mock('@/api/administration', () => administrationApi)

const contractPage: SecurityPage = {
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      eventType: 'EMPLOYEE_LOGIN_FAILED',
      actorEmployeeId: null,
      targetType: 'EMPLOYEE',
      targetId: '22222222-2222-4222-8222-222222222222',
      result: 'FAILURE',
      reasonCode: 'AUTHENTICATION_FAILED',
      previousValue: null,
      newValue: null,
      occurredAt: '2026-08-25T09:00:00Z',
    },
  ],
  nextCursorOccurredAt: null,
  nextCursorId: null,
  hasMore: false,
}

describe('SecurityHistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    administrationApi.getSecurityHistory.mockResolvedValue(contractPage)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('initializes datetime filters with browser-local values', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T10:00:00Z'))
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-540)

    const wrapper = mount(SecurityHistoryView)
    await flushPromises()
    const dateTimeInputs = wrapper.findAll<HTMLInputElement>('input[type="datetime-local"]')

    expect(dateTimeInputs[0]?.element.value).toBe('2026-08-19T19:00')
    expect(dateTimeInputs[1]?.element.value).toBe('2026-08-26T19:00')
  })

  it('renders a full login-history contract record including a nullable actor', async () => {
    const wrapper = mount(SecurityHistoryView)
    await flushPromises()

    expect(wrapper.text()).toContain('로그인 실패')
    expect(wrapper.text()).toContain('시스템')
    expect(wrapper.text()).toContain('일반적인 정상 로그인·로그아웃은 기록하지 않으며')
    expect(wrapper.text()).toContain('22222222-2222-4222-8222-222222222222')
    expect(wrapper.text()).toContain('실패')
    expect(wrapper.text()).not.toContain('로그인·보안 기록이 없습니다')
  })

  it('distinguishes an empty result from an API error', async () => {
    administrationApi.getSecurityHistory.mockResolvedValue({
      items: [], nextCursorOccurredAt: null, nextCursorId: null, hasMore: false,
    })
    const empty = mount(SecurityHistoryView)
    await flushPromises()
    expect(empty.text()).toContain('로그인·보안 기록이 없습니다')

    administrationApi.getSecurityHistory.mockRejectedValue(
      new ApiError(503, { code: 'STORE_ACCESS_UNAVAILABLE', requestId: 'req-security-1' }),
    )
    const failed = mount(SecurityHistoryView)
    await flushPromises()
    expect(failed.get('[role="alert"]').text()).toContain('일시적으로 사용할 수 없습니다')
    expect(failed.text()).toContain('req-security-1')
    expect(failed.text()).not.toContain('로그인·보안 기록이 없습니다')
  })
})
