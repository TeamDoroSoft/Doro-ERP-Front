import { computed, ref } from 'vue'
import { multiplyInt64, sumInt64, type Int64String } from '@/api/int64'

export type OrderServiceType = 'DINE_IN' | 'TAKEOUT'
export type OrderPaymentPolicy = 'PAY_NOW' | 'PAY_LATER'
export interface DraftProduct {
  productId: string
  name: string
  price: Int64String
}
export interface OrderDraftLine extends DraftProduct {
  quantity: number
}
export interface CreateOrderPayload {
  orderChannel: 'POS'
  serviceType: OrderServiceType
  paymentPolicy: OrderPaymentPolicy
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
  const paymentPolicy = ref<OrderPaymentPolicy>('PAY_NOW')
  const tableId = ref<string>()
  const lines = ref<OrderDraftLine[]>([])
  const idempotencyKey = ref(createKey())
  const estimatedTotal = computed(() =>
    sumInt64(lines.value.map((line) => multiplyInt64(line.price, line.quantity))),
  )

  function setServiceType(next: OrderServiceType) {
    serviceType.value = next
    if (next === 'TAKEOUT') {
      tableId.value = undefined
      paymentPolicy.value = 'PAY_NOW'
    }
  }
  function setPaymentPolicy(next: OrderPaymentPolicy) {
    paymentPolicy.value = serviceType.value === 'TAKEOUT' ? 'PAY_NOW' : next
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
      errors.tableId = '매장에서 식사하는 주문은 테이블을 선택해 주세요.'
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
      paymentPolicy: paymentPolicy.value,
      ...(serviceType.value === 'DINE_IN' ? { tableId: tableId.value } : {}),
      lines: lines.value.map(({ productId, quantity }) => ({ productId, quantity })),
    }
  }
  function startNewDraft() {
    serviceType.value = 'TAKEOUT'
    paymentPolicy.value = 'PAY_NOW'
    tableId.value = undefined
    lines.value = []
    idempotencyKey.value = createKey()
  }
  function clearLinesForAdditionalOrder() {
    lines.value = []
    idempotencyKey.value = createKey()
  }
  function replaceAfterPayloadChange() {
    idempotencyKey.value = createKey()
  }
  return {
    serviceType,
    paymentPolicy,
    tableId,
    lines,
    idempotencyKey,
    estimatedTotal,
    setServiceType,
    setPaymentPolicy,
    addProduct,
    decrementProduct,
    removeProduct,
    validate,
    payload,
    startNewDraft,
    clearLinesForAdditionalOrder,
    replaceAfterPayloadChange,
  }
}
