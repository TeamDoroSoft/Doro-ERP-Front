import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DevPosPreviewEntry from '@/components/dev/DevPosPreviewEntry.vue'

describe('DevPosPreviewEntry', () => {
  it('renders the preview action and emits a click', async () => {
    const wrapper = mount(DevPosPreviewEntry)
    const button = wrapper.get('button')

    expect(button.text()).toBe('POS 화면 미리보기')
    await button.trigger('click')
    expect(wrapper.emitted('preview')).toHaveLength(1)
  })
})
