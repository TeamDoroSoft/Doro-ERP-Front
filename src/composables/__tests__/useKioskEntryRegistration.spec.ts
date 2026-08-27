import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKioskEntryRegistration } from '@/composables/useKioskEntryRegistration'
import type { RegisterKioskEntryQueueRequest } from '@/api/kioskQueue'

const api = vi.hoisted(() => ({
  registerKioskEntryQueue:
    vi.fn<(body: RegisterKioskEntryQueueRequest, key: string) => Promise<void>>(),
}))
vi.mock('@/api/kioskQueue', () => ({ ...api }))

describe('useKioskEntryRegistration', () => {
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
      .mockResolvedValueOnce(undefined)
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
    api.registerKioskEntryQueue.mockResolvedValue(undefined)
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
  })
})
