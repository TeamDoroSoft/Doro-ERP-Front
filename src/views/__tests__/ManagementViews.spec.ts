import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import SalesClosingView from '@/views/SalesClosingView.vue'
import StaffManagementView from '@/views/StaffManagementView.vue'
import StoreSettingsView from '@/views/StoreSettingsView.vue'
import { useOperatorSessionStore, type EmployeeRole } from '@/stores/operatorSession'

interface ViewCase {
  name: string
  component: Component
  title: string
  empty: string
  primary?: string
  deniedRole?: EmployeeRole
}

const views: ViewCase[] = [
  { name: 'Sales', component: SalesClosingView, title: '매출·마감', empty: '매출 내역을 준비하고 있습니다', primary: '마감 조건 확인' },
  { name: 'Staff', component: StaffManagementView, title: '직원 관리', empty: '등록된 직원이 없습니다', primary: '직원 생성', deniedRole: 'STAFF' },
  { name: 'Store', component: StoreSettingsView, title: '매장 설정', empty: '매장 정보를 준비하고 있습니다', primary: '기본 정보 수정', deniedRole: 'STAFF' },
]

describe.each(views)('$name management view', (viewCase) => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('renders its contract-based operational layout and empty state', () => {
    const wrapper = mountView(viewCase.component, 'MANAGER')
    expect(wrapper.get('h1').text()).toBe(viewCase.title)
    expect(wrapper.text()).toContain(viewCase.empty)
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Backend 외부 경로 연결 대기')
  })

  it('applies and resets its supported filters', async () => {
    const wrapper = mountView(viewCase.component, 'MANAGER')
    const form = wrapper.get('form[aria-label="목록 필터"]')
    await form.trigger('submit')
    expect(wrapper.text()).toContain('선택한 조회 조건을 적용했습니다')
    await form.get('button[type="button"]').trigger('click')
    expect(wrapper.text()).not.toContain('선택한 조회 조건을 적용했습니다')
  })

  it('does not expose backend enum values as option labels', () => {
    const wrapper = mountView(viewCase.component, 'MANAGER')
    const labels = wrapper.findAll('option').map((item) => item.text())
    expect(labels).not.toEqual(expect.arrayContaining(['CREATED', 'DINE_IN', 'PENDING', 'OWNER', 'ACTIVE']))
  })

})

describe.each(views.filter((view) => view.primary))('$name primary action', (viewCase) => {
  it('opens the domain action drawer without enabling a fake save', async () => {
    setActivePinia(createPinia())
    const wrapper = mountView(viewCase.component, 'MANAGER')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.action-drawer').exists()).toBe(true)
    expect(wrapper.get('.action-drawer footer button:last-child').attributes('disabled')).toBeDefined()
  })
})

describe.each(views.filter((view) => view.deniedRole))('$name role access', (viewCase) => {
  it('shows role denial without rendering operational data controls', () => {
    setActivePinia(createPinia())
    const wrapper = mountView(viewCase.component, viewCase.deniedRole!)
    expect(wrapper.text()).toContain('이 기능에 접근할 권한이 없습니다')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

function mountView(component: Component, role: EmployeeRole) {
  const session = useOperatorSessionStore()
  session.setRole(role)
  return mount(component)
}
