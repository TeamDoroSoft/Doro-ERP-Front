import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import PosSidebar from '@/components/layout/PosSidebar.vue'
import { useOperatorSessionStore, type EmployeeRole } from '@/stores/operatorSession'

describe('PosSidebar', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('shows manager-only administration menus to OWNER and MANAGER', async () => {
    for (const role of ['OWNER', 'MANAGER'] as EmployeeRole[]) {
      const wrapper = await mountSidebar(role)
      expect(wrapper.text()).toContain('테이블')
      expect(wrapper.text()).toContain('매장·직원 설정')
      expect(wrapper.text()).toContain('운영·보안 기록')
    }
  })

  it('keeps STAFF navigation focused on operational menus without table/settings/history', async () => {
    const wrapper = await mountSidebar('STAFF')
    expect(wrapper.text()).toContain('주문 관리')
    expect(wrapper.text()).toContain('입장 대기')
    expect(wrapper.text()).toContain('조리 현황')
    expect(wrapper.text()).toContain('상품·메뉴')
    expect(wrapper.text()).toContain('매출·마감')
    expect(wrapper.text()).not.toContain('테이블')
    expect(wrapper.text()).not.toContain('매장·직원 설정')
    expect(wrapper.text()).not.toContain('운영·보안 기록')
  })

  it('shows separate entry and fulfillment queue destinations', async () => {
    const wrapper = await mountSidebar('STAFF')

    expect(wrapper.get('a[href="/pos/queues/entry"]').text()).toContain('입장 대기')
    expect(wrapper.get('a[href="/pos/queues/fulfillment"]').text()).toContain('조리 현황')
    expect(wrapper.text()).not.toContain('대기·조리')
  })

  it('marks only currently implemented destinations as ready', async () => {
    const wrapper = await mountSidebar('OWNER')
    const plannedItems = wrapper.findAll('.planned')

    expect(plannedItems).toHaveLength(0)
    expect(wrapper.text()).not.toContain('대시보드')
    expect(wrapper.text()).not.toContain('재고')
    expect(wrapper.text()).not.toContain('예약')
  })
})

async function mountSidebar(role: EmployeeRole) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pos/orders', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/pos/orders')
  await router.isReady()
  useOperatorSessionStore().setRole(role)
  return mount(PosSidebar, { props: { open: false }, global: { plugins: [router] } })
}
