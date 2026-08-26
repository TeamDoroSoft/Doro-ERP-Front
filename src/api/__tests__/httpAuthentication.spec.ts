import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiRequest,
  registerKioskUnauthorizedHandler,
  registerUnauthorizedHandler,
  safeApiErrorMessage,
} from '@/api/http'

describe('common authentication errors', () => {
  it('does not expose backend detail in the shared user message', () => {
    const error = new ApiError(503, {
      code: 'DEPENDENCY_UNAVAILABLE',
      detail: 'internal service host',
    })
    expect(safeApiErrorMessage(error)).toBe(
      '현재 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    )
    expect(safeApiErrorMessage(error)).not.toContain('internal')
  })
  afterEach(() => {
    registerUnauthorizedHandler(() => undefined)
    registerKioskUnauthorizedHandler(() => undefined)
    vi.unstubAllGlobals()
  })

  it.each(['UNAUTHENTICATED', 'SESSION_ABSOLUTE_EXPIRED', 'SESSION_INVALIDATED'])(
    'notifies the employee session boundary for %s',
    async (code) => {
      const handler = vi.fn<() => void>()
      registerUnauthorizedHandler(handler)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(401, code)))

      await expect(apiRequest('/protected')).rejects.toMatchObject({ status: 401 })
      expect(handler).toHaveBeenCalledOnce()
    },
  )

  it.each([
    'CURRENT_PASSWORD_INCORRECT',
    'AUTHENTICATION_FAILED',
    'AUTHENTICATION_REQUIRED',
    'KIOSK_AUTHENTICATION_FAILED',
  ])('keeps a non-session 401 on the current screen for %s', async (code) => {
    const handler = vi.fn<() => void>()
    registerUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(401, code)))

    await expect(apiRequest('/protected')).rejects.toMatchObject({ status: 401, code })
    expect(handler).not.toHaveBeenCalled()
  })

  it('notifies only the kiosk boundary for its authentication failure code', async () => {
    const employeeHandler = vi.fn<() => void>()
    const kioskHandler = vi.fn<() => void>()
    registerUnauthorizedHandler(employeeHandler)
    registerKioskUnauthorizedHandler(kioskHandler)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(problem(401, 'KIOSK_AUTHENTICATION_FAILED')),
    )

    await expect(
      apiRequest('/kiosk-protected', {}, { handleUnauthorized: 'kiosk' }),
    ).rejects.toMatchObject({ status: 401, code: 'KIOSK_AUTHENTICATION_FAILED' })
    expect(kioskHandler).toHaveBeenCalledOnce()
    expect(employeeHandler).not.toHaveBeenCalled()
  })

  it('keeps unrelated 401 codes inside a kiosk flow', async () => {
    const kioskHandler = vi.fn<() => void>()
    registerKioskUnauthorizedHandler(kioskHandler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(401, 'AUTHENTICATION_REQUIRED')))

    await expect(
      apiRequest('/kiosk-protected', {}, { handleUnauthorized: 'kiosk' }),
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' })
    expect(kioskHandler).not.toHaveBeenCalled()
  })

  it('keeps a 403 on the current screen for permission UX', async () => {
    const handler = vi.fn<() => void>()
    registerUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(403, 'ACCESS_DENIED')))

    await expect(apiRequest('/protected')).rejects.toMatchObject({
      status: 403,
      code: 'ACCESS_DENIED',
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it.each(['POST', 'PATCH'])(
    'adds included credentials and decoded CSRF to %s requests',
    async (method) => {
      document.cookie = 'XSRF-TOKEN=common%20csrf; path=/'
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchMock)

      await apiRequest('/protected-command', { method })

      const [url, options] = fetchMock.mock.calls[0]!
      const headers = new Headers(options?.headers)
      expect(url).toBe('/api/v1/protected-command')
      expect(options?.method).toBe(method)
      expect(options?.credentials).toBe('include')
      expect(headers.get('X-XSRF-TOKEN')).toBe('common csrf')
    },
  )

  it('does not attach the CSRF header to a safe request', async () => {
    document.cookie = 'XSRF-TOKEN=common%20csrf; path=/'
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/protected')

    const [, options] = fetchMock.mock.calls[0]!
    expect(options?.credentials).toBe('include')
    expect(new Headers(options?.headers).has('X-XSRF-TOKEN')).toBe(false)
  })
})

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ status, code, title: code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
