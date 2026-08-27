import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import KioskPaymentView from '@/views/kiosk/KioskPaymentView.vue'

describe('retired ORDER-kiosk direct payment route', () => {
  it('scrubs provider query data and redirects without calling a payment API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/kiosk/payments/:paymentId', component: KioskPaymentView },
        { path: '/kiosk/order', component: { template: '<div>order kiosk</div>' } },
        { path: '/kiosk/checkout', component: { template: '<div>checkout</div>' } },
      ],
    })
    await router.push({
      path: '/kiosk/payments/internal-payment-id',
      query: { paymentKey: 'provider-secret', orderId: 'provider-order', amount: '9000' },
    })
    await router.isReady()
    const wrapper = mount(KioskPaymentView, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/kiosk/order')
    expect(router.currentRoute.value.query).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('provider-secret')
  })
})
