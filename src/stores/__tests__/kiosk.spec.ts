import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import { useKioskSessionStore } from '@/stores/kioskSession'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import { saveKioskPaymentFlow } from '@/payments/kioskPaymentFlow'
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
      oldPayment = flow.paymentCreateKey
    flow.resetCustomer()
    expect(cart.lines).toHaveLength(0)
    expect(flow.orderKey).not.toBe(oldOrder)
    expect(flow.paymentCreateKey).not.toBe(oldPayment)
    expect(flow.orderKey).not.toBe(flow.paymentCreateKey)
    expect(device.deviceState).toBe('ACTIVE')
  })

  it('restores the current payment and confirm key after a document reload', () => {
    saveKioskPaymentFlow({
      order: {
        orderId: '11111111-1111-4111-8111-111111111111',
        displayNumber: 17,
        totalAmount: '9000',
        currency: 'KRW',
        status: 'CREATED',
        businessDate: '2026-08-27',
        orderAccessToken: 'short-token',
      },
      payment: {
        id: '33333333-3333-4333-8333-333333333333',
        orderId: '11111111-1111-4111-8111-111111111111',
        providerOrderId: 'kiosk-provider-1',
        amount: '9000',
        currency: 'KRW',
        status: 'PENDING',
      },
      confirmIdempotencyKey: '44444444-4444-4444-8444-444444444444',
      createdAt: Date.now(),
    })
    setActivePinia(createPinia())

    const restored = useKioskFlowStore()
    expect(restored.order?.orderAccessToken).toBe('short-token')
    expect(restored.payment?.id).toBe('33333333-3333-4333-8333-333333333333')
    expect(restored.paymentConfirmKey).toBe('44444444-4444-4444-8444-444444444444')

    restored.resetCustomer()
    expect(sessionStorage.getItem('doro.kiosk-payment-flow')).toBeNull()
  })
})
