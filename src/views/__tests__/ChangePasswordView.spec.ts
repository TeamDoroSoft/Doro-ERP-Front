import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { changeOwnPassword } from '@/api/auth'
import { ApiError } from '@/api/http'
import ChangePasswordView from '@/views/ChangePasswordView.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'

vi.mock('@/api/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/auth')>()
  return { ...original, changeOwnPassword: vi.fn<typeof original.changeOwnPassword>() }
})

describe('ChangePasswordView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('sends the two-field Store Access contract and returns to login after a change', async () => {
    vi.mocked(changeOwnPassword).mockResolvedValue(employeeResponse())
    const wrapper = await mountView()
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(changeOwnPassword).toHaveBeenCalledWith({
      currentPassword: 'current-password-value',
      newPassword: 'brand-new-password-value',
    })
    // A successful change destroys every session server-side, so the client must re-login.
    expect(useOperatorSessionStore().status).toBe('anonymous')
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/pos/login')
    expect(wrapper.vm.$router.currentRoute.value.query.reason).toBe('password-changed')
  })

  it('treats a wrong current password as a form error and keeps the session', async () => {
    vi.mocked(changeOwnPassword).mockRejectedValue(
      new ApiError(401, {
        status: 401,
        code: 'CURRENT_PASSWORD_INCORRECT',
        detail: 'raw upstream detail',
      }),
    )
    const wrapper = await mountView()
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('현재 비밀번호가 올바르지 않습니다.')
    expect(wrapper.text()).not.toContain('raw upstream detail')
    expect(useOperatorSessionStore().status).toBe('authenticated')
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/pos/account/change-password')
  })

  it('sends the operator back to login when the session itself is gone', async () => {
    vi.mocked(changeOwnPassword).mockRejectedValue(
      new ApiError(401, { status: 401, code: 'UNAUTHENTICATED' }),
    )
    const wrapper = await mountView()
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(useOperatorSessionStore().status).toBe('anonymous')
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/pos/login')
    expect(wrapper.vm.$router.currentRoute.value.query.reason).toBe('session-expired')
  })

  it('shows the policy message for a rejected new password', async () => {
    vi.mocked(changeOwnPassword).mockRejectedValue(
      new ApiError(400, { status: 400, code: 'WEAK_PASSWORD', detail: 'blocklist entry matched' }),
    )
    const wrapper = await mountView()
    await fillAndSubmit(wrapper)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('정책에 맞지 않습니다')
    expect(wrapper.text()).not.toContain('blocklist entry matched')
    expect(useOperatorSessionStore().status).toBe('authenticated')
  })
})

function employeeResponse() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    loginId: 'owner',
    role: 'OWNER' as const,
    status: 'ACTIVE' as const,
    passwordChangeRequired: false,
    createdAt: '2026-08-17T00:00:00Z',
  }
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/pos/account/change-password',
        name: 'pos-change-password',
        component: ChangePasswordView,
      },
      { path: '/pos/login', name: 'pos-login', component: { template: '<div>login</div>' } },
      { path: '/pos/orders', name: 'pos-orders', component: { template: '<div>orders</div>' } },
    ],
  })
  useOperatorSessionStore().applyLogin(
    { employeeId: 'employee-1', role: 'OWNER', passwordChangeRequired: true },
    'doro',
  )
  await router.push('/pos/account/change-password')
  await router.isReady()
  const wrapper = mount(ChangePasswordView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function fillAndSubmit(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('input[name="currentPassword"]').setValue('current-password-value')
  await wrapper.get('input[name="newPassword"]').setValue('brand-new-password-value')
  await wrapper.get('input[name="confirmPassword"]').setValue('brand-new-password-value')
  await wrapper.get('form').trigger('submit')
}
