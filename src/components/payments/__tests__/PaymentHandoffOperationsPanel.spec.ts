import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import PaymentHandoffOperationsPanel from '@/components/payments/PaymentHandoffOperationsPanel.vue'
import type { PaymentHandoff } from '@/api/paymentHandoff'
import type { PaymentKioskCandidate } from '@/api/paymentKioskCandidates'

const api = vi.hoisted(() => ({
  recoverPaymentHandoffByOrder: vi.fn<(orderId: string) => Promise<PaymentHandoff>>(),
  reissuePaymentHandoff: vi.fn<(id: string) => Promise<PaymentHandoff>>(),
  reassignPaymentHandoff:
    vi.fn<(id: string, targetPaymentDeviceId: string) => Promise<PaymentHandoff>>(),
  cancelPaymentHandoff: vi.fn<(id: string) => Promise<PaymentHandoff>>(),
  listActivePaymentKioskCandidatesForStaff:
    vi.fn<() => Promise<PaymentKioskCandidate[]>>(),
}))

vi.mock('@/api/paymentHandoff', () => ({
  recoverPaymentHandoffByOrder: api.recoverPaymentHandoffByOrder,
  reissuePaymentHandoff: api.reissuePaymentHandoff,
  reassignPaymentHandoff: api.reassignPaymentHandoff,
  cancelPaymentHandoff: api.cancelPaymentHandoff,
}))
vi.mock('@/api/paymentKioskCandidates', () => ({
  listActivePaymentKioskCandidatesForStaff: api.listActivePaymentKioskCandidatesForStaff,
}))

const handoff: PaymentHandoff = {
  id: 'handoff-1',
  paymentId: 'payment-1',
  publicId: 'public-1',
  displayCode: 'A7K9',
  targetPaymentDeviceId: 'device-1',
  targetPaymentDeviceName: '카운터 결제 01',
  status: 'QUEUED',
  expiresAt: '2026-08-27T10:05:00Z',
  version: '3',
}

describe('PaymentHandoffOperationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.recoverPaymentHandoffByOrder.mockResolvedValue(handoff)
    api.listActivePaymentKioskCandidatesForStaff.mockResolvedValue([
      { deviceId: 'device-1', displayName: '카운터 결제 01', mode: 'PAYMENT', active: true },
      { deviceId: 'device-2', displayName: '카운터 결제 02', mode: 'PAYMENT', active: true },
    ])
  })

  it('recovers by order and shows the latest safe operational projection', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(api.recoverPaymentHandoffByOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('주문 #17')
    expect(wrapper.text()).toContain('카운터 결제 01')
    expect(wrapper.text()).toContain('A7K9')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).not.toContain('payment-1')
    expect(wrapper.text()).not.toContain('public-1')
  })

  it('requires an explicit reassignment selection and applies the returned latest version', async () => {
    api.reassignPaymentHandoff.mockResolvedValue({
      ...handoff,
      targetPaymentDeviceId: 'device-2',
      targetPaymentDeviceName: '카운터 결제 02',
      version: '4',
    })
    const wrapper = mountPanel()
    await flushPromises()

    const reassign = findButton(wrapper, '재배정')
    expect(reassign.attributes('disabled')).toBeDefined()
    await wrapper.get('select').setValue('device-2')
    await reassign.trigger('click')
    await flushPromises()

    expect(api.reassignPaymentHandoff).toHaveBeenCalledWith('handoff-1', 'device-2')
    expect(wrapper.text()).toContain('결제 Kiosk를 재배정했습니다.')
    expect(wrapper.text()).toContain('4')
  })

  it.each([409, 503])('re-queries canonical state after an ambiguous %s mutation', async (status) => {
    api.cancelPaymentHandoff.mockRejectedValue(new ApiError(status))
    api.recoverPaymentHandoffByOrder
      .mockResolvedValueOnce(handoff)
      .mockResolvedValueOnce({ ...handoff, status: 'CANCELLED', version: '4' })
    const wrapper = mountPanel()
    await flushPromises()
    await findButton(wrapper, '취소').trigger('click')
    await flushPromises()

    expect(api.recoverPaymentHandoffByOrder).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('취소')
    expect(wrapper.get('[role="alert"]').text()).not.toContain('undefined')
  })

  function mountPanel() {
    return mount(PaymentHandoffOperationsPanel, {
      props: { orderId: 'order-1', orderDisplayNumber: 17, initialHandoff: handoff },
    })
  }

  function findButton(wrapper: ReturnType<typeof mount>, label: string) {
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
    if (!button) throw new Error(`button not found: ${label}`)
    return button
  }
})
