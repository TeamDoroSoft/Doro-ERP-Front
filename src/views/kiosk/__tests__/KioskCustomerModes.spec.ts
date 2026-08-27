import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentKioskHandoff } from '@/api/paymentHandoff'
import KioskEntryQueueModeView from '@/views/kiosk/KioskEntryQueueModeView.vue'
import KioskCheckoutView from '@/views/kiosk/KioskCheckoutView.vue'
import KioskPaymentModeView from '@/views/kiosk/KioskPaymentModeView.vue'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskRuntimeStore } from '@/stores/kioskRuntime'

const api = vi.hoisted(() => ({
  registerKioskEntryQueue: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getCurrentPaymentHandoff: vi.fn<() => Promise<PaymentKioskHandoff | null>>(),
  createKioskOrder: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createPayment: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createPaymentHandoff: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))
const router = vi.hoisted(() => ({
  replace: vi.fn<(to: string) => Promise<void>>(),
}))

vi.mock('@/api/kioskQueue', () => ({ registerKioskEntryQueue: api.registerKioskEntryQueue }))
vi.mock('@/api/kiosk', () => ({ createKioskOrder: api.createKioskOrder }))
vi.mock('@/api/payment', () => ({ createPayment: api.createPayment }))
vi.mock('@/api/paymentHandoff', () => ({
  getCurrentPaymentHandoff: api.getCurrentPaymentHandoff,
  createPaymentHandoff: api.createPaymentHandoff,
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => router,
}))

describe('customer-facing kiosk modes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-27T10:00:00Z'))
    vi.clearAllMocks()
    router.replace.mockResolvedValue()
    sessionStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows the server-issued queue number and no personal-data fields after registration', async () => {
    api.registerKioskEntryQueue.mockResolvedValue({
      entryId: 'entry-1',
      businessDate: '2026-08-27',
      queueNumber: 12,
      partySize: 3,
      status: 'WAITING',
      version: '0',
    })
    const wrapper = mount(KioskEntryQueueModeView)
    await wrapper.get('input').setValue('3')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('대기번호 12')
    expect(wrapper.text()).toContain('3명')
    expect(wrapper.text()).toContain('2026-08-27')
    expect(wrapper.find('input[type="tel"]').exists()).toBe(false)
    expect(api.registerKioskEntryQueue).toHaveBeenCalledWith(
      { partySize: 3 },
      '11111111-1111-4111-8111-111111111111',
    )
    wrapper.unmount()
  })

  it('renders an actual QR while keeping its token and internal IDs out of visible text', async () => {
    api.getCurrentPaymentHandoff.mockResolvedValue({
      id: 'internal-handoff-id',
      publicId: 'public-handoff-id',
      displayCode: 'A7K9',
      status: 'DISPLAYED',
      expiresAt: '2026-08-27T10:05:00Z',
      amount: '12000',
      currency: 'KRW',
      orderName: '아메리카노 외 1건',
      oneTimeToken: 'one_time_token_1234',
    })
    const wrapper = mount(KioskPaymentModeView)
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    expect(wrapper.find('.qr-code svg').exists()).toBe(true)
    expect(wrapper.text()).toContain('아메리카노 외 1건')
    expect(wrapper.text()).toContain('12,000원')
    expect(wrapper.text()).not.toContain('one_time_token_1234')
    expect(wrapper.text()).not.toContain('internal-handoff-id')
    expect(wrapper.text()).not.toContain('public-handoff-id')
    wrapper.unmount()
  })

  it('creates a PAY_NOW dine-in order without a table and guides the customer to the paired kiosk', async () => {
    const cart = useKioskCartStore()
    cart.addItem({
      productId: 'product-1',
      name: '아메리카노',
      description: '',
      price: '5000',
      displayOrder: 1,
    })
    useKioskRuntimeStore().runtime = {
      deviceId: 'order-device',
      deviceName: '주문 01',
      mode: 'ORDER',
      pairedPaymentDevice: { id: 'payment-device', name: '결제 Kiosk 02' },
    }
    api.createKioskOrder.mockResolvedValue({
      orderId: 'order-1',
      displayNumber: 1052,
      totalAmount: '5000',
      currency: 'KRW',
      status: 'CREATED',
      businessDate: '2026-08-27',
      orderAccessToken: 'restricted-order-token',
    })
    api.createPayment.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      providerOrderId: 'provider-1',
      amount: '5000',
      currency: 'KRW',
      status: 'PENDING',
    })
    api.createPaymentHandoff
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({
      id: 'handoff-1',
      paymentId: 'payment-1',
      publicId: 'public-1',
      displayCode: 'A7K9',
      targetPaymentDeviceId: 'payment-device',
      targetPaymentDeviceName: '결제 Kiosk 02',
      status: 'QUEUED',
      expiresAt: '2026-08-27T10:05:00Z',
      version: '0',
      })
    const wrapper = mount(KioskCheckoutView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await wrapper.get('input[value="DINE_IN"]').setValue(true)
    await wrapper.get('footer button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('같은 요청으로 다시 시도')
    expect(wrapper.get('input[value="DINE_IN"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('footer a').exists()).toBe(false)

    await wrapper.get('footer button').trigger('click')
    await flushPromises()

    expect(api.createKioskOrder).toHaveBeenCalledWith(
      {
        orderChannel: 'KIOSK',
        serviceType: 'DINE_IN',
        paymentPolicy: 'PAY_NOW',
        lines: [{ productId: 'product-1', quantity: 1 }],
      },
      expect.any(String),
    )
    expect(api.createPayment).toHaveBeenCalledWith('order-1', expect.any(String), 'kiosk')
    expect(api.createPaymentHandoff).toHaveBeenCalledWith(
      'payment-1',
      'payment-device',
      expect.any(String),
      'kiosk',
    )
    expect(api.createKioskOrder).toHaveBeenCalledTimes(1)
    expect(api.createPayment).toHaveBeenCalledTimes(1)
    expect(api.createPaymentHandoff).toHaveBeenCalledTimes(2)
    expect(api.createPaymentHandoff.mock.calls[0]?.[2]).toBe(
      api.createPaymentHandoff.mock.calls[1]?.[2],
    )
    expect(wrapper.text()).toContain('주문번호 1052')
    expect(wrapper.text()).toContain('결제 Kiosk 02로 이동해 주세요')
    expect(wrapper.text()).toContain('A7K9')
    expect(wrapper.text()).not.toContain('CREATED')
    expect(wrapper.find('.tables').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not create an order when no payment kiosk is paired', async () => {
    const cart = useKioskCartStore()
    cart.addItem({
      productId: 'product-1',
      name: '아메리카노',
      description: '',
      price: '5000',
      displayOrder: 1,
    })
    useKioskRuntimeStore().runtime = {
      deviceId: 'order-device',
      deviceName: '주문 01',
      mode: 'ORDER',
      pairedPaymentDevice: null,
    }
    const wrapper = mount(KioskCheckoutView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await wrapper.get('footer button').trigger('click')

    expect(wrapper.text()).toContain('연결된 결제 Kiosk가 없습니다')
    expect(api.createKioskOrder).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
