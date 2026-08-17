import { computed, ref } from 'vue'

export type OrderServiceType = 'DINE_IN' | 'TAKEOUT'
export interface DraftProduct {
  productId: string
  name: string
  price: number
}
export interface OrderDraftLine extends DraftProduct {
  quantity: number
}
export interface CreateOrderPayload {
  orderChannel: 'POS'
  serviceType: OrderServiceType
  tableId?: string
  lines: Array<{ productId: string; quantity: number }>
}
export interface OrderDraftValidation {
  tableId?: string
  lines?: string
}

const MAX_LINES = 100
const MAX_QUANTITY = 999

export function useOrderDraft(createKey: () => string = () => crypto.randomUUID()) {
  const serviceType = ref<OrderServiceType>('TAKEOUT')
  const tableId = ref<string>()
  const lines = ref<OrderDraftLine[]>([])
  const idempotencyKey = ref(createKey())
  const estimatedTotal = computed(() =>
    lines.value.reduce((total, line) => total + line.price * line.quantity, 0),
  )

  function setServiceType(next: OrderServiceType) {
    serviceType.value = next
    if (next === 'TAKEOUT') tableId.value = undefined
  }
  function addProduct(product: DraftProduct) {
    const existing = lines.value.find((line) => line.productId === product.productId)
    if (existing) {
      if (existing.quantity < MAX_QUANTITY) existing.quantity += 1
      return
    }
    if (lines.value.length < MAX_LINES) lines.value.push({ ...product, quantity: 1 })
  }
  function decrementProduct(productId: string) {
    const index = lines.value.findIndex((line) => line.productId === productId)
    const line = lines.value[index]
    if (!line) return
    if (line.quantity === 1) lines.value.splice(index, 1)
    else line.quantity -= 1
  }
  function removeProduct(productId: string) {
    lines.value = lines.value.filter((line) => line.productId !== productId)
  }
  function validate(): OrderDraftValidation {
    const errors: OrderDraftValidation = {}
    if (serviceType.value === 'DINE_IN' && !tableId.value)
      errors.tableId = '매장 식사는 활성 테이블을 선택해야 합니다.'
    if (lines.value.length === 0) errors.lines = '주문할 메뉴를 한 개 이상 담아 주세요.'
    if (
      lines.value.length > MAX_LINES ||
      lines.value.some((line) => line.quantity < 1 || line.quantity > MAX_QUANTITY)
    )
      errors.lines = '메뉴는 최대 100개, 각 수량은 1~999개까지 주문할 수 있습니다.'
    return errors
  }
  function payload(): CreateOrderPayload | undefined {
    if (Object.keys(validate()).length > 0) return undefined
    return {
      orderChannel: 'POS',
      serviceType: serviceType.value,
      ...(serviceType.value === 'DINE_IN' ? { tableId: tableId.value } : {}),
      lines: lines.value.map(({ productId, quantity }) => ({ productId, quantity })),
    }
  }
  function startNewDraft() {
    serviceType.value = 'TAKEOUT'
    tableId.value = undefined
    lines.value = []
    idempotencyKey.value = createKey()
  }
  function replaceAfterPayloadChange() {
    idempotencyKey.value = createKey()
  }
  return {
    serviceType,
    tableId,
    lines,
    idempotencyKey,
    estimatedTotal,
    setServiceType,
    addProduct,
    decrementProduct,
    removeProduct,
    validate,
    payload,
    startNewDraft,
    replaceAfterPayloadChange,
  }
}
