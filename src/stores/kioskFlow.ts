import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { KioskCreatedOrder } from '@/api/kiosk'
import type { PaymentView } from '@/api/payment'
import { useKioskCartStore } from './kioskCart'
export const useKioskFlowStore = defineStore('kioskFlow', () => {
  const order = ref<KioskCreatedOrder | null>(null),
    payment = ref<PaymentView | null>(null),
    orderKey = ref(crypto.randomUUID()),
    paymentCreateKey = ref(crypto.randomUUID()),
    paymentConfirmKey = ref(crypto.randomUUID()),
    approving = ref(false)
  const accessToken = computed(() => order.value?.orderAccessToken ?? '')
  function beginNewDraft() {
    useKioskCartStore().clear()
    order.value = null
    payment.value = null
    orderKey.value = crypto.randomUUID()
    paymentCreateKey.value = crypto.randomUUID()
    paymentConfirmKey.value = crypto.randomUUID()
    approving.value = false
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
    beginNewDraft,
    resetCustomer,
  }
})
