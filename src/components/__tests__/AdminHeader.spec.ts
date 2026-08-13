import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { logout } from '@/api/auth'
import AdminHeader from '@/components/layout/AdminHeader.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'

vi.mock('@/api/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/auth')>()
  return { ...original, logout: vi.fn<typeof original.logout>() }
})

describe('AdminHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('shows the authenticated role and safely logs out', async () => {
    vi.mocked(logout).mockResolvedValue(undefined)
    const session = useOperatorSessionStore()
    session.applyLogin({ employeeId: 'employee-1', role: 'MANAGER', passwordChangeRequired: false }, 'doro')
    const wrapper = await mountHeader()

    expect(wrapper.text()).toContain('관리자')
    expect(wrapper.text()).toContain('doro')
    await wrapper.get('[aria-label="사용자 메뉴"]').trigger('click')
    const logoutButton = wrapper.findAll('button').find((button) => button.text() === '로그아웃')
    expect(logoutButton).toBeDefined()
    await logoutButton!.trigger('click')
    await flushPromises()

    expect(logout).toHaveBeenCalledOnce()
    expect(session.authenticated).toBe(false)
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/login')
  })

  it('shows the DEV badge and clears preview without a Backend logout request', async () => {
    const session = useOperatorSessionStore()
    session.applyPreview()
    const wrapper = await mountHeader()

    await wrapper.get('[aria-label="사용자 메뉴"]').trigger('click')
    const logoutButton = wrapper.findAll('button').find((button) => button.text() === '로그아웃')
    await logoutButton!.trigger('click')
    await flushPromises()

    expect(logout).not.toHaveBeenCalled()
    expect(session.authenticated).toBe(false)
    expect(session.isPreview).toBe(false)
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/login')
  })
})

async function mountHeader() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/dashboard', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
      { path: '/account/change-password', component: { template: '<div />' } },
    ],
  })
  await router.push('/admin/dashboard')
  await router.isReady()
  return mount(AdminHeader, { global: { plugins: [router] } })
}
