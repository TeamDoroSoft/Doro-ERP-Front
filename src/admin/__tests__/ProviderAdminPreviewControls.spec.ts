import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProviderAdminPreviewControls from '@/admin/ProviderAdminPreviewControls.vue'

describe('ProviderAdminPreviewControls', () => {
  it('changes the screen state when loaded by the development build', async () => {
    const wrapper = mount(ProviderAdminPreviewControls, {
      props: { modelValue: 'normal' },
    })

    expect(wrapper.text()).toContain('화면 상태 확인')
    await wrapper.get('select').setValue('empty')
    expect(wrapper.emitted('update:modelValue')).toEqual([['empty']])
  })
})
