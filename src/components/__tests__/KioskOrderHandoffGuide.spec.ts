import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KioskOrderHandoffGuide from '@/components/kiosk/KioskOrderHandoffGuide.vue'

describe('KioskOrderHandoffGuide', () => {
  it('shows only customer-facing handoff guidance', () => {
    const wrapper = mount(KioskOrderHandoffGuide, {
      props: {
        orderDisplayNumber: 1052,
        paymentDeviceName: '결제 Kiosk 02',
        displayCode: 'A7K9',
      },
    })

    expect(wrapper.text()).toContain('주문번호 1052')
    expect(wrapper.text()).toContain('결제 Kiosk 02')
    expect(wrapper.text()).toContain('A7K9')
    expect(wrapper.text()).not.toMatch(/ACCEPTED|PREPARING|READY|paymentId|token/)
  })
})
