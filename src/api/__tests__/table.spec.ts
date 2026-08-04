import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTable,
  getCurrentOrders,
  updateTable,
  verifyQrTableAccess,
  type OperatorAuth,
} from '@/api/table'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>

const auth: OperatorAuth = {
  apiBaseUrl: 'https://api.example.test',
  loginId: 'manager',
  password: 'secret',
}

describe('table api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('connects table create to the real backend path with idempotency', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse({ tableId: 't-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await createTable(
      auth,
      { tableNumber: 'A1', displayName: '창가', seatCapacity: 4, active: true },
      'idem-1',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/tables',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          tableNumber: 'A1',
          displayName: '창가',
          seatCapacity: 4,
          active: true,
        }),
      }),
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('Idempotency-Key')).toBe('idem-1')
    expect(headers.get('Authorization')).toMatch(/^Basic /)
  })

  it('sends If-Match when updating a table', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse({ tableId: 't-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await updateTable(
      auth,
      'table-1',
      { tableNumber: 'A2', displayName: '홀', seatCapacity: 2 },
      7,
      'idem-2',
    )

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.test/tables/table-1')
    expect(headers.get('If-Match')).toBe('7')
    expect(headers.get('Idempotency-Key')).toBe('idem-2')
  })

  it('uses cursor pagination parameters for current orders', async () => {
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValue(jsonResponse({ session: null, items: [], nextCursor: null }))
    vi.stubGlobal('fetch', fetchMock)

    await getCurrentOrders(auth, 'table-1', {
      status: 'COMPLETED',
      cursor: 'next',
      size: 20,
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/tables/table-1/sessions/current/orders?status=COMPLETED&cursor=next&size=20',
    )
  })

  it('does not attach staff auth to public qr verification', async () => {
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(jsonResponse({ accessible: false }))
    vi.stubGlobal('fetch', fetchMock)

    await verifyQrTableAccess('plain-token')

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/qr/table-access')
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('omit')
    expect(headers.get('Authorization')).toBeNull()
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ token: 'plain-token' }))
  })

  it('normalizes backend problem responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>().mockResolvedValue(
        jsonResponse({ code: 'PRECONDITION_FAILED', detail: 'version mismatch' }, false, 412),
      ),
    )

    await expect(
      updateTable(auth, 'table-1', { tableNumber: 'A1', displayName: '창가', seatCapacity: 4 }, 1, 'idem'),
    ).rejects.toMatchObject({
      status: 412,
      code: 'PRECONDITION_FAILED',
    })
  })
})

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: vi.fn<() => Promise<unknown>>().mockResolvedValue(body),
  }
}
