import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { KioskMenuItem } from '@/api/kiosk'
export interface KioskCartLine {
  productId: string
  name: string
  unitPrice: number
  quantity: number
}
export const useKioskCartStore = defineStore('kioskCart', () => {
  const lines = ref<KioskCartLine[]>([]),
    itemCount = computed(() => lines.value.reduce((sum, x) => sum + x.quantity, 0)),
    estimatedTotal = computed(() =>
      lines.value.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0),
    )
  function addItem(product: KioskMenuItem, quantity = 1) {
    const line = lines.value.find((x) => x.productId === product.productId)
    if (line) line.quantity += quantity
    else
      lines.value.push({
        productId: product.productId,
        name: product.name,
        unitPrice: product.price,
        quantity,
      })
  }
  function setQuantity(id: string, quantity: number) {
    if (quantity < 1) return removeItem(id)
    const line = lines.value.find((x) => x.productId === id)
    if (line) line.quantity = quantity
  }
  function removeItem(id: string) {
    lines.value = lines.value.filter((x) => x.productId !== id)
  }
  function clear() {
    lines.value = []
  }
  return { lines, itemCount, estimatedTotal, addItem, setQuantity, removeItem, clear }
})
