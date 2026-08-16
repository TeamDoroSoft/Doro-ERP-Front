import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import AdminSidebar from '@/components/layout/AdminSidebar.vue'
import { useOperatorSessionStore, type EmployeeRole } from '@/stores/operatorSession'

describe('AdminSidebar', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('shows manager-only administration menus to OWNER and MANAGER', async () => {
    for (const role of ['OWNER', 'MANAGER'] as EmployeeRole[]) {
      const wrapper = await mountSidebar(role)
      expect(wrapper.text()).toContain('감사 이력')
      expect(wrapper.text()).toContain('직원 관리')
      expect(wrapper.text()).toContain('매장 설정')
    }
  })

  it('keeps STAFF navigation focused on operational menus', async () => {
    const wrapper = await mountSidebar('STAFF')
    expect(wrapper.text()).toContain('주문 관리')
    expect(wrapper.text()).toContain('테이블')
    expect(wrapper.text()).not.toContain('감사 이력')
    expect(wrapper.text()).not.toContain('직원 관리')
    expect(wrapper.text()).not.toContain('매장 설정')
  })

  it('does not expose out-of-scope inventory or reservation menus', async () => {
    const wrapper = await mountSidebar('OWNER')
    expect(wrapper.text()).not.toContain('재고')
    expect(wrapper.text()).not.toContain('예약')
  })
})

async function mountSidebar(role: EmployeeRole) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/dashboard', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/admin/dashboard')
  await router.isReady()
  useOperatorSessionStore().setRole(role)
  return mount(AdminSidebar, { props: { open: false }, global: { plugins: [router] } })
}
