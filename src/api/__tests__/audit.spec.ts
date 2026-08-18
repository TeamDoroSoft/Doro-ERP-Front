import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAudit, getAudits } from '@/api/audit'

describe('audit API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('uses only the approved list filters and opaque cursor', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }))
    await getAudits({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-07T23:59:59.000Z',
      action: 'ORDER_ACCEPTED',
      targetType: 'ORDER',
      targetId: '11111111-1111-4111-8111-111111111111',
      size: 20,
      cursor: 'opaque_cursor-1',
    })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://local')
    expect(url.pathname).toBe('/api/v1/audits')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-07T23:59:59.000Z',
      action: 'ORDER_ACCEPTED',
      targetType: 'ORDER',
      targetId: '11111111-1111-4111-8111-111111111111',
      size: '20',
      cursor: 'opaque_cursor-1',
    })
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('include')
  })

  it('keeps int64 metadata values exact without changing other metadata types', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '{"id":"audit-1","sourceService":"commerce","eventId":"22222222-2222-4222-8222-222222222222",' +
          '"action":"ORDER_CREATED","actor":{"type":"EMPLOYEE","id":"employee-1","role":"STAFF"},' +
          '"target":{"type":"ORDER","id":"order-1"},"result":"SUCCESS","reasonCode":null,' +
          '"metadata":{"totalAmount":9007199254740993,"version":9007199254740993,"currency":"KRW",' +
          '"displayNumber":7,"soldOut":false,"previousSoldOut":null},' +
          '"traceId":"trace-1","occurredAt":"2026-08-18T00:00:00Z"}',
        { status: 200 },
      ),
    )

    const detail = await getAudit('audit-1')

    expect(detail.metadata.totalAmount).toBe('9007199254740993')
    expect(String(detail.metadata.totalAmount)).toBe('9007199254740993')
    expect(detail.metadata.version).toBe('9007199254740993')
    expect(detail.metadata.currency).toBe('KRW')
    expect(detail.metadata.soldOut).toBe(false)
    expect(detail.metadata.previousSoldOut).toBeNull()
    expect(detail.reasonCode).toBeNull()
    expect(detail.actor).toEqual({ type: 'EMPLOYEE', id: 'employee-1', role: 'STAFF' })
  })

  it('treats a detail id as opaque and safely encodes it', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(record()), { status: 200 }))
    await getAudit('legacy/id')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/audits/legacy%2Fid')
  })
})

function record() {
  return {
    id: 'audit-1', sourceService: 'commerce', eventId: 'event-1', action: 'ORDER_ACCEPTED',
    actor: { type: 'EMPLOYEE', id: 'actor-1', role: 'MANAGER' },
    target: { type: 'ORDER', id: 'target-1' }, result: 'SUCCESS', reasonCode: null,
    metadata: {}, traceId: 'trace-1', occurredAt: '2026-08-07T09:00:00Z',
  }
}
