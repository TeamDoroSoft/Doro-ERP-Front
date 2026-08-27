import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import FulfillmentQueueView from '@/views/FulfillmentQueueView.vue'

const fulfillmentQueue = vi.hoisted(() => ({
  useFulfillmentQueue: vi.fn<() => unknown>(),
}))

vi.mock('@/composables/useFulfillmentQueue', () => fulfillmentQueue)

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
})

function queueState(errorMessage = '') {
  return {
    fulfillments: ref([]),
    loading: ref(false),
    actingId: ref(''),
    errorMessage: ref(errorMessage),
    load: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ready: vi.fn<() => void>(),
    polling: { start: vi.fn<() => void>(), stop: vi.fn<() => void>() },
  }
}
