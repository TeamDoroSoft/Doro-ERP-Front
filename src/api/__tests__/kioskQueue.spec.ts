import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerKioskEntryQueue } from '@/api/kioskQueue'

describe('kiosk queue api', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('sends only the minimum kiosk contact data with a caller-owned idempotency key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            '{"entryId":"99000000-0000-4000-8000-000000000001","businessDate":"2026-08-27","queueNumber":2,' +
              '"partySize":3,"customerNameMasked":"김**","phoneLastFourMasked":"**78","status":"WAITING",' +
              '"version":9007199254740993,"registeredAt":"2026-08-27T09:00:00Z"}',
            { status: 201 },
          ),
      ),
    )

    const idempotencyKey = '91000000-0000-4000-8000-000000000001'
    await expect(
      registerKioskEntryQueue(
        { partySize: 3, customerName: '김고객', phoneLastFour: '1278' },
        idempotencyKey,
      ),
    ).resolves.toEqual({
      entryId: '99000000-0000-4000-8000-000000000001',
      businessDate: '2026-08-27',
      queueNumber: 2,
      partySize: 3,
      customerNameMasked: '김**',
      phoneLastFourMasked: '**78',
      status: 'WAITING',
      version: '9007199254740993',
      registeredAt: '2026-08-27T09:00:00Z',
    })

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/v1/kiosk/entry-queues')
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(idempotencyKey)
    expect(init?.body).toBe(
      JSON.stringify({ partySize: 3, customerName: '김고객', phoneLastFour: '1278' }),
    )
    expect(String(init?.body)).not.toContain('010')
  })
})
