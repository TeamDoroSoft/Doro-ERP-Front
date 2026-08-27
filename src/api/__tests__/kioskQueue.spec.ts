import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerKioskEntryQueue } from '@/api/kioskQueue'

describe('kiosk queue api', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('sends only party size with a caller-owned idempotency key and returns the created entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            '{"entryId":"99000000-0000-4000-8000-000000000001","businessDate":"2026-08-27","queueNumber":2,' +
              '"partySize":3,"status":"WAITING","version":9007199254740993}',
            { status: 201 },
          ),
      ),
    )

    const idempotencyKey = '91000000-0000-4000-8000-000000000001'
    await expect(registerKioskEntryQueue({ partySize: 3 }, idempotencyKey)).resolves.toEqual({
      entryId: '99000000-0000-4000-8000-000000000001',
      businessDate: '2026-08-27',
      queueNumber: 2,
      partySize: 3,
      status: 'WAITING',
      version: '9007199254740993',
    })

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/v1/kiosk/entry-queues')
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(idempotencyKey)
    expect(init?.body).toBe(JSON.stringify({ partySize: 3 }))
    expect(String(init?.body)).not.toMatch(/name|phone/i)
  })
})
