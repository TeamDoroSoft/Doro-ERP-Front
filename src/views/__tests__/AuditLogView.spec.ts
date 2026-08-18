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
    expect(wrapper.get('h1').text()).toBe('감사 이력')
    expect(wrapper.text()).toContain('ORDER_ACCEPTED')
    expect(wrapper.text()).toContain('주문 접수')
    expect(wrapper.text()).toContain('주문')
    expect(wrapper.text()).toContain('관리자')
    expect(auditApi.getAudits).toHaveBeenCalledOnce()
  })

  it('keeps the loading layout stable', async () => {
    auditApi.getAudits.mockReturnValue(new Promise(() => undefined))
    const wrapper = mountView('OWNER')
    await nextTick()
    expect(wrapper.get('[role="status"]').text()).toContain('데이터를 불러오는 중')
  })

  it('shows the empty state', async () => {
    auditApi.getAudits.mockResolvedValue({ items: [], nextCursor: null })
    const wrapper = mountView('OWNER')
    await flushPromises()
    expect(wrapper.text()).toContain('감사 이력이 없습니다')
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
    await wrapper.get('input[name="action"]').setValue('ORDER_ACCEPTED')
    await wrapper.get('input[name="targetType"]').setValue('ORDER')
    await wrapper.get('input[name="targetId"]').setValue('11111111-1111-4111-8111-111111111111')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(auditApi.getAudits).toHaveBeenLastCalledWith(expect.objectContaining({
      action: 'ORDER_ACCEPTED', targetType: 'ORDER', targetId: '11111111-1111-4111-8111-111111111111', size: 20,
    }))
    const reset = wrapper.findAll('button').find((button) => button.text() === '초기화')!
    await reset.trigger('click')
    await flushPromises()
    expect((wrapper.get('input[name="action"]').element as HTMLInputElement).value).toBe('')
  })

  it('uses the opaque next cursor and returns to the previous page', async () => {
    auditApi.getAudits.mockResolvedValueOnce({ items: [item], nextCursor: 'opaque-next' }).mockResolvedValue({ items: [item], nextCursor: null })
    const wrapper = mountView('OWNER')
    await flushPromises()
    await findButton(wrapper, '다음').trigger('click')
    await flushPromises()
    expect(auditApi.getAudits).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'opaque-next' }))
    await findButton(wrapper, '이전').trigger('click')
    await flushPromises()
    expect(auditApi.getAudits).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }))
  })

  it('loads the selected record into a detail drawer', async () => {
    const wrapper = mountView('MANAGER')
    await flushPromises()
    await wrapper.get('[aria-label="감사 기록 상세 보기"]').trigger('click')
    await flushPromises()
    expect(auditApi.getAudit).toHaveBeenCalledWith(item.id)
    expect(wrapper.get('#audit-detail-title').text()).toBe('감사 기록 상세')
    expect(wrapper.text()).toContain('orderChannel')
    expect(wrapper.text()).toContain('req-3f2b9c7a')
  })

  it('renders an int64 metadata amount without rounding it', async () => {
    auditApi.getAudit.mockResolvedValue({
      ...item,
      metadata: { totalAmount: '9007199254740993', currency: 'KRW', soldOut: false },
    })
    const wrapper = mountView('OWNER')
    await flushPromises()
    await wrapper.get('[aria-label="감사 기록 상세 보기"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('9007199254740993')
    expect(wrapper.text()).not.toContain('9007199254740992')
    expect(wrapper.text()).toContain('false')
  })

  it('denies STAFF in the UX and does not call the API', () => {
    const wrapper = mountView('STAFF')
    expect(wrapper.text()).toContain('소유자와 관리자만 조회')
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
