import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changeProviderAdminTenantStatus,
  createProviderAdminInitialOwner,
  getProviderAdminSession,
  getProviderAdminTenant,
  getProviderAdminTenants,
  logoutProviderAdmin,
  providerAdminLoginUrl,
  provisionProviderAdminTenant,
} from '@/api/providerAdmin'
import { registerUnauthorizedHandler } from '@/api/http'

describe('Provider Admin API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=provider%20csrf; path=/'
  })

  it('uses the Admin Edge authentication routes with included credentials', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          adminId: '90000000-0000-0000-0000-000000000009',
          expiresAt: '2026-08-21T10:00:00Z',
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await getProviderAdminSession()
    await logoutProviderAdmin()

    expect(providerAdminLoginUrl()).toBe('/api/v1/provider/auth/login')
    expectRequest(0, '/api/v1/provider/auth/me', 'GET')
    expectRequest(1, '/api/v1/provider/auth/logout', 'POST')
  })

  it('sends only approved server-side list filters and preserves int64 totals', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '{"items":[],"page":2,"size":20,"totalCount":9007199254740993,"totalPages":450359962737050}',
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await getProviderAdminTenants({
      code: ' doro ',
      name: ' 도로 ',
      status: 'ACTIVE',
      page: 2,
      size: 20,
    })

    expect(result.totalCount).toBe('9007199254740993')
    expect(result.totalPages).toBe('450359962737050')
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/provider/tenants?code=doro&name=%EB%8F%84%EB%A1%9C&status=ACTIVE&page=2&size=20',
    )
  })

  it('uses the exact detail and command contracts without requestedBy', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111'
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ tenantId }))
      .mockResolvedValueOnce(jsonResponse({ tenantId, tenantCode: 'doro' }, 201))
      .mockResolvedValueOnce(jsonResponse({ employeeId: 'employee-1' }, 201))
      .mockResolvedValueOnce(jsonResponse({ tenantId, status: 'INACTIVE' }))

    await getProviderAdminTenant(tenantId)
    await provisionProviderAdminTenant({
      tenantCode: ' doro ',
      tenantName: ' 도로 ',
      storeName: ' 본점 ',
      timezone: '',
    })
    await createProviderAdminInitialOwner(tenantId, {
      loginId: ' owner ',
      temporaryPassword: 'temporary-secret',
    })
    await changeProviderAdminTenantStatus(tenantId, 'INACTIVE')

    expectRequest(0, `/api/v1/provider/tenants/${tenantId}`, 'GET')
    expectRequest(1, '/api/v1/provider/tenants', 'POST', {
      tenantCode: 'doro',
      tenantName: '도로',
      storeName: '본점',
    })
    expectRequest(2, `/api/v1/provider/tenants/${tenantId}/first-owner`, 'POST', {
      loginId: 'owner',
      temporaryPassword: 'temporary-secret',
    })
    expectRequest(3, `/api/v1/provider/tenants/${tenantId}/status`, 'PATCH', {
      status: 'INACTIVE',
    })
    for (const [, options] of fetchMock.mock.calls) {
      expect(String(options?.body)).not.toContain('requestedBy')
    }
  })

  it('sends the exact Provider Admin status PATCH with credentials and common CSRF', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tenantId: 'tenant/id', status: 'INACTIVE' }))

    await changeProviderAdminTenantStatus('tenant/id', 'INACTIVE')

    const [url, options] = fetchMock.mock.calls[0]!
    const headers = new Headers(options?.headers)
    expect(url).toBe('/api/v1/provider/tenants/tenant%2Fid/status')
    expect(options?.method).toBe('PATCH')
    expect(options?.credentials).toBe('include')
    expect(headers.get('X-XSRF-TOKEN')).toBe('provider csrf')
    expect(JSON.parse(String(options?.body))).toEqual({ status: 'INACTIVE' })
  })

  it('keeps an Admin 401 out of the employee session boundary', async () => {
    const unauthorized = vi.fn<() => void>()
    registerUnauthorizedHandler(unauthorized)
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 401, code: 'UNAUTHENTICATED' }, 401, 'application/problem+json'),
    )

    await expect(getProviderAdminSession()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    })
    expect(unauthorized).not.toHaveBeenCalled()
  })

  function expectRequest(index: number, url: string, method: string, body?: object) {
    const [actualUrl, options] = fetchMock.mock.calls[index]!
    expect(actualUrl).toBe(url)
    expect(options?.method).toBe(method)
    expect(options?.credentials).toBe('include')
    expect(options?.body === undefined ? undefined : JSON.parse(String(options.body))).toEqual(
      body,
    )
  }
})

function jsonResponse(
  body: object,
  status = 200,
  contentType = 'application/json',
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType },
  })
}
