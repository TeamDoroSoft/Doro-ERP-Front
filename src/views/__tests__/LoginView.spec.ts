import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { login } from '@/api/auth'
import { ApiError } from '@/api/http'
import LoginView from '@/views/LoginView.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'

vi.mock('@/api/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/auth')>()
  return { ...original, login: vi.fn<typeof original.login>() }
})

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('renders the employee login fields', async () => {
    const wrapper = await mountLogin()
    expect(wrapper.get('h2').text()).toBe('관리자 로그인')
    expect(wrapper.find('input[name="tenantCode"]').exists()).toBe(true)
    expect(wrapper.find('input[name="loginId"]').exists()).toBe(true)
    expect(wrapper.find('input[name="password"]').attributes('type')).toBe('password')
  })

  it('applies a successful role and enters the POS orders view', async () => {
    vi.mocked(login).mockResolvedValue({ employeeId: 'employee-1', role: 'OWNER', passwordChangeRequired: false })
    const wrapper = await mountLogin()
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(useOperatorSessionStore().role).toBe('OWNER')
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/pos/orders')
  })

  it('returns to a safe internal POS destination after login', async () => {
    vi.mocked(login).mockResolvedValue({ employeeId: 'employee-1', role: 'OWNER', passwordChangeRequired: false })
    const wrapper = await mountLogin('/pos/login?redirect=/pos/tables')
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/pos/tables')
  })

  it('returns to the destination preserved by a session-expired redirect', async () => {
    vi.mocked(login).mockResolvedValue({ employeeId: 'employee-1', role: 'OWNER', passwordChangeRequired: false })
    const wrapper = await mountLogin('/pos/login?reason=session-expired&redirect=/pos/settings')
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/pos/settings')
  })

  it.each([
    '//external.example/path',
    'http://external.example/pos/orders',
    'https://external.example/pos/orders',
    'javascript:alert(1)',
    '/pos/orders?paymentKey=must-not-survive',
    '/pos/orders#secret',
    '/posx/orders',
    '/pos/missing',
    '/pos/login',
  ])('rejects an unsafe login redirect: %s', async (redirect) => {
    vi.mocked(login).mockResolvedValue({ employeeId: 'employee-1', role: 'OWNER', passwordChangeRequired: false })
    const wrapper = await mountLogin(`/pos/login?redirect=${encodeURIComponent(redirect)}`)
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/pos/orders')
    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({})
  })

  it('sends temporary-password users to the required change screen', async () => {
    vi.mocked(login).mockResolvedValue({ employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: true })
    const wrapper = await mountLogin()
    await fillAndSubmit(wrapper)
    await flushPromises()
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/pos/account/change-password')
  })

  it('shows a safe invalid-credential error', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(401, { code: 'AUTHENTICATION_FAILED' }))
    const wrapper = await mountLogin()
    await fillAndSubmit(wrapper)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('업체 코드, 로그인 ID 또는 비밀번호')
  })

  it('shows a safe unavailable message for the Edge login fail-closed problem', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError(503, { status: 503, code: 'LOGIN_UNAVAILABLE', detail: 'store-access host unreachable' }),
    )
    const wrapper = await mountLogin()
    await fillAndSubmit(wrapper)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('일시적으로 사용할 수 없습니다')
    expect(wrapper.text()).not.toContain('store-access host unreachable')
  })

  it('tells the operator to log in again after an own-password change', async () => {
    const wrapper = await mountLogin('/pos/login?reason=password-changed')
    expect(wrapper.get('[role="status"]').text()).toContain('비밀번호가 변경되었습니다')
  })
})

async function mountLogin(location = '/pos/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pos/login', name: 'pos-login', component: LoginView },
      { path: '/pos/orders', name: 'pos-orders', component: { template: '<div>orders</div>' } },
      { path: '/pos/tables', name: 'pos-tables', component: { template: '<div>tables</div>' } },
      { path: '/pos/settings', name: 'pos-settings', component: { template: '<div>settings</div>' } },
      {
        path: '/pos/account/change-password',
        name: 'pos-change-password',
        component: { template: '<div>password</div>' },
      },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: { template: '<div>missing</div>' } },
    ],
  })
  await router.push(location)
  await router.isReady()
  const wrapper = mount(LoginView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function fillAndSubmit(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('input[name="tenantCode"]').setValue('doro')
  await wrapper.get('input[name="loginId"]').setValue('owner')
  await wrapper.get('input[name="password"]').setValue('password')
  await wrapper.get('form').trigger('submit')
}
