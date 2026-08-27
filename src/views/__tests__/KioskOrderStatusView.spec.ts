import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import KioskOrderStatusView from '@/views/kiosk/KioskOrderStatusView.vue'

const orderId = '11111111-1111-4111-8111-111111111111'

describe('KioskOrderStatusView customer boundary', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it('shows no internal status and resets the in-memory customer after 60 seconds', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const flow = useKioskFlowStore(pinia)
    flow.order = {
      orderId,
      displayNumber: 104,
      totalAmount: '9000',
      currency: 'KRW',
      status: 'CREATED',
      businessDate: '2026-08-27',
      orderAccessToken: 'memory-only-token',
    }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/kiosk/order', component: { template: '<div>menu</div>' } },
        { path: '/kiosk/orders/:orderId', component: KioskOrderStatusView },
      ],
    })
    await router.push(`/kiosk/orders/${orderId}`)
    await router.isReady()
    const wrapper = mount(KioskOrderStatusView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('결제 완료')
    expect(wrapper.text()).not.toContain('조리 중')

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/kiosk/order')
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
  })
})
