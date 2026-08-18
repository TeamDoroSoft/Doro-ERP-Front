import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SalesClosingView from '@/views/SalesClosingView.vue'
import StoreSettingsView from '@/views/StoreSettingsView.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'
beforeEach(() => {
  sessionStorage.clear()
  setActivePinia(createPinia())
  useOperatorSessionStore().setRole('MANAGER')
  vi.restoreAllMocks()
})
describe('Phase 06 management views', () => {
  it('requires an explicit business date and never guesses one', () => {
    const wrapper = mount(SalesClosingView)
    expect(wrapper.get('h1').text()).toBe('일별 매출과 마감')
    expect((wrapper.get('input[type=date]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('조회할 영업일을 선택하세요')
  })
  it('loads store and employees from their real endpoints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              input.endsWith('/store')
                ? {
                    id: 's1',
                    tenantId: 't1',
                    name: '도로',
                    timezone: 'Asia/Seoul',
                    currency: 'KRW',
                    status: 'ACTIVE',
                  }
                : [],
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )
    const wrapper = mount(StoreSettingsView)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('매장·직원 설정')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('도로')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
