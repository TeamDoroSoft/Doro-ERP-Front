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
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = String(input)
        calls.push(`${init?.method ?? 'GET'} ${path}`)
        const body = path.endsWith('/store')
          ? storeResponse
          : path.endsWith('/employees')
            ? [employeeResponse]
            : path.endsWith('/auth/reauthenticate')
              ? undefined
              : { ...employeeResponse, role: 'MANAGER' }
        return new Response(body === undefined ? null : JSON.stringify(body), {
          status: body === undefined ? 204 : 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
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
    expect(calls.findIndex((call) => call.includes('/auth/reauthenticate'))).toBeLessThan(
      calls.findIndex((call) => call.includes('/role')),
    )
  })
  it('keeps the action queued, clears the password, and gives contextual reauthentication feedback on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const path = String(input)
        if (path.endsWith('/auth/reauthenticate'))
          return new Response(
            JSON.stringify({ code: 'AUTHENTICATION_FAILED', requestId: 'req-reauth' }),
            { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
          )
        const body = path.endsWith('/store') ? storeResponse : [employeeResponse]
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
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
  it('shows and copies the device code and activation secret without exposing the full credential', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = String(input)
        if (path.endsWith('/auth/reauthenticate')) return new Response(null, { status: 204 })
        if (path.endsWith('/kiosk-devices') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              kioskDeviceId: 'device-id-1',
              credential: 'kdc_credential-id.activation-secret',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        const body = path.endsWith('/store') ? storeResponse : []
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const wrapper = mount(StoreSettingsView)
    await flushPromises()
    await wrapper.findAll('.tabs button')[2]!.trigger('click')
    await wrapper.get('.panel input').setValue('KIOSK-01')
    await wrapper.get('.panel form').trigger('submit')
    await wrapper.get('[data-test=reauth-password]').setValue('operator-password')
    await wrapper.get('[role=dialog] form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-test=issued-device-code]').text()).toBe('KIOSK-01')
    expect(wrapper.get('[data-test=issued-secret]').text()).toBe('activation-secret')
    expect(wrapper.text()).not.toContain('kdc_credential-id')

    await wrapper.get('[data-test=copy-device-code]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenLastCalledWith('KIOSK-01')
    expect(wrapper.get('[role=status]').text()).toBe('기기 코드를 복사했습니다.')

    await wrapper.get('[data-test=copy-activation-secret]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenLastCalledWith('activation-secret')
    expect(writeText).not.toHaveBeenCalledWith('kdc_credential-id.activation-secret')
    expect(wrapper.get('[role=status]').text()).toBe('활성화 코드를 복사했습니다.')
  })
  it('handles clipboard failure and clears copy feedback when the credential panel closes', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi
          .fn<(text: string) => Promise<void>>()
          .mockRejectedValue(new Error('permission denied')),
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = String(input)
        if (path.endsWith('/auth/reauthenticate')) return new Response(null, { status: 204 })
        if (path.endsWith('/kiosk-devices') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              kioskDeviceId: 'device-id-1',
              credential: 'kdc_credential-id.activation-secret',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        const body = path.endsWith('/store') ? storeResponse : []
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const wrapper = mount(StoreSettingsView)
    await flushPromises()
    await wrapper.findAll('.tabs button')[2]!.trigger('click')
    await wrapper.get('.panel input').setValue('KIOSK-01')
    await wrapper.get('.panel form').trigger('submit')
    await wrapper.get('[data-test=reauth-password]').setValue('operator-password')
    await wrapper.get('[role=dialog] form').trigger('submit')
    await flushPromises()

    await wrapper.get('[data-test=copy-activation-secret]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role=status]').text()).toContain('복사하지 못했습니다')

    await wrapper.get('.credential .actions button').trigger('click')
    expect(wrapper.find('[role=status]').exists()).toBe(false)
    expect(wrapper.text()).toContain('현재 확인할 수 있는 기기 활성화 정보가 없습니다.')
  })

  it('loads safe kiosk metadata and rotates an active device from its list row', async () => {
    const calls: string[] = []
    const device = {
      id: 'device-id-1',
      deviceCode: 'KIOSK-01',
      status: 'ACTIVE',
      credentialVersion: 1,
      createdAt: '2026-08-25T09:00:00Z',
      updatedAt: '2026-08-25T09:00:00Z',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = String(input)
        calls.push(`${init?.method ?? 'GET'} ${path}`)
        if (path.endsWith('/auth/reauthenticate')) return new Response(null, { status: 204 })
        if (path.endsWith('/kiosk-devices/device-id-1/rotate')) {
          return new Response(
            JSON.stringify({
              kioskDeviceId: 'device-id-1',
              credential: 'kdc_credential-id.rotated-secret',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        const body = path.endsWith('/store')
          ? storeResponse
          : path.endsWith('/employees')
            ? []
            : [device]
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const wrapper = mount(StoreSettingsView)
    await flushPromises()
    await wrapper.findAll('.tabs button')[2]!.trigger('click')
    await flushPromises()

    const row = wrapper.get('[data-test=kiosk-device-row]')
    expect(row.text()).toContain('KIOSK-01')
    expect(row.text()).toContain('사용 중')
    expect(wrapper.text()).not.toContain('rotated-secret')

    await row.get('[data-test=rotate-kiosk]').trigger('click')
    await wrapper.get('[data-test=reauth-password]').setValue('operator-password')
    await wrapper.get('[role=dialog] form').trigger('submit')
    await flushPromises()

    expect(calls.some((call) => call.includes('POST') && call.includes('/rotate'))).toBe(true)
    expect(wrapper.get('[data-test=issued-device-code]').text()).toBe('KIOSK-01')
    expect(wrapper.get('[data-test=issued-secret]').text()).toBe('rotated-secret')
  })

  it('shows an empty kiosk list and allows an isolated list retry after an API failure', async () => {
    let kioskRequests = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const path = String(input)
        if (path.endsWith('/kiosk-devices')) {
          kioskRequests += 1
          if (kioskRequests === 1) {
            return new Response(
              JSON.stringify({
                code: 'STORE_ACCESS_UNAVAILABLE',
                requestId: 'req-kiosk-list',
              }),
              { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
            )
          }
          return new Response(JSON.stringify([]), { status: 200 })
        }
        const body = path.endsWith('/store') ? storeResponse : []
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const wrapper = mount(StoreSettingsView)
    await flushPromises()
    await wrapper.findAll('.tabs button')[2]!.trigger('click')
    await flushPromises()
    const list = wrapper.get('[data-test=kiosk-device-list]')
    expect(list.text()).toContain('req-kiosk-list')

    const retry = list.findAll('button').find((button) => button.text().includes('다시 시도'))
    expect(retry).toBeDefined()
    await retry!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test=kiosk-empty]').text()).toContain(
      '등록된 키오스크 기기가 없습니다',
    )
  })
})

const storeResponse = {
  id: 's1',
  tenantId: 't1',
  name: '도로',
  timezone: 'Asia/Seoul',
  currency: 'KRW',
  status: 'ACTIVE',
}
const employeeResponse = {
  id: 'employee-2',
  loginId: 'staff.one',
  role: 'STAFF',
  status: 'ACTIVE',
  passwordChangeRequired: true,
  createdAt: '2026-01-01T00:00:00Z',
}
