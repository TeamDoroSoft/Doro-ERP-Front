import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import { changeTableStatus, createTable, getTables, updateTable } from '@/api/table'

const table = {
  id: 'table-1',
  tableNumber: 'A-1',
  displayName: '창가',
  status: 'ACTIVE' as const,
  version: 0,
}

describe('table API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=csrf%20token; path=/'
  })

  it('loads the authenticated session active-table list without tenant or store parameters', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([table]), { status: 200 }))

    await expect(getTables()).resolves.toEqual([table])

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/tables')
    expect(options?.credentials).toBe('include')
    expect(url).not.toContain('tenantId')
    expect(url).not.toContain('storeId')
  })

  it('uses the confirmed create, update, and status contracts with CSRF', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(table), { status: 200 }))

    await createTable({ tableNumber: 'A-1', displayName: '창가' })
    await updateTable('table/id', { tableNumber: 'A-2', displayName: '홀' })
    await changeTableStatus('table/id', 'INACTIVE')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expectRequest(0, '/api/v1/tables', 'POST', {
      tableNumber: 'A-1',
      displayName: '창가',
    })
    expectRequest(1, '/api/v1/tables/table%2Fid', 'PATCH', {
      tableNumber: 'A-2',
      displayName: '홀',
    })
    expectRequest(2, '/api/v1/tables/table%2Fid/status', 'PATCH', { status: 'INACTIVE' })
  })

  it('parses the RFC Problem Detail contract', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'urn:doro-erp:problem:table-number-duplicated',
          status: 409,
          code: 'TABLE_NUMBER_DUPLICATED',
          detail: '중복 번호',
          requestId: 'req-123',
          fieldErrors: [{ field: 'tableNumber', code: 'DUPLICATED' }],
        }),
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    )

    const error = await createTable({ tableNumber: 'A-1', displayName: '창가' }).catch(
      (reason: unknown) => reason,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'TABLE_NUMBER_DUPLICATED',
      type: 'urn:doro-erp:problem:table-number-duplicated',
      requestId: 'req-123',
      fieldErrors: [{ field: 'tableNumber', code: 'DUPLICATED' }],
    })
  })

  it('returns a user-safe network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('network detail'))

    await expect(getTables()).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: '서버에 연결할 수 없습니다.',
    })
  })

  function expectRequest(index: number, url: string, method: string, body: object) {
    const [actualUrl, options] = fetchMock.mock.calls[index]!
    const headers = new Headers(options?.headers)
    expect(actualUrl).toBe(url)
    expect(options?.method).toBe(method)
    expect(options?.credentials).toBe('include')
    expect(headers.get('X-XSRF-TOKEN')).toBe('csrf token')
    expect(JSON.parse(String(options?.body))).toEqual(body)
  }
})
