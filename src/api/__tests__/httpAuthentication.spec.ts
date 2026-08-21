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
})

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ status, code, title: code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
