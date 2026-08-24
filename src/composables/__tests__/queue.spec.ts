import { effectScope, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import type { EntryQueueView, FulfillmentQueueView } from '@/api/queue'
import { useBoundedPolling } from '@/composables/useBoundedPolling'
import { useEntryQueue, type EntryQueueApi } from '@/composables/useEntryQueue'
import { useFulfillmentQueue, type FulfillmentQueueApi } from '@/composables/useFulfillmentQueue'

const waiting: EntryQueueView = { entryId: 'entry-1', businessDate: '2026-08-18', queueNumber: 1, partySize: 2, status: 'WAITING', version: '0' }
const preparing: FulfillmentQueueView = { fulfillmentId: 'fulfillment-1', orderId: 'order-1', displayNumber: 7, status: 'PREPARING', version: '0' }

describe('queue composables', () => {
  afterEach(() => vi.useRealTimers())

  it('validates registration, retains its key on retry, and clears it after success', async () => {
    const register = vi.fn<EntryQueueApi['register']>().mockRejectedValueOnce(new ApiError(0)).mockResolvedValue(waiting)
    const list = vi.fn<EntryQueueApi['list']>().mockResolvedValue([waiting])
    const model = inScope(() =>
      useEntryQueue({ list, register, transition: vi.fn<EntryQueueApi['transition']>() }),
    )
    await model.register(0)
    expect(model.validationMessage.value).toContain('영업일')
    model.businessDate.value = '2026-08-18'
    await model.register(0)
    expect(model.validationMessage.value).toContain('1명부터 100명')
    await model.register(2)
    await model.register(2)
    expect(register).toHaveBeenCalledTimes(2)
    expect(register.mock.calls[0]?.[1]).toBe(register.mock.calls[1]?.[1])
    expect(model.entries.value).toEqual([waiting])
  })

  it('allows actions only for WAITING and refreshes after a conflict', async () => {
    const list = vi.fn<EntryQueueApi['list']>().mockResolvedValue([{ ...waiting, status: 'ENTERED' }])
    const transition = vi.fn<EntryQueueApi['transition']>().mockRejectedValue(new ApiError(409))
    const model = inScope(() =>
      useEntryQueue({ list, register: vi.fn<EntryQueueApi['register']>(), transition }),
    )
    model.businessDate.value = waiting.businessDate
    await Promise.all([model.act(waiting, 'enter'), model.act(waiting, 'cancel')])
    expect(list).toHaveBeenCalledOnce()
    await model.act({ ...waiting, status: 'ENTERED' }, 'cancel')
    expect(transition).toHaveBeenCalledOnce()
    expect(model.errorMessage.value).toContain('최신 목록')
  })

  it('permits READY only from PREPARING and never creates fulfillment entries', async () => {
    const ready = vi.fn<FulfillmentQueueApi['ready']>().mockResolvedValue({ ...preparing, status: 'READY' })
    const list = vi.fn<FulfillmentQueueApi['list']>().mockResolvedValue([{ ...preparing, status: 'READY' }])
    const model = inScope(() => useFulfillmentQueue({ list, ready }))
    await model.ready(preparing)
    await model.ready({ ...preparing, status: 'READY' })
    await model.ready({ ...preparing, status: 'CANCELLED' })
    expect(ready).toHaveBeenCalledOnce()
    expect(model.fulfillments.value[0]?.status).toBe('READY')
  })

  it('names the unavailable list per screen when the Queue service answers 503', async () => {
    const entry = inScope(() =>
      useEntryQueue({
        list: vi.fn<EntryQueueApi['list']>().mockRejectedValue(new ApiError(503)),
        register: vi.fn<EntryQueueApi['register']>(),
        transition: vi.fn<EntryQueueApi['transition']>(),
      }),
    )
    entry.businessDate.value = waiting.businessDate
    await entry.load()
    expect(entry.errorMessage.value).toBe('입장 대기 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')

    const fulfillment = inScope(() =>
      useFulfillmentQueue({
        list: vi.fn<FulfillmentQueueApi['list']>().mockRejectedValue(new ApiError(503)),
        ready: vi.fn<FulfillmentQueueApi['ready']>(),
      }),
    )
    await fulfillment.load()
    expect(fulfillment.errorMessage.value).toBe('조리 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('bounds polling and clears its timer with the owning scope', async () => {
    vi.useFakeTimers()
    const callback = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const scope = effectScope()
    const polling = scope.run(() => useBoundedPolling(callback, 10, 2))!
    polling.start()
    await vi.advanceTimersByTimeAsync(30)
    expect(callback).toHaveBeenCalledTimes(2)
    scope.stop()
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
  })
})

function inScope<T>(factory: () => T): T {
  return effectScope().run(factory)!
}
