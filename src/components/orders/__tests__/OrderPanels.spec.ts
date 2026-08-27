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
    expect(wrapper.text()).toContain('결제 대기')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['order-1']])
  })

  it('distinguishes the order source device from the payment display device', () => {
    const sourced = {
      ...order,
      sourceType: 'KIOSK' as const,
      sourceDeviceNameSnapshot: '입구 주문 Kiosk 01',
      paymentHandoffDeviceNameSnapshot: '카운터 결제 Kiosk 02',
    }
    const list = mount(OrderListPanel, { props: { orders: [sourced] } })
    const detail = mount(OrderDetailPanel, {
      props: { order: sourced, cancelling: false, completing: false },
    })

    expect(list.text()).toContain('Kiosk · 입구 주문 Kiosk 01')
    expect(detail.text()).toContain('주문 생성')
    expect(detail.text()).toContain('입구 주문 Kiosk 01')
    expect(detail.text()).toContain('결제 QR 표시')
    expect(detail.text()).toContain('카운터 결제 Kiosk 02')
  })

  it('does not invent unavailable line, table, service-type, or ready fields', () => {
    const wrapper = mount(OrderDetailPanel, {
      props: { order, cancelling: false, completing: false },
    })

    expect(wrapper.text()).toContain('주문 요약')
    expect(wrapper.text()).toContain('메뉴와 테이블 정보는 표시되지 않습니다.')
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
    expect(accepted.text()).toContain('결제가 완료된 주문은 먼저 결제를 전액 취소해 주세요.')
    expect(accepted.text()).toContain('조리 현황에서 먼저 ‘준비 완료’를 처리해 주세요.')
    expect(accepted.get('a[href="/pos/queues/fulfillment"]').text()).toBe('조리 현황')
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
    expect(wrapper.text()).toContain('주문 확정')
  })
})
