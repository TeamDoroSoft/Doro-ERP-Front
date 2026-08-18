import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, registerUnauthorizedHandler, safeApiErrorMessage } from '@/api/http'

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
    vi.unstubAllGlobals()
  })

  it('notifies the session boundary for a 401', async () => {
    const handler = vi.fn<() => void>()
    registerUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(401, 'UNAUTHENTICATED')))

    await expect(apiRequest('/protected')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledOnce()
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
