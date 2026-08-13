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

  it('applies a successful role and enters the dashboard', async () => {
    vi.mocked(login).mockResolvedValue({ employeeId: 'employee-1', role: 'OWNER', passwordChangeRequired: false })
    const wrapper = await mountLogin()
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(useOperatorSessionStore().role).toBe('OWNER')
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/admin/dashboard')
  })

  it('sends temporary-password users to the required change screen', async () => {
    vi.mocked(login).mockResolvedValue({ employeeId: 'employee-1', role: 'STAFF', passwordChangeRequired: true })
    const wrapper = await mountLogin()
    await fillAndSubmit(wrapper)
    await flushPromises()
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/account/change-password')
  })

  it('shows a safe invalid-credential error', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(401, { code: 'AUTHENTICATION_FAILED' }))
    const wrapper = await mountLogin()
    await fillAndSubmit(wrapper)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('업체 코드, 로그인 ID 또는 비밀번호')
  })
})

async function mountLogin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginView },
      { path: '/admin/dashboard', component: { template: '<div>dashboard</div>' } },
      { path: '/account/change-password', component: { template: '<div>password</div>' } },
    ],
  })
  await router.push('/login')
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
