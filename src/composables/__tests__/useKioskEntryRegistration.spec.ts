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
    customerNameMasked: '김**',
    phoneLastFourMasked: '**78',
    status: 'WAITING' as const,
    version: '0',
    registeredAt: '2026-08-27T09:00:00Z',
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
    queue.customerName.value = ' 김고객 '
    queue.phoneLastFour.value = '1278'

    await queue.submit()
    await queue.submit()

    expect(api.registerKioskEntryQueue).toHaveBeenNthCalledWith(
      1,
      { partySize: 4, customerName: '김고객', phoneLastFour: '1278' },
      '11111111-1111-4111-8111-111111111111',
    )
    expect(api.registerKioskEntryQueue).toHaveBeenNthCalledWith(
      2,
      { partySize: 4, customerName: '김고객', phoneLastFour: '1278' },
      '11111111-1111-4111-8111-111111111111',
    )
    expect(queue.customerName.value).toBe('')
    expect(queue.phoneLastFour.value).toBe('')
  })

  it('blocks duplicate success submission and rotates the key only for another party', async () => {
    api.registerKioskEntryQueue.mockImplementation(async ({ partySize }) => ({
      ...entry,
      partySize,
    }))
    const queue = useKioskEntryRegistration()
    queue.partySize.value = 2
    queue.customerName.value = '박고객'
    queue.phoneLastFour.value = '3412'
    await queue.submit()
    await queue.submit()
    queue.beginAnother()
    queue.partySize.value = 3
    queue.customerName.value = '이고객'
    queue.phoneLastFour.value = '5678'
    await queue.submit()

    expect(api.registerKioskEntryQueue).toHaveBeenCalledTimes(2)
    expect(api.registerKioskEntryQueue).toHaveBeenLastCalledWith(
      { partySize: 3, customerName: '이고객', phoneLastFour: '5678' },
      '22222222-2222-4222-8222-222222222222',
    )
    expect(queue.registeredEntry.value?.partySize).toBe(3)
  })

  it('accepts only the Backend party-size and minimum contact-data constraints', () => {
    const queue = useKioskEntryRegistration()

    queue.customerName.value = '김고객'
    queue.phoneLastFour.value = '1278'
    queue.partySize.value = 0
    expect(queue.valid.value).toBe(false)
    queue.partySize.value = 100
    expect(queue.valid.value).toBe(true)
    queue.partySize.value = 101
    expect(queue.valid.value).toBe(false)
    queue.partySize.value = 2
    queue.customerName.value = '   '
    expect(queue.valid.value).toBe(false)
    queue.customerName.value = '김\n고객'
    expect(queue.valid.value).toBe(false)
    queue.customerName.value = '김고객'
    queue.phoneLastFour.value = '123'
    expect(queue.valid.value).toBe(false)
    queue.phoneLastFour.value = '12a4'
    expect(queue.valid.value).toBe(false)
    queue.phoneLastFour.value = '1234'
    expect(queue.valid.value).toBe(true)
    queue.customerName.value = '가'.repeat(41)
    expect(queue.valid.value).toBe(false)
    queue.customerName.value = '😀'.repeat(40)
    expect(queue.valid.value).toBe(true)
  })
})
