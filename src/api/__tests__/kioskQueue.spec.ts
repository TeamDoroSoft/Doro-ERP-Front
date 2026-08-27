import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerKioskEntryQueue } from '@/api/kioskQueue'

describe('kiosk queue api', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('sends only party size with a caller-owned idempotency key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))

    await registerKioskEntryQueue({ partySize: 3 }, 'entry-key')

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/v1/kiosk/entry-queues')
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('entry-key')
    expect(init?.body).toBe(JSON.stringify({ partySize: 3 }))
    expect(String(init?.body)).not.toMatch(/name|phone/i)
  })
})
