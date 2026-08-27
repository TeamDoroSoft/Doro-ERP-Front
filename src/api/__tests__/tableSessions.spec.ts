import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addOrderToTableSession,
  checkoutTableSession,
  getTableSession,
  openTableSession,
} from '@/api/tableSessions'

const sessionWire = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  tableId: '22222222-2222-4222-8222-222222222222',
  businessDate: '2026-08-27',
  status: 'OPEN',
  version: 3,
  openedAt: '2026-08-27T10:00:00Z',
  closedAt: null,
  orders: [
    {
      orderId: '33333333-3333-4333-8333-333333333333',
      displayNumber: 17,
      amount: 9000,
      paymentStatus: 'UNPAID',
    },
  ],
  unpaidTotal: 9000,
}

describe('table sessions API', () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('opens, reads, and attaches through the employee routes with exact totals', async () => {
    const wire = JSON.stringify(sessionWire).split('9000').join('9007199254740993')
    fetchMock.mockImplementation(async () => new Response(wire, { status: 200 }))
    await expect(openTableSession(sessionWire.tableId)).resolves.toMatchObject({
      unpaidTotal: '9007199254740993',
    })
    await getTableSession(sessionWire.sessionId)
    await addOrderToTableSession(sessionWire.sessionId, sessionWire.orders[0]!.orderId)
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['/api/v1/table-sessions', 'POST'],
      [`/api/v1/table-sessions/${sessionWire.sessionId}`, 'GET'],
      [`/api/v1/table-sessions/${sessionWire.sessionId}/orders`, 'POST'],
    ])
  })

  it('starts checkout without sending a client total', async () => {
    const response = {
      handoffId: 'h1',
      paymentId: 'p1',
      displayCode: 'A7K9',
      targetPaymentDeviceId: 'd1',
      targetPaymentDeviceName: '결제 01',
      status: 'QUEUED',
      expiresAt: '2026-08-27T10:05:00Z',
      version: 4,
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
    await expect(checkoutTableSession(sessionWire.sessionId, 'd1')).resolves.toMatchObject({
      version: '4',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      targetPaymentDeviceId: 'd1',
    })
  })
})
