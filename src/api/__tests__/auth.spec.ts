import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeOwnPassword, login, logout } from '@/api/auth'
import { ApiError, registerUnauthorizedHandler } from '@/api/http'

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

  it('keeps the session on a wrong current password instead of running the 401 boundary', async () => {
    const unauthorized = vi.fn()
    registerUnauthorizedHandler(unauthorized)
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 401, code: 'CURRENT_PASSWORD_INCORRECT', detail: '현재 비밀번호가 올바르지 않습니다.' }),
        { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    )

    await expect(
      changeOwnPassword({ currentPassword: 'wrong', newPassword: 'new-password' }),
    ).rejects.toMatchObject({ status: 401, code: 'CURRENT_PASSWORD_INCORRECT' })
    expect(unauthorized).not.toHaveBeenCalled()
  })

  it('surfaces the session-scoped 401 codes without clearing the session in the API layer', async () => {
    const unauthorized = vi.fn()
    registerUnauthorizedHandler(unauthorized)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 401, code: 'SESSION_ABSOLUTE_EXPIRED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )

    const caught = await changeOwnPassword({ currentPassword: 'old', newPassword: 'new-password' }).catch(
      (error: unknown) => error,
    )
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).code).toBe('SESSION_ABSOLUTE_EXPIRED')
    expect(unauthorized).not.toHaveBeenCalled()
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
