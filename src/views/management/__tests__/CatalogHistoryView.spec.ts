import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CatalogHistoryView from '../CatalogHistoryView.vue'
import { getCatalogHistory } from '@/api/catalog'
import type { CatalogHistoryEntry } from '@/types/catalog'

vi.mock('@/api/catalog', () => ({
  getCatalogHistory: vi.fn<typeof getCatalogHistory>(),
}))

const entry: CatalogHistoryEntry = {
  auditId: 'audit-1',
  action: 'CATEGORY_CREATED',
  actorType: 'ACCOUNT',
  actorId: 'account-1',
  actorRoleSnapshot: 'MANAGER',
  targetType: 'CATEGORY',
  targetId: 'cat-1',
  occurredAt: '2026-08-01T00:00:00Z',
  requestId: 'req-1',
  beforeValue: null,
  afterValue: { name: '커피', version: 0 },
}

describe('CatalogHistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads history on mount and renders each entry', async () => {
    vi.mocked(getCatalogHistory).mockResolvedValue({ items: [entry], nextCursor: null })

    const wrapper = mount(CatalogHistoryView)
    await flushPromises()

    expect(getCatalogHistory).toHaveBeenCalledWith({})
    expect(wrapper.text()).toContain('CATEGORY_CREATED')
    expect(wrapper.text()).toContain('MANAGER')
    expect(wrapper.find('.load-more').exists()).toBe(false)
  })

  it('re-queries with the selected filters', async () => {
    vi.mocked(getCatalogHistory).mockResolvedValue({ items: [], nextCursor: null })

    const wrapper = mount(CatalogHistoryView)
    await flushPromises()

    await wrapper.get('#target-type-filter').setValue('CATEGORY')
    await wrapper.get('#action-filter').setValue('CATEGORY_CREATED')
    await wrapper.get('.filter-form').trigger('submit')
    await flushPromises()

    expect(getCatalogHistory).toHaveBeenLastCalledWith({ targetType: 'CATEGORY', action: 'CATEGORY_CREATED' })
  })

  it('loads more entries using the returned cursor and appends them', async () => {
    vi.mocked(getCatalogHistory).mockResolvedValueOnce({ items: [entry], nextCursor: 'cursor-1' })
    const wrapper = mount(CatalogHistoryView)
    await flushPromises()

    vi.mocked(getCatalogHistory).mockResolvedValueOnce({
      items: [{ ...entry, auditId: 'audit-2', action: 'CATEGORY_UPDATED' }],
      nextCursor: null,
    })
    await wrapper.get('.load-more').trigger('click')
    await flushPromises()

    expect(getCatalogHistory).toHaveBeenLastCalledWith({ cursor: 'cursor-1' })
    expect(wrapper.text()).toContain('CATEGORY_CREATED')
    expect(wrapper.text()).toContain('CATEGORY_UPDATED')
    expect(wrapper.find('.load-more').exists()).toBe(false)
  })

  it('shows an error message when the request fails', async () => {
    const { ApiError } = await import('@/api/http')
    vi.mocked(getCatalogHistory).mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', detail: '권한이 없습니다.', requestId: 'r-1', fieldErrors: [] }),
    )

    const wrapper = mount(CatalogHistoryView)
    await flushPromises()

    expect(wrapper.text()).toContain('권한이 없습니다.')
  })
})
