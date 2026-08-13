import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, registerUnauthorizedHandler } from '@/api/http'

describe('common authentication errors', () => {
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

    await expect(apiRequest('/protected')).rejects.toMatchObject({ status: 403, code: 'ACCESS_DENIED' })
    expect(handler).not.toHaveBeenCalled()
  })
})

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ status, code, title: code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
