import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import EntryQueueView from '@/views/EntryQueueView.vue'

const entryQueue = vi.hoisted(() => ({ useEntryQueue: vi.fn<() => unknown>() }))

vi.mock('@/composables/useEntryQueue', () => entryQueue)

describe('EntryQueueView', () => {
  it('renders the server registration timestamp instead of deriving one in the browser', () => {
    entryQueue.useEntryQueue.mockReturnValue({
      entries: ref([
        {
          entryId: 'entry-1',
          businessDate: '2026-08-27',
          queueNumber: 12,
          partySize: 3,
          status: 'WAITING',
          registeredAt: '2026-08-26T08:15:00Z',
          version: '3',
        },
      ]),
      businessDate: ref('2026-08-27'),
      loading: ref(false),
      submitting: ref(false),
      actingId: ref(''),
      errorMessage: ref(''),
      validationMessage: ref(''),
      load: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      register: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      act: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      polling: { start: vi.fn<() => void>(), stop: vi.fn<() => void>() },
    })

    const wrapper = mount(EntryQueueView)

    expect(wrapper.get('time').attributes('datetime')).toBe('2026-08-26T08:15:00Z')
    expect(wrapper.text()).toContain('등록 시각')
  })
})
