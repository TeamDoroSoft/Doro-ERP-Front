import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiError } from '@/api/http'
import PosTableSessionPanel from '@/components/tables/PosTableSessionPanel.vue'
import type * as TableSessionApi from '@/api/tableSessions'

const tableApi = vi.hoisted(() => ({
  checkoutTableSession: vi.fn<typeof TableSessionApi.checkoutTableSession>(),
  getTableSession: vi.fn<typeof TableSessionApi.getTableSession>(),
}))
vi.mock('@/api/tableSessions', () => tableApi)

const session = {
  sessionId: 'session-1',
  tableId: 'table-1',
  businessDate: '2026-08-27',
  status: 'OPEN' as const,
  version: '3',
  openedAt: '2026-08-27T10:00:00Z',
  closedAt: null,
  orders: [
    { orderId: 'order-1', displayNumber: 17, amount: '9000', paymentStatus: 'UNPAID' as const },
  ],
  unpaidTotal: '9000',
}
const device = {
  id: 'device-1',
  deviceCode: 'PAY-01',
  status: 'ACTIVE' as const,
  mode: 'PAYMENT' as const,
  pairedPaymentDeviceId: null,
  credentialVersion: 1,
  createdAt: '2026-08-27T09:00:00Z',
  updatedAt: '2026-08-27T09:00:00Z',
}

describe('PosTableSessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tableApi.getTableSession.mockResolvedValue({
      ...session,
      status: 'CHECKOUT_PENDING',
      version: '4',
    })
    tableApi.checkoutTableSession.mockResolvedValue({
      handoffId: 'handoff-1',
      paymentId: 'payment-1',
      displayCode: 'A7K9',
      targetPaymentDeviceId: 'device-1',
      targetPaymentDeviceName: '결제 01',
      status: 'QUEUED',
      expiresAt: '2026-08-27T10:05:00Z',
      version: '0',
    })
  })

  it('shows server-owned totals and refreshes the checkout lock after creating a handoff', async () => {
    const wrapper = mount(PosTableSessionPanel, { props: { session, paymentDevices: [device] } })
    expect(wrapper.text()).toContain('₩9,000')
    await wrapper.get('#table-payment-device').setValue('device-1')
    await wrapper.get('.checkout-controls button').trigger('click')
    await flushPromises()
    expect(tableApi.checkoutTableSession).toHaveBeenCalledWith('session-1', 'device-1')
    expect(wrapper.emitted('updated')?.[0]?.[0]).toMatchObject({
      status: 'CHECKOUT_PENDING',
      version: '4',
    })
    expect(wrapper.text()).toContain('결제코드 A7K9')
  })

  it('recovers current state on a lock conflict without exposing server detail', async () => {
    tableApi.checkoutTableSession.mockRejectedValue(
      new ApiError(409, { code: 'INVALID_STATE', detail: 'raw database detail' }),
    )
    const wrapper = mount(PosTableSessionPanel, { props: { session, paymentDevices: [device] } })
    await wrapper.get('#table-payment-device').setValue('device-1')
    await wrapper.get('.checkout-controls button').trigger('click')
    await flushPromises()
    expect(tableApi.getTableSession).toHaveBeenCalledWith('session-1')
    expect(wrapper.text()).toContain('다른 직원이 테이블을 변경했습니다.')
    expect(wrapper.text()).not.toContain('raw database detail')
  })
})
