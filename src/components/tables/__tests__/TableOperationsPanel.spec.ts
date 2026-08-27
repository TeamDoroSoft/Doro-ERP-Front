import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import TableOperationsPanel from '@/components/tables/TableOperationsPanel.vue'
import type { OrderResponse } from '@/api/order'
import type { PaymentKioskCandidate } from '@/api/paymentKioskCandidates'
import type { TableResponse } from '@/api/table'
import type { TableSession, TableSessionCheckoutHandoff } from '@/api/tableSessions'

const api = vi.hoisted(() => ({
  listActiveTableSessions: vi.fn<(tableId?: string) => Promise<TableSession[]>>(),
  getTableSession: vi.fn<(id: string) => Promise<TableSession>>(),
  checkoutTableSession:
    vi.fn<(id: string, targetPaymentDeviceId: string) => Promise<TableSessionCheckoutHandoff>>(),
  getTables: vi.fn<() => Promise<TableResponse[]>>(),
  getOrders: vi.fn<() => Promise<OrderResponse[]>>(),
  assignOrderTable: vi.fn<(orderId: string, tableId: string) => Promise<OrderResponse>>(),
  listActivePaymentKioskCandidatesForStaff:
    vi.fn<() => Promise<PaymentKioskCandidate[]>>(),
}))

vi.mock('@/api/tableSessions', () => ({
  listActiveTableSessions: api.listActiveTableSessions,
  getTableSession: api.getTableSession,
  checkoutTableSession: api.checkoutTableSession,
}))
vi.mock('@/api/table', () => ({ getTables: api.getTables }))
vi.mock('@/api/order', () => ({ getOrders: api.getOrders, assignOrderTable: api.assignOrderTable }))
vi.mock('@/api/paymentKioskCandidates', () => ({
  listActivePaymentKioskCandidatesForStaff: api.listActivePaymentKioskCandidatesForStaff,
}))

const table: TableResponse = {
  id: 'table-1',
  tableNumber: 'A-1',
  displayName: '창가',
  status: 'ACTIVE',
  version: '0',
}
const session: TableSession = {
  sessionId: 'session-1',
  tableId: 'table-1',
  businessDate: '2026-08-27',
  status: 'OPEN',
  version: '2',
  openedAt: '2026-08-27T09:00:00Z',
  closedAt: null,
  orders: [
    {
      orderId: 'order-1',
      displayNumber: 17,
      itemSummary: '아메리카노 × 2',
      amount: '9000',
      orderStatus: 'ACCEPTED',
      paymentStatus: 'UNPAID',
    },
  ],
  unpaidTotal: '9000',
}
const unassigned: OrderResponse = {
  orderId: 'order-2',
  displayNumber: 18,
  totalAmount: '4500',
  currency: 'KRW',
  status: 'ACCEPTED',
  businessDate: '2026-08-27',
  orderAccessToken: null,
  sourceType: 'KIOSK',
  sourceDeviceId: 'device-order',
  sourceDeviceNameSnapshot: '입구 주문 01',
  paymentHandoffDeviceIdSnapshot: null,
  paymentHandoffDeviceNameSnapshot: null,
  serviceType: 'DINE_IN',
  paymentPolicy: 'PAY_NOW',
  paymentStatus: 'PAID',
  tableId: null,
}

describe('TableOperationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listActiveTableSessions.mockResolvedValue([session])
    api.getTableSession.mockResolvedValue(session)
    api.getTables.mockResolvedValue([table])
    api.getOrders.mockResolvedValue([unassigned])
    api.listActivePaymentKioskCandidatesForStaff.mockResolvedValue([])
    api.assignOrderTable.mockResolvedValue({ ...unassigned, tableId: 'table-1' })
  })

  it('shows server session totals, order summaries, and unassigned kiosk dine-in orders', async () => {
    const wrapper = mount(TableOperationsPanel)
    await flushPromises()

    expect(wrapper.text()).toContain('A-1 · 창가')
    expect(wrapper.text()).toContain('아메리카노 × 2')
    expect(wrapper.text()).toContain('₩9,000')
    expect(wrapper.text()).toContain('주문 #18')
  })

  it('assigns an explicit table and refreshes the server projections', async () => {
    const wrapper = mount(TableOperationsPanel)
    await flushPromises()
    const select = wrapper.get('select[aria-label="주문 18 테이블"]')
    await select.setValue('table-1')
    await findButton(wrapper, '테이블 배정').trigger('click')
    await flushPromises()

    expect(api.assignOrderTable).toHaveBeenCalledWith('order-2', 'table-1')
    expect(api.listActiveTableSessions).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('주문 #18에 테이블을 배정했습니다.')
  })

  it('re-queries the list after a 409 assignment conflict', async () => {
    api.assignOrderTable.mockRejectedValue(new ApiError(409))
    const wrapper = mount(TableOperationsPanel)
    await flushPromises()
    await wrapper.get('select[aria-label="주문 18 테이블"]').setValue('table-1')
    await findButton(wrapper, '테이블 배정').trigger('click')
    await flushPromises()

    expect(api.listActiveTableSessions).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[role="alert"]').text()).toContain('최신 목록을 다시 불러왔습니다')
  })

  function findButton(wrapper: ReturnType<typeof mount>, label: string) {
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
    if (!button) throw new Error(`button not found: ${label}`)
    return button
  }
})
