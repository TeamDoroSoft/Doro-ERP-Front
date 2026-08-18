import { describe, expect, it } from 'vitest'
import { useOrderDraft } from '@/composables/useOrderDraft'

const product = {
  productId: '11111111-1111-1111-1111-111111111111',
  name: '아메리카노',
  price: '4500',
}

describe('useOrderDraft', () => {
  it('removes a table from takeout payloads and requires one for dine-in', () => {
    const draft = useOrderDraft(() => 'key-1')
    draft.setServiceType('DINE_IN')
    draft.addProduct(product)
    expect(draft.payload()).toBeUndefined()
    draft.tableId.value = 'table-1'
    expect(draft.payload()).toEqual({
      orderChannel: 'POS',
      serviceType: 'DINE_IN',
      tableId: 'table-1',
      lines: [{ productId: product.productId, quantity: 1 }],
    })
    draft.setServiceType('TAKEOUT')
    expect(draft.payload()).toEqual({
      orderChannel: 'POS',
      serviceType: 'TAKEOUT',
      lines: [{ productId: product.productId, quantity: 1 }],
    })
  })

  it('adds, decrements, and removes menu quantities while calculating an estimate', () => {
    const draft = useOrderDraft(() => 'key-1')
    draft.addProduct(product)
    draft.addProduct(product)
    expect(draft.lines.value[0]?.quantity).toBe(2)
    expect(draft.estimatedTotal.value).toBe('9000')
    draft.decrementProduct(product.productId)
    expect(draft.lines.value[0]?.quantity).toBe(1)
    draft.decrementProduct(product.productId)
    expect(draft.lines.value).toEqual([])
  })

  it('sums an int64 estimate beyond Number.MAX_SAFE_INTEGER without losing precision', () => {
    const draft = useOrderDraft(() => 'key-1')
    draft.addProduct({ ...product, price: '9007199254740993' })
    expect(draft.estimatedTotal.value).toBe('9007199254740993')
    draft.addProduct({ ...product, price: '9007199254740993' })
    expect(draft.estimatedTotal.value).toBe('18014398509481986')
  })

  it('keeps the operation key for retry and replaces it only for a changed or new draft', () => {
    let sequence = 0
    const draft = useOrderDraft(() => `key-${++sequence}`)
    expect(draft.idempotencyKey.value).toBe('key-1')
    expect(draft.idempotencyKey.value).toBe('key-1')
    draft.replaceAfterPayloadChange()
    expect(draft.idempotencyKey.value).toBe('key-2')
    draft.startNewDraft()
    expect(draft.idempotencyKey.value).toBe('key-3')
    expect(draft.lines.value).toEqual([])
  })
})
