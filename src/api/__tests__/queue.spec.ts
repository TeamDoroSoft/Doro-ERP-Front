import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getEntries,
  getFulfillments,
  markFulfillmentReady,
  registerEntry,
  transitionEntry,
} from '@/api/queue'

describe('queue API', () => {
  const entryId = '99000000-0000-4000-8000-000000000001'
  const fulfillmentId = 'aa000000-0000-4000-8000-000000000001'
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('keeps int64 entry and fulfillment versions exact', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          `[{"entryId":"${entryId}","businessDate":"2026-08-18","queueNumber":1,"partySize":2,` +
            '"status":"WAITING","registeredAt":"2026-08-18T09:00:00Z","version":9007199254740993}]',
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
            `[{"fulfillmentId":"${fulfillmentId}","orderId":"66000000-0000-4000-8000-000000000001","businessDate":"2026-08-18","displayNumber":7,` +
            '"status":"PREPARING","version":9007199254740993,' +
            '"sourceType":"KIOSK","sourceDeviceNameSnapshot":"입구 주문 Kiosk 01",' +
            '"itemSummary":"아메리카노 × 2"}]',
          { status: 200 },
        ),
      )

    const [entry] = await getEntries('2026-08-18')
    const [fulfillment] = await getFulfillments('2026-08-18')

    expect(entry?.version).toBe('9007199254740993')
    expect(entry?.queueNumber).toBe(1)
    expect(entry?.registeredAt).toBe('2026-08-18T09:00:00Z')
    expect(fulfillment?.version).toBe('9007199254740993')
    expect(fulfillment?.displayNumber).toBe(7)
    expect(fulfillment?.sourceType).toBe('KIOSK')
    expect(fulfillment?.sourceDeviceNameSnapshot).toBe('입구 주문 Kiosk 01')
    expect(fulfillment?.itemSummary).toBe('아메리카노 × 2')
  })

  it('uses the exact entry registration and list contract', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
      .mockResolvedValueOnce(new Response('[]'))
    const idempotencyKey = '91000000-0000-4000-8000-000000000002'
    await registerEntry({ businessDate: '2026-08-18', partySize: 3 }, idempotencyKey)
    await getEntries('2026-08-18')
    const create = fetchMock.mock.calls[0]!
    expect(create[0]).toBe('/api/v1/queues/entry')
    expect(create[1]?.method).toBe('POST')
    expect(new Headers(create[1]?.headers).get('Idempotency-Key')).toBe(idempotencyKey)
    expect(JSON.parse(String(create[1]?.body))).toEqual({
      businessDate: '2026-08-18',
      partySize: 3,
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/queues/entry?businessDate=2026-08-18')
  })

  it('uses the exact entry action paths without invented bodies', async () => {
    fetchMock.mockImplementation(async () => new Response('{}'))
    await transitionEntry(entryId, 'enter')
    await transitionEntry(entryId, 'cancel')
    await transitionEntry(entryId, 'no-show')
    expect(
      fetchMock.mock.calls.map(([url, options]) => [url, options?.method, options?.body]),
    ).toEqual([
      [`/api/v1/queues/entry/${entryId}/enter`, 'POST', undefined],
      [`/api/v1/queues/entry/${entryId}/cancel`, 'POST', undefined],
      [`/api/v1/queues/entry/${entryId}/no-show`, 'POST', undefined],
    ])
  })

  it('lists fulfillments and marks only an identified item ready', async () => {
    fetchMock.mockResolvedValueOnce(new Response('[]')).mockResolvedValueOnce(new Response('{}'))
    await getFulfillments('2026-08-18')
    await markFulfillmentReady(fulfillmentId)
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['/api/v1/queues/fulfillment?businessDate=2026-08-18', 'GET'],
      [`/api/v1/queues/fulfillment/${fulfillmentId}/ready`, 'POST'],
    ])
  })
})
