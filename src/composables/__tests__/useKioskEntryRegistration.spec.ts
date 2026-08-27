import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKioskEntryRegistration } from '@/composables/useKioskEntryRegistration'
import type { RegisterKioskEntryQueueRequest } from '@/api/kioskQueue'
import type { EntryQueueView } from '@/api/queue'

const api = vi.hoisted(() => ({
  registerKioskEntryQueue:
    vi.fn<(body: RegisterKioskEntryQueueRequest, key: string) => Promise<EntryQueueView>>(),
}))
vi.mock('@/api/kioskQueue', () => ({ ...api }))

describe('useKioskEntryRegistration', () => {
  const entry = {
    entryId: 'entry-1',
    businessDate: '2026-08-27',
    queueNumber: 12,
    partySize: 4,
    status: 'WAITING' as const,
    version: '0',
  }
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
  })

  it('retries an uncertain result with the same idempotency key', async () => {
    api.registerKioskEntryQueue
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(entry)
    const queue = useKioskEntryRegistration()
    queue.partySize.value = 4

    await queue.submit()
    await queue.submit()

    expect(api.registerKioskEntryQueue).toHaveBeenNthCalledWith(
      1,
      { partySize: 4 },
      '11111111-1111-4111-8111-111111111111',
    )
    expect(api.registerKioskEntryQueue).toHaveBeenNthCalledWith(
      2,
      { partySize: 4 },
      '11111111-1111-4111-8111-111111111111',
    )
  })

  it('blocks duplicate success submission and rotates the key only for another party', async () => {
    api.registerKioskEntryQueue.mockImplementation(async ({ partySize }) => ({
      ...entry,
      partySize,
    }))
    const queue = useKioskEntryRegistration()
    queue.partySize.value = 2
    await queue.submit()
    await queue.submit()
    queue.beginAnother()
    queue.partySize.value = 3
    await queue.submit()

    expect(api.registerKioskEntryQueue).toHaveBeenCalledTimes(2)
    expect(api.registerKioskEntryQueue).toHaveBeenLastCalledWith(
      { partySize: 3 },
      '22222222-2222-4222-8222-222222222222',
    )
    expect(queue.registeredEntry.value?.partySize).toBe(3)
  })

  it('accepts only the Backend party-size range', () => {
    const queue = useKioskEntryRegistration()

    queue.partySize.value = 0
    expect(queue.valid.value).toBe(false)
    queue.partySize.value = 100
    expect(queue.valid.value).toBe(true)
    queue.partySize.value = 101
    expect(queue.valid.value).toBe(false)
  })
})
