import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProviderAdminApp from '@/admin/ProviderAdminApp.vue'

describe('ProviderAdminApp', () => {
  it('renders fixture-backed tenant administration without an API client', async () => {
    const wrapper = mount(ProviderAdminApp)

    expect(wrapper.get('h1').text()).toBe('업체 목록')
    expect(wrapper.text()).toContain('개발용 미리보기')
    expect(wrapper.text()).toContain('도로운영 강남점')
    expect(wrapper.text()).toContain('등록 실패')

    await wrapper.get('[data-test="new-tenant"]').trigger('click')
    expect(wrapper.get('h1').text()).toBe('신규 업체 등록')
    expect(wrapper.text()).toContain('업체 및 매장 등록')
  })
})
