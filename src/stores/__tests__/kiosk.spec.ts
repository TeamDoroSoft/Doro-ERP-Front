import { beforeEach, describe, expect, it } from 'vitest'
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
  it('adds, changes, removes and clears option-free cart lines', () => {
    const cart = useKioskCartStore(),
      product = { productId: 'p1', name: '커피', description: '', price: 4500, displayOrder: 1 }
    cart.addItem(product)
    cart.addItem(product, 2)
    expect(cart.itemCount).toBe(3)
    expect(cart.estimatedTotal).toBe(13500)
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
    cart.addItem({ productId: 'p1', name: '커피', description: '', price: 1, displayOrder: 1 })
    const oldOrder = flow.orderKey,
      oldPayment = flow.paymentCreateKey
    flow.resetCustomer()
    expect(cart.lines).toHaveLength(0)
    expect(flow.orderKey).not.toBe(oldOrder)
    expect(flow.paymentCreateKey).not.toBe(oldPayment)
    expect(flow.orderKey).not.toBe(flow.paymentCreateKey)
    expect(device.deviceState).toBe('ACTIVE')
  })
})
