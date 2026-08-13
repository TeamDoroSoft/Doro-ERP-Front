import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'

describe('DashboardView', () => {
  it('renders honest integration states instead of fake KPI values', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: DashboardView }] })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })

    expect(wrapper.get('h1').text()).toBe('대시보드')
    expect(wrapper.text()).toContain('오늘 주문')
    expect(wrapper.text()).toContain('활성 테이블')
    expect(wrapper.text()).toContain('연동 준비 중')
    expect(wrapper.text()).not.toMatch(/₩[0-9,]+/)
  })
})
