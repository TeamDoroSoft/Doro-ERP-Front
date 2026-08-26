import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SalesClosingView from '@/views/SalesClosingView.vue'
import StoreSettingsView from '@/views/StoreSettingsView.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'
beforeEach(() => {
  sessionStorage.clear()
  setActivePinia(createPinia())
  useOperatorSessionStore().setRole('MANAGER')
  vi.restoreAllMocks()
})
describe('Phase 06 management views', () => {
  it('requires an explicit business date and never guesses one', () => {
    const wrapper = mount(SalesClosingView)
    expect(wrapper.get('h1').text()).toBe('일별 매출과 마감')
    expect((wrapper.get('input[type=date]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('조회할 영업일을 선택해 주세요')
  })
  it('loads store and employees from their real endpoints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              input.endsWith('/store')
                ? {
                    id: 's1',
                    tenantId: 't1',
                    name: '도로',
                    timezone: 'Asia/Seoul',
                    currency: 'KRW',
                    status: 'ACTIVE',
                  }
                : [],
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )
    const wrapper = mount(StoreSettingsView)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('매장·직원 설정')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('도로')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('queues a role change until reauthentication and rolls the select back on cancel', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input); calls.push(`${init?.method ?? 'GET'} ${path}`)
      const body = path.endsWith('/store') ? storeResponse : path.endsWith('/employees') ? [employeeResponse] : path.endsWith('/auth/reauthenticate') ? undefined : { ...employeeResponse, role: 'MANAGER' }
      return new Response(body === undefined ? null : JSON.stringify(body), { status: body === undefined ? 204 : 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const wrapper = mount(StoreSettingsView)
    await flushPromises()
    await wrapper.findAll('.tabs button')[1]!.trigger('click')
    const role = wrapper.get('td select')
    await role.setValue('MANAGER')
    expect(wrapper.find('[role=dialog]').exists()).toBe(true)
    expect(calls.some((call) => call.includes('/role'))).toBe(false)
    const modalButtons = wrapper.findAll('[role=dialog] button')
    await modalButtons[modalButtons.length - 1]!.trigger('click')
    expect((role.element as HTMLSelectElement).value).toBe('STAFF')
    await role.setValue('MANAGER')
    await wrapper.get('[data-test=reauth-password]').setValue('operator-password')
    await wrapper.get('[role=dialog] form').trigger('submit')
    await flushPromises()
    expect(calls.findIndex((call) => call.includes('/auth/reauthenticate'))).toBeLessThan(calls.findIndex((call) => call.includes('/role')))
  })
  it('keeps the action queued, clears the password, and gives contextual reauthentication feedback on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const path = String(input)
      if (path.endsWith('/auth/reauthenticate')) return new Response(JSON.stringify({ code: 'AUTHENTICATION_FAILED', requestId: 'req-reauth' }), { status: 401, headers: { 'Content-Type': 'application/problem+json' } })
      const body = path.endsWith('/store') ? storeResponse : [employeeResponse]
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const wrapper = mount(StoreSettingsView)
    await flushPromises()
    await wrapper.findAll('.tabs button')[1]!.trigger('click')
    await wrapper.get('td select').setValue('MANAGER')
    await wrapper.get('[data-test=reauth-password]').setValue('wrong-password')
    await wrapper.get('[role=dialog] form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('현재 비밀번호가 올바르지 않습니다')
    expect(wrapper.text()).toContain('req-reauth')
    expect(wrapper.find('[role=dialog]').exists()).toBe(true)
    expect((wrapper.get('[data-test=reauth-password]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('td select').element as HTMLSelectElement).value).toBe('STAFF')
  })
})

const storeResponse = { id: 's1', tenantId: 't1', name: '도로', timezone: 'Asia/Seoul', currency: 'KRW', status: 'ACTIVE' }
const employeeResponse = { id: 'employee-2', loginId: 'staff.one', role: 'STAFF', status: 'ACTIVE', passwordChangeRequired: true, createdAt: '2026-01-01T00:00:00Z' }
