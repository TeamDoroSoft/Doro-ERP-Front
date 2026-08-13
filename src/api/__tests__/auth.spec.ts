import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeOwnPassword, login, logout } from '@/api/auth'

describe('auth API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=csrf%20value; path=/'
  })

  it('logs in with the exact Store Access contract and included credentials', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(loginResponse()), { status: 200 }))

    await expect(login({ tenantCode: 'doro', loginId: 'owner', password: 'secret' })).resolves.toEqual(loginResponse())

    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/auth/login')
    expect(options?.credentials).toBe('include')
    expect(options?.method).toBe('POST')
    expect(JSON.parse(String(options?.body))).toEqual({ tenantCode: 'doro', loginId: 'owner', password: 'secret' })
  })

  it('sends the backend-issued CSRF cookie on logout and password change', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await logout()
    await changeOwnPassword({ currentPassword: 'old', newPassword: 'new-password' })

    for (const [, options] of fetchMock.mock.calls) {
      expect(new Headers(options?.headers).get('X-XSRF-TOKEN')).toBe('csrf value')
      expect(options?.credentials).toBe('include')
    }
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/employees/me/password')
  })
})

function loginResponse() {
  return { employeeId: '11111111-1111-4111-8111-111111111111', role: 'OWNER', passwordChangeRequired: false }
}
