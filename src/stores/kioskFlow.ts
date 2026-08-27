import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { KioskCreatedOrder } from '@/api/kiosk'
import type { PaymentView } from '@/api/payment'
import {
  clearKioskPaymentFlow,
  readKioskPaymentFlow,
  saveKioskPaymentFlow,
} from '@/payments/kioskPaymentFlow'
import { useKioskCartStore } from './kioskCart'
export const useKioskFlowStore = defineStore('kioskFlow', () => {
  const restored = readKioskPaymentFlow(),
    order = ref<KioskCreatedOrder | null>(restored?.order ?? null),
    payment = ref<PaymentView | null>(restored?.payment ?? null),
    flowCreatedAt = ref(restored?.createdAt ?? Date.now()),
    orderKey = ref(crypto.randomUUID()),
    paymentCreateKey = ref(crypto.randomUUID()),
    paymentConfirmKey = ref(restored?.confirmIdempotencyKey ?? crypto.randomUUID()),
    approving = ref(false)
  const accessToken = computed(() => order.value?.orderAccessToken ?? '')
  watch([order, payment, paymentConfirmKey], persistPaymentFlow, { flush: 'sync' })

  function persistPaymentFlow(): boolean {
    if (!order.value || !payment.value) {
      clearKioskPaymentFlow()
      return false
    }
    const saved = saveKioskPaymentFlow({
      order: order.value,
      payment: payment.value,
      confirmIdempotencyKey: paymentConfirmKey.value,
      createdAt: flowCreatedAt.value,
    })
    if (!saved) clearKioskPaymentFlow()
    return saved
  }
  function beginNewDraft() {
    useKioskCartStore().clear()
    order.value = null
    payment.value = null
    orderKey.value = crypto.randomUUID()
    paymentCreateKey.value = crypto.randomUUID()
    paymentConfirmKey.value = crypto.randomUUID()
    flowCreatedAt.value = Date.now()
    approving.value = false
    clearKioskPaymentFlow()
  }
  function resetCustomer() {
    beginNewDraft()
  }
  return {
    order,
    payment,
    orderKey,
    paymentCreateKey,
    paymentConfirmKey,
    approving,
    accessToken,
    persistPaymentFlow,
    beginNewDraft,
    resetCustomer,
  }
})
