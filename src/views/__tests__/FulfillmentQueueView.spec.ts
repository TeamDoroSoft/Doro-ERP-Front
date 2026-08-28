import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import FulfillmentQueueView from '@/views/FulfillmentQueueView.vue'

const fulfillmentQueue = vi.hoisted(() => ({
  useFulfillmentQueue: vi.fn<() => unknown>(),
}))

vi.mock('@/composables/useFulfillmentQueue', () => fulfillmentQueue)
vi.mock('@/composables/useCurrentBusinessDate', () => ({
  useCurrentBusinessDate: () => {
    const businessDate = ref('2026-08-27')
    return { businessDate, loadingBusinessDate: ref(false), businessDateError: ref(''),
      resolveBusinessDate: vi.fn<() => void>(() => { businessDate.value = '2026-08-27' }) }
  },
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
}))

describe('FulfillmentQueueView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show the empty state when loading the queue fails', async () => {
    fulfillmentQueue.useFulfillmentQueue.mockReturnValue(
      queueState('조리 목록을 불러오지 못했습니다.'),
    )

    const wrapper = mount(FulfillmentQueueView)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('조리 목록을 불러오지 못했습니다.')
    expect(wrapper.text()).not.toContain('현재 조리 중인 주문이 없습니다.')
  })

  it('shows the empty state after a successful empty response', async () => {
    fulfillmentQueue.useFulfillmentQueue.mockReturnValue(queueState())

    const wrapper = mount(FulfillmentQueueView)
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('현재 조리 중인 주문이 없습니다.')
    expect(wrapper.text()).not.toContain('입장 대기 보기')
  })

  it('shows the server item summary and a clear legacy-null fallback', async () => {
    fulfillmentQueue.useFulfillmentQueue.mockReturnValue({
      ...queueState(),
      fulfillments: ref([
        fulfillment('fulfillment-1', '아메리카노 × 2'),
        fulfillment('fulfillment-2', null),
      ]),
    })

    const wrapper = mount(FulfillmentQueueView)
    await flushPromises()

    expect(wrapper.text()).toContain('아메리카노 × 2')
    expect(wrapper.text()).toContain('품목 정보 없음')
  })

  it('associates the business-day filter with its label and preserves refresh controls', async () => {
    const state = queueState()
    fulfillmentQueue.useFulfillmentQueue.mockReturnValue(state)

    const wrapper = mount(FulfillmentQueueView)
    await flushPromises()

    const input = wrapper.get('input[name="businessDate"]')
    expect(input.attributes('id')).toBe('fulfillment-business-date')
    expect(wrapper.get('label[for="fulfillment-business-date"]').text()).toBe('영업일')
    expect((input.element as HTMLInputElement).value).toBe('2026-08-27')
    expect(wrapper.text()).toContain('선택한 영업일의 조리 주문을 표시합니다.')

    const refresh = wrapper.get('button')
    expect(refresh.text()).toBe('새로고침')
    expect(refresh.attributes('disabled')).toBeUndefined()
    await refresh.trigger('click')
    expect(state.load).toHaveBeenCalled()
  })

  it('does not start polling after unmount while an initial load is pending', async () => {
    let resolveLoad!: () => void
    const state = queueState()
    state.load = vi.fn<() => Promise<void>>(() => new Promise<void>((resolve) => { resolveLoad = resolve }))
    fulfillmentQueue.useFulfillmentQueue.mockReturnValue(state)
    const wrapper = mount(FulfillmentQueueView)
    expect(state.load).toHaveBeenCalledOnce()
    wrapper.unmount()
    resolveLoad()
    await flushPromises()
    expect(state.polling.start).not.toHaveBeenCalled()
  })
})

function queueState(errorMessage = '') {
  return {
    fulfillments: ref([]),
    businessDate: ref('2026-08-27'),
    loading: ref(false),
    actingId: ref(''),
    errorMessage: ref(errorMessage),
    load: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ready: vi.fn<() => void>(),
    polling: { start: vi.fn<() => void>(), stop: vi.fn<() => void>() },
  }
}

function fulfillment(fulfillmentId: string, itemSummary: string | null) {
  return {
    fulfillmentId,
    orderId: `order-${fulfillmentId}`,
    businessDate: '2026-08-27',
    displayNumber: 17,
    status: 'PREPARING' as const,
    sourceType: 'EMPLOYEE_POS' as const,
    sourceDeviceNameSnapshot: null,
    itemSummary,
    version: '3',
  }
}
