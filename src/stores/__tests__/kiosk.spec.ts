import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import { useKioskSessionStore } from '@/stores/kioskSession'
import { useOperatorSessionStore } from '@/stores/operatorSession'
describe('Kiosk stores', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })
  it('keeps kiosk device state separate from POS employee session', () => {
    useOperatorSessionStore().setRole('OWNER')
    const kiosk = useKioskSessionStore()
    expect(kiosk.deviceState).toBe('UNREGISTERED')
    kiosk.deviceState = 'ACTIVE'
    expect(useOperatorSessionStore().role).toBe('OWNER')
  })
  it.each(['UNREGISTERED', 'INACTIVE', 'REVOKED'] as const)(
    'represents blocked device state %s',
    (state) => {
      const kiosk = useKioskSessionStore()
      kiosk.deviceState = state
      expect(kiosk.deviceState).toBe(state)
    },
  )
  it('treats the stored ACTIVE marker as a UX hint that a protected API must confirm', () => {
    sessionStorage.setItem('doro.kiosk-device-active', '1')
    const kiosk = useKioskSessionStore()

    // The hint allows the restoring screens to render, but it is not an authentication result.
    expect(kiosk.restoring).toBe(true)
    expect(kiosk.deviceState).toBe('UNREGISTERED')
    expect(kiosk.canAccessProtected).toBe(true)

    kiosk.markAuthenticated()
    expect(kiosk.restoring).toBe(false)
    expect(kiosk.deviceState).toBe('ACTIVE')
    expect(sessionStorage.getItem('doro.kiosk-device-active')).toBe('1')
  })

  it('discards the ACTIVE marker as soon as a kiosk API reports 401', () => {
    sessionStorage.setItem('doro.kiosk-device-active', '1')
    const kiosk = useKioskSessionStore()

    kiosk.markAuthenticationFailed()

    expect(sessionStorage.getItem('doro.kiosk-device-active')).toBeNull()
    expect(kiosk.restoring).toBe(false)
    expect(kiosk.canAccessProtected).toBe(false)
    expect(kiosk.deviceState).toBe('AUTH_FAILED')
  })

  it('marks the kiosk unauthenticated only after logout succeeds', async () => {
    const request = vi.fn<() => Promise<Response>>(async () =>
      new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', request)
    const kiosk = useKioskSessionStore()
    kiosk.markAuthenticated()

    await kiosk.logout('secret')

    expect(kiosk.deviceState).toBe('UNREGISTERED')
    expect(sessionStorage.getItem('doro.kiosk-device-active')).toBeNull()
  })

  it('keeps kiosk authentication and customer state when logout fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'KIOSK_AUTHENTICATION_FAILED' }), {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const kiosk = useKioskSessionStore(),
      cart = useKioskCartStore(),
      flow = useKioskFlowStore()
    kiosk.markAuthenticated()
    cart.addItem({ productId: 'p1', name: '커피', description: '', price: '1', displayOrder: 1 })
    const orderKey = flow.orderKey

    await expect(kiosk.logout('wrong')).rejects.toMatchObject({
      code: 'KIOSK_AUTHENTICATION_FAILED',
    })

    expect(kiosk.deviceState).toBe('ACTIVE')
    expect(sessionStorage.getItem('doro.kiosk-device-active')).toBe('1')
    expect(cart.itemCount).toBe(1)
    expect(flow.orderKey).toBe(orderKey)
  })

  it('adds, changes, removes and clears option-free cart lines', () => {
    const cart = useKioskCartStore(),
      product = { productId: 'p1', name: '커피', description: '', price: '4500', displayOrder: 1 }
    cart.addItem(product)
    cart.addItem(product, 2)
    expect(cart.itemCount).toBe(3)
    expect(cart.estimatedTotal).toBe('13500')
    cart.setQuantity('p1', 2)
    expect(cart.itemCount).toBe(2)
    cart.removeItem('p1')
    expect(cart.lines).toHaveLength(0)
    cart.addItem(product)
    cart.clear()
    expect(cart.lines).toHaveLength(0)
  })
  it('resets customer data and operation keys while preserving device authentication', () => {
    const device = useKioskSessionStore(),
      cart = useKioskCartStore(),
      flow = useKioskFlowStore()
    device.deviceState = 'ACTIVE'
    cart.addItem({ productId: 'p1', name: '커피', description: '', price: '1', displayOrder: 1 })
    const oldOrder = flow.orderKey,
      oldPayment = flow.paymentCreateKey,
      oldHandoff = flow.handoffCreateKey
    flow.resetCustomer()
    expect(cart.lines).toHaveLength(0)
    expect(flow.orderKey).not.toBe(oldOrder)
    expect(flow.paymentCreateKey).not.toBe(oldPayment)
    expect(flow.handoffCreateKey).not.toBe(oldHandoff)
    expect(flow.orderKey).not.toBe(flow.paymentCreateKey)
    expect(device.deviceState).toBe('ACTIVE')
  })

  it('never restores customer order credentials from browser storage', () => {
    sessionStorage.setItem(
      'doro.kiosk-payment-flow',
      JSON.stringify({ order: { orderAccessToken: 'legacy-token' } }),
    )
    const flow = useKioskFlowStore()

    expect(flow.order).toBeNull()
    expect(flow.payment).toBeNull()
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
  })
})
