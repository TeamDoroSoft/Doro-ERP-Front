import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { KioskCreatedOrder } from '@/api/kiosk'
import type { PaymentView } from '@/api/payment'
import { clearKioskPaymentFlow } from '@/payments/kioskPaymentFlow'
import { useKioskCartStore } from './kioskCart'
export const useKioskFlowStore = defineStore('kioskFlow', () => {
  clearKioskPaymentFlow()
  const order = ref<KioskCreatedOrder | null>(null),
    payment = ref<PaymentView | null>(null),
    orderKey = ref(crypto.randomUUID()),
    paymentCreateKey = ref(crypto.randomUUID()),
    handoffCreateKey = ref(crypto.randomUUID())
  const accessToken = computed(() => order.value?.orderAccessToken ?? '')
  function beginNewDraft() {
    useKioskCartStore().clear()
    order.value = null
    payment.value = null
    orderKey.value = crypto.randomUUID()
    paymentCreateKey.value = crypto.randomUUID()
    handoffCreateKey.value = crypto.randomUUID()
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
    handoffCreateKey,
    accessToken,
    beginNewDraft,
    resetCustomer,
  }
})
