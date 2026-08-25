import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'

describe('ApiErrorNotice', () => {
  it('keeps the accessible alert and renders selectable support metadata', () => {
    const wrapper = mount(ApiErrorNotice, { props: { message: '다시 시도해 주세요.', code: 'COMMERCE_UNAVAILABLE', requestId: 'req-123' } })
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('COMMERCE_UNAVAILABLE')
    expect(wrapper.text()).toContain('req-123')
    expect(wrapper.find('.support-meta').exists()).toBe(true)
  })
})
