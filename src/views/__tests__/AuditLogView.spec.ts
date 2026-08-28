import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/http'
import type { AuditListParams, AuditPage, AuditRecord } from '@/api/audit'
import AuditLogView from '@/views/AuditLogView.vue'
import { useOperatorSessionStore, type EmployeeRole } from '@/stores/operatorSession'
import { nextTick } from 'vue'

const auditApi = vi.hoisted(() => ({
  getAudits: vi.fn<(params: AuditListParams) => Promise<AuditPage>>(),
  getAudit: vi.fn<(id: string) => Promise<AuditRecord>>(),
}))

vi.mock('@/api/audit', () => auditApi)

const item: AuditRecord = {
  id: '0f6f9f0c-6a1f-4a2f-9a2b-2c9a0e4f3b71',
  sourceService: 'commerce',
  eventId: '9c7a3f2b-1e5d-4a2b-9c11-abcdef123456',
  action: 'ORDER_ACCEPTED',
  actor: { type: 'EMPLOYEE', id: '6a1f4a2f-9a2b-4c9a-0e4f-3b710f6f9f0c', role: 'MANAGER' },
  target: { type: 'ORDER', id: '3f2b9c7a-1e5d-4a2b-9c11-abcdef123456' },
  result: 'SUCCESS',
  reasonCode: null,
  metadata: { orderChannel: 'POS' },
  traceId: 'req-3f2b9c7a',
  occurredAt: '2026-08-07T09:00:00Z',
}

describe('AuditLogView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setActivePinia(createPinia())
    auditApi.getAudits.mockResolvedValue({ items: [item], nextCursor: null })
    auditApi.getAudit.mockResolvedValue(item)
  })

  it('renders and loads the audit table for an allowed role', async () => {
    const wrapper = mountView('MANAGER')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('운영 변경 내역')
    expect(wrapper.text()).not.toContain('ORDER_ACCEPTED')
    expect(wrapper.text()).toContain('주문 확정')
    expect(wrapper.text()).toContain('주문')
    expect(wrapper.text()).toContain('매니저')
    expect(auditApi.getAudits).toHaveBeenCalledOnce()
  })

  it('keeps the loading layout stable', async () => {
    auditApi.getAudits.mockReturnValue(new Promise(() => undefined))
    const wrapper = mountView('OWNER')
    await nextTick()
    expect(wrapper.get('[role="status"]').text()).toContain('불러오는 중')
  })

  it('shows the empty state', async () => {
    auditApi.getAudits.mockResolvedValue({ items: [], nextCursor: null })
    const wrapper = mountView('OWNER')
    await flushPromises()
    expect(wrapper.text()).toContain('운영 변경 내역이 없습니다')
  })

  it('shows API and forbidden errors without redirecting', async () => {
    auditApi.getAudits.mockRejectedValue(new ApiError(403, { code: 'AUDIT_ROLE_NOT_ALLOWED', requestId: 'req-1' }))
    const wrapper = mountView('MANAGER')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('이 기능에 접근할 권한이 없습니다')
    expect(wrapper.text()).toContain('req-1')
  })

  it('applies only supported filters and resets them', async () => {
    const wrapper = mountView('OWNER')
    await flushPromises()
    await wrapper.get('select[name="action"]').setValue('ORDER_ACCEPTED')
    await wrapper.get('select[name="targetType"]').setValue('ORDER')
    await wrapper.get('select[name="targetId"]').setValue(item.target.id)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(auditApi.getAudits).toHaveBeenLastCalledWith(expect.objectContaining({
      action: 'ORDER_ACCEPTED', targetType: 'ORDER', targetId: item.target.id, size: 20,
    }))
    const reset = wrapper.findAll('button').find((button) => button.text() === '초기화')!
    await reset.trigger('click')
    await flushPromises()
    expect((wrapper.get('select[name="action"]').element as HTMLSelectElement).value).toBe('')
  })

  it('offers known and observed filter values and clears an incompatible target number', async () => {
    const futureTargetId = '11111111-1111-4111-8111-111111111111'
    auditApi.getAudits
      .mockResolvedValueOnce({
        items: [
          { ...item, action: 'FUTURE_ACTION', target: { type: 'FUTURE_TARGET', id: futureTargetId } },
          { ...item, id: 'another-record', target: { type: 'FUTURE_TARGET', id: '00000000-0000-0000-0000-000000000000' } },
        ],
        nextCursor: 'next-page',
      })
      .mockResolvedValue({ items: [], nextCursor: null })
    const wrapper = mountView('OWNER')
    await flushPromises()

    expect(wrapper.get('select[name="action"]').text()).toContain('FUTURE_ACTION')
    expect(wrapper.get('select[name="targetType"]').text()).toContain('FUTURE_TARGET')
    await wrapper.get('select[name="targetType"]').setValue('FUTURE_TARGET')
    expect(wrapper.get('select[name="targetId"]').text()).toContain('00000000-0000-0000-0000-000000000000')
    await wrapper.get('select[name="targetId"]').setValue(futureTargetId)
    await wrapper.get('select[name="targetType"]').setValue('ORDER')
    expect((wrapper.get('select[name="targetId"]').element as HTMLSelectElement).value).toBe('')

    await findButton(wrapper, '다음').trigger('click')
    await flushPromises()
    expect(wrapper.get('select[name="action"]').text()).toContain('FUTURE_ACTION')
    expect(wrapper.get('select[name="targetType"]').text()).toContain('FUTURE_TARGET')
  })

  it('requires a target number when only a target type is selected without querying', async () => {
    const wrapper = mountView('OWNER')
    await flushPromises()
    const callsBeforeSubmit = auditApi.getAudits.mock.calls.length
    await wrapper.get('select[name="targetType"]').setValue('ORDER')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toContain('대상 유형과 대상 번호를 함께')
    expect(auditApi.getAudits).toHaveBeenCalledTimes(callsBeforeSubmit)
  })

  it('uses the opaque next cursor and resets it when filtering page two', async () => {
    auditApi.getAudits.mockResolvedValueOnce({ items: [item], nextCursor: 'opaque-next' }).mockResolvedValue({ items: [item], nextCursor: null })
    const wrapper = mountView('OWNER')
    await flushPromises()
    await findButton(wrapper, '다음').trigger('click')
    await flushPromises()
    expect(auditApi.getAudits).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'opaque-next' }))
    await wrapper.get('select[name="action"]').setValue('ORDER_ACCEPTED')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auditApi.getAudits).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }))
  })

  it('loads the selected record into a detail drawer', async () => {
    const wrapper = mountView('MANAGER')
    await flushPromises()
    await wrapper.get('[aria-label="변경 기록 상세 보기"]').trigger('click')
    await flushPromises()
    expect(auditApi.getAudit).toHaveBeenCalledWith(item.id)
    expect(wrapper.get('#audit-detail-title').text()).toBe('변경 기록 상세')
    expect(wrapper.text()).not.toContain('orderChannel')
    expect(wrapper.text()).not.toContain('req-3f2b9c7a')
  })

  it('renders an int64 metadata amount without rounding it', async () => {
    auditApi.getAudit.mockResolvedValue({
      ...item,
      metadata: { totalAmount: '9007199254740993', currency: 'KRW', soldOut: false },
    })
    const wrapper = mountView('OWNER')
    await flushPromises()
    await wrapper.get('[aria-label="변경 기록 상세 보기"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('9007199254740993')
    expect(wrapper.text()).not.toContain('totalAmount')
    expect(wrapper.text()).not.toContain('false')
  })

  it('denies STAFF in the UX and does not call the API', () => {
    const wrapper = mountView('STAFF')
    expect(wrapper.text()).toContain('점주와 매니저만 조회')
    expect(auditApi.getAudits).not.toHaveBeenCalled()
  })
})

function mountView(role: EmployeeRole) {
  useOperatorSessionStore().setRole(role)
  return mount(AuditLogView)
}

function findButton(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
  if (!button) throw new Error(`button not found: ${label}`)
  return button
}
