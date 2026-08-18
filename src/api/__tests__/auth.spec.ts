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
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/employees/me/password')
        ? new Response(JSON.stringify(employeeResponse()), { status: 200 })
        : new Response(null, { status: 204 }),
    )

    await logout()
    await changeOwnPassword({ currentPassword: 'old', newPassword: 'new-password' })

    for (const [, options] of fetchMock.mock.calls) {
      expect(new Headers(options?.headers).get('X-XSRF-TOKEN')).toBe('csrf value')
      expect(options?.credentials).toBe('include')
    }
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/employees/me/password')
  })

  it('returns the EmployeeResponse body that the Store Access controller answers with', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(employeeResponse()), { status: 200 }),
    )

    await expect(
      changeOwnPassword({ currentPassword: 'old', newPassword: 'new-password' }),
    ).resolves.toEqual(employeeResponse())

    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/employees/me/password')
    expect(options?.method).toBe('PATCH')
  })
})

function employeeResponse() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    loginId: 'owner',
    role: 'OWNER' as const,
    status: 'ACTIVE' as const,
    passwordChangeRequired: false,
    createdAt: '2026-08-17T00:00:00Z',
  }
}

function loginResponse() {
  return { employeeId: '11111111-1111-4111-8111-111111111111', role: 'OWNER', passwordChangeRequired: false }
}
