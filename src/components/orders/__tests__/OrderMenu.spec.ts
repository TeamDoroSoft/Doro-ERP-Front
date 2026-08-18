import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderMenu from '@/components/orders/OrderMenu.vue'

describe('OrderMenu', () => {
  it('shows only products supplied by the sales-menu contract and emits additions', async () => {
    const wrapper = mount(OrderMenu, {
      props: {
        categories: [
          {
            categoryId: 'c1',
            name: '커피',
            products: [{ productId: 'p1', name: '아메리카노', description: '', price: '4500' }],
          },
        ],
      },
    })
    expect(wrapper.text()).toContain('아메리카노')
    expect(wrapper.text()).toContain('4,500원')
    expect(wrapper.text()).not.toContain('품절')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('add')?.[0]).toEqual([
      { productId: 'p1', name: '아메리카노', description: '', price: '4500' },
    ])
  })
})
