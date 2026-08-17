import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderDetailPanel from '@/components/orders/OrderDetailPanel.vue'
import OrderListPanel from '@/components/orders/OrderListPanel.vue'

const order = {
  orderId: 'order-1',
  displayNumber: 42,
  totalAmount: '12000',
  currency: 'KRW',
  status: 'CREATED' as const,
  businessDate: '2026-08-17',
}

describe('order query and detail panels', () => {
  it('shows only actual summary fields and opens the selected order', async () => {
    const wrapper = mount(OrderListPanel, { props: { orders: [order] } })

    expect(wrapper.text()).toContain('#42')
    expect(wrapper.text()).toContain('12,000 KRW')
    expect(wrapper.text()).toContain('주문 생성')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['order-1']])
  })

  it('does not invent unavailable line, table, service-type, or ready fields', () => {
    const wrapper = mount(OrderDetailPanel, {
      props: { order, cancelling: false, completing: false },
    })

    expect(wrapper.text()).toContain('주문 요약')
    expect(wrapper.text()).toContain('품목과 테이블 정보는 연동 준비 중입니다.')
    expect(wrapper.text()).not.toContain('테이블:')
    expect(wrapper.text()).not.toContain('준비 완료')
  })

  it('only exposes cancellation for a CREATED order', () => {
    const created = mount(OrderDetailPanel, {
      props: { order, cancelling: false, completing: false },
    })
    const accepted = mount(OrderDetailPanel, {
      props: {
        order: { ...order, status: 'ACCEPTED' as const },
        cancelling: false,
        completing: false,
      },
    })

    expect(created.text()).toContain('주문 취소')
    expect(created.text()).not.toContain('주문 완료')
    expect(accepted.text()).not.toContain('주문 취소')
    expect(accepted.text()).toContain('결제 전액 취소로 처리해야 합니다.')
    expect(accepted.text()).toContain('주문 완료')
  })

  it('emits command requests without optimistically changing the displayed status', async () => {
    const wrapper = mount(OrderDetailPanel, {
      props: {
        order: { ...order, status: 'ACCEPTED' as const },
        cancelling: false,
        completing: false,
      },
    })

    await wrapper.get('button.primary').trigger('click')
    expect(wrapper.emitted('complete')).toEqual([[]])
    expect(wrapper.text()).toContain('주문 접수')
  })
})
