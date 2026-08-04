import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QrLandingView from '@/views/QrLandingView.vue'

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>

describe('QrLandingView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  it('reads the fragment token, verifies it, and removes the fragment', async () => {
    const localStorageSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')
    const sessionStorageSpy = vi.spyOn(window.sessionStorage.__proto__, 'setItem')
    const fetchMock = vi.fn<FetchMock>().mockResolvedValue(
      jsonResponse({
        accessible: true,
        store: { tenantId: 'qr-store' },
        table: { tableNumber: 'A1', displayName: '창가' },
        session: { sessionId: 'session-1' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState(null, '', '/qr#token=plain-secret-token')

    const wrapper = mount(QrLandingView)
    await flushPromises()

    expect(window.location.hash).toBe('')
    expect(fetchMock).toHaveBeenCalledWith(
      '/qr/table-access',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: JSON.stringify({ token: 'plain-secret-token' }),
      }),
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('Authorization')).toBeNull()
    expect(wrapper.text()).toContain('테이블 접근이 확인됐습니다.')
    expect(wrapper.text()).toContain('창가')
    expect(wrapper.text()).not.toContain('plain-secret-token')
    expect(localStorageSpy).not.toHaveBeenCalled()
    expect(sessionStorageSpy).not.toHaveBeenCalled()
  })

  it('shows a safe customer message for invalid qr tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>().mockResolvedValue(
        jsonResponse({ code: 'QR_ACCESS_DENIED', detail: 'denied' }, false, 403),
      ),
    )
    window.history.replaceState(null, '', '/qr#token=revoked-token')

    const wrapper = mount(QrLandingView)
    await flushPromises()

    expect(wrapper.text()).toContain('이 QR은 현재 사용할 수 없습니다.')
    expect(wrapper.text()).not.toContain('revoked-token')
    expect(wrapper.text()).not.toContain('digest')
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
