import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import PosLayout from '@/layouts/PosLayout.vue'

describe('PosLayout', () => {
  it.each([
    ['forbidden', '현재 계정으로는 요청한 화면에 접근할 수 없습니다.'],
    ['not-found', '요청한 화면을 찾을 수 없어 주문 화면으로 이동했습니다.'],
  ])('shows and dismisses the %s route feedback', async (reason, message) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/pos/orders', component: { template: '<div>orders</div>' } }],
    })
    await router.push({ path: '/pos/orders', query: { reason } })
    await router.isReady()

    const wrapper = mount(PosLayout, {
      global: {
        plugins: [router],
        stubs: { PosHeader: true, PosSidebar: true },
      },
    })

    expect(wrapper.get('[role="status"]').text()).toContain(message)
    await wrapper.get('[aria-label="안내 닫기"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.reason).toBeUndefined()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
