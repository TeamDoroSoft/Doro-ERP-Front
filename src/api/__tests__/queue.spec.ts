import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEntries, getFulfillments, markFulfillmentReady, registerEntry, transitionEntry } from '@/api/queue'

describe('queue API', () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('uses the exact entry registration and list contract', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 201 })).mockResolvedValueOnce(new Response('[]'))
    await registerEntry({ businessDate: '2026-08-18', partySize: 3 }, 'entry-key')
    await getEntries('2026-08-18')
    const create = fetchMock.mock.calls[0]!
    expect(create[0]).toBe('/api/v1/queues/entry')
    expect(create[1]?.method).toBe('POST')
    expect(new Headers(create[1]?.headers).get('Idempotency-Key')).toBe('entry-key')
    expect(JSON.parse(String(create[1]?.body))).toEqual({ businessDate: '2026-08-18', partySize: 3 })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/queues/entry?businessDate=2026-08-18')
  })

  it('uses the exact entry action paths without invented bodies', async () => {
    fetchMock.mockImplementation(async () => new Response('{}'))
    await transitionEntry('entry/id', 'enter')
    await transitionEntry('entry/id', 'cancel')
    await transitionEntry('entry/id', 'no-show')
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/v1/queues/entry/entry%2Fid/enter', 'POST', undefined],
      ['/api/v1/queues/entry/entry%2Fid/cancel', 'POST', undefined],
      ['/api/v1/queues/entry/entry%2Fid/no-show', 'POST', undefined],
    ])
  })

  it('lists fulfillments and marks only an identified item ready', async () => {
    fetchMock.mockResolvedValueOnce(new Response('[]')).mockResolvedValueOnce(new Response('{}'))
    await getFulfillments()
    await markFulfillmentReady('fulfillment/id')
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['/api/v1/queues/fulfillment', 'GET'],
      ['/api/v1/queues/fulfillment/fulfillment%2Fid/ready', 'POST'],
    ])
  })
})
