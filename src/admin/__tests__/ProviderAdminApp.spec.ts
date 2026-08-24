import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProviderAdminApp from '@/admin/ProviderAdminApp.vue'

describe('ProviderAdminApp', () => {
  it('renders fixture-backed tenant administration without an API client', async () => {
    const wrapper = mount(ProviderAdminApp)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('업체')
    expect(wrapper.text()).not.toContain('화면 상태 확인')
    expect(wrapper.text()).not.toContain('개발용 미리보기')
    expect(wrapper.text()).toContain('도로운영 강남점')
    expect(wrapper.text()).toContain('점주 등록 실패')
    expect(wrapper.findAll('.admin-nav button')).toHaveLength(1)
    expect(wrapper.get('.admin-nav button').text()).toContain('업체 관리')
    expect(wrapper.text()).not.toContain('개설 및 상태')
    expect(wrapper.text()).not.toContain('계정 및 권한')
    expect(wrapper.text()).not.toContain('운영 변경 내역')
    expect(wrapper.find('.header-help').exists()).toBe(false)

    await wrapper.get('[data-test="new-tenant"]').trigger('click')
    expect(wrapper.get('h1').text()).toBe('업체 등록')
    expect(wrapper.text()).toContain('업체와 매장 등록')
    expect(wrapper.findAll('input')).toHaveLength(3)
    expect(wrapper.text()).toContain('업체명')
    expect(wrapper.text()).toContain('업체 코드')
    expect(wrapper.text()).not.toContain('영문명')
  })

  it('keeps first-store and first-owner work inside the tenant flow', async () => {
    const wrapper = mount(ProviderAdminApp)
    await flushPromises()

    await wrapper.get('[data-test="new-tenant"]').trigger('click')
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('새봄 카페')
    await inputs[1]!.setValue('saebom-cafe')
    await inputs[2]!.setValue('성수 본점')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('업체와 첫 매장을 등록했습니다.')
    await wrapper.get('.success-panel .primary').trigger('click')
    expect(wrapper.get('h1').text()).toBe('새봄 카페')
    expect(wrapper.text()).toContain('첫 매장 정보')
    expect(wrapper.text()).toContain('성수 본점')
    expect(wrapper.text()).toContain('점주 등록 필요')

    await wrapper.get('.owner-panel .primary').trigger('click')
    expect(wrapper.text()).toContain('최초 점주 계정이 등록되었습니다.')
    expect(wrapper.text()).toContain('점주 등록 완료')
  })
})
