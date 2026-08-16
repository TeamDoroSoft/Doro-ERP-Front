import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DevAdminPreviewEntry from '@/components/dev/DevAdminPreviewEntry.vue'

describe('DevAdminPreviewEntry', () => {
  it('renders the preview action and emits a click', async () => {
    const wrapper = mount(DevAdminPreviewEntry)
    const button = wrapper.get('button')

    expect(button.text()).toBe('관리자 화면 미리보기')
    await button.trigger('click')
    expect(wrapper.emitted('preview')).toHaveLength(1)
  })
})
