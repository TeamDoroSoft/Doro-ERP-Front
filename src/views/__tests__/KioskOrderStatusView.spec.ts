import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveKioskPaymentFlow } from '@/payments/kioskPaymentFlow'
import type { KioskOrderStatus } from '@/api/kiosk'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import KioskOrderStatusView from '@/views/kiosk/KioskOrderStatusView.vue'

const getKioskOrder = vi.hoisted(() =>
  vi.fn<(id: string, token: string) => Promise<KioskOrderStatus>>(),
)
vi.mock('@/api/kiosk', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/kiosk')>()
  return { ...original, getKioskOrder }
})

const orderId = '11111111-1111-4111-8111-111111111111'

describe('KioskOrderStatusView customer boundary', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    getKioskOrder.mockResolvedValue({
      orderId,
      displayNumber: 104,
      status: 'ACCEPTED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'PREPARING',
    })
    saveKioskPaymentFlow({
      order: {
        orderId,
        displayNumber: 104,
        totalAmount: '9000',
        currency: 'KRW',
        status: 'CREATED',
        businessDate: '2026-08-27',
        orderAccessToken: 'short-token',
      },
      payment: {
        id: '33333333-3333-4333-8333-333333333333',
        orderId,
        providerOrderId: 'kiosk-provider-1',
        amount: '9000',
        currency: 'KRW',
        status: 'PAID',
      },
      confirmIdempotencyKey: null,
      createdAt: Date.now(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it('always resets the customer after 60 seconds even when approval was still unwinding', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const flow = useKioskFlowStore(pinia)
    flow.approving = true
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/kiosk', component: { template: '<div>menu</div>' } },
        { path: '/kiosk/orders/:orderId', component: KioskOrderStatusView },
      ],
    })
    await router.push(`/kiosk/orders/${orderId}`)
    await router.isReady()
    mount(KioskOrderStatusView, { global: { plugins: [pinia, router] } })
    await flushPromises()

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/kiosk')
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
  })
})
