<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createKioskOrder } from '@/api/kiosk'
import { createPayment } from '@/api/payment'
import { createPaymentHandoff, type PaymentHandoff } from '@/api/paymentHandoff'
import KioskOrderHandoffGuide from '@/components/kiosk/KioskOrderHandoffGuide.vue'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskFlowStore } from '@/stores/kioskFlow'
import { useKioskRuntimeStore } from '@/stores/kioskRuntime'
const cart = useKioskCartStore(),
  flow = useKioskFlowStore(),
  runtime = useKioskRuntimeStore(),
  router = useRouter(),
  serviceType = ref<'DINE_IN' | 'TAKEOUT'>('TAKEOUT'),
  handoff = ref<PaymentHandoff | null>(null),
  busy = ref(false),
  error = ref(''),
  valid = computed(() => cart.lines.length > 0),
  draftLocked = computed(() => !!flow.order)
onMounted(() => {
  if (!cart.lines.length) router.replace('/kiosk/cart')
})
async function submit() {
  if (!valid.value || busy.value) return
  const paymentDevice = runtime.runtime?.pairedPaymentDevice
  if (runtime.runtime?.mode !== 'ORDER' || !paymentDevice) {
    error.value = '연결된 결제 Kiosk가 없습니다. 직원을 호출해 주세요.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    flow.order ??= await createKioskOrder(
      {
        orderChannel: 'KIOSK',
        serviceType: serviceType.value,
        paymentPolicy: 'PAY_NOW',
        lines: cart.lines.map((x) => ({ productId: x.productId, quantity: x.quantity })),
      },
      flow.orderKey,
    )
    flow.payment ??= await createPayment(flow.order.orderId, flow.paymentCreateKey, 'kiosk')
    handoff.value = await createPaymentHandoff(
      flow.payment.id,
      paymentDevice.id,
      flow.handoffCreateKey,
      'kiosk',
    )
  } catch {
    error.value = '주문 처리를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.'
  } finally {
    busy.value = false
  }
}
async function beginAnother() {
  flow.beginNewDraft()
  handoff.value = null
  await router.replace('/kiosk/order')
}
</script>
<template>
  <section v-if="handoff && flow.order" class="checkout-page handoff-result">
    <KioskOrderHandoffGuide
      :order-display-number="flow.order.displayNumber"
      :payment-device-name="handoff.targetPaymentDeviceName"
      :display-code="handoff.displayCode"
    />
    <button type="button" class="another" @click="beginAnother">새 주문 시작</button>
  </section>
  <section v-else class="checkout-page">
    <header class="page-heading">
      <p>이용 방법</p>
      <h1>어떻게 이용하시나요?</h1>
    </header>
    <div class="types" role="radiogroup" aria-label="이용 방법">
      <label
        ><input
          v-model="serviceType"
          type="radio"
          value="DINE_IN"
          :disabled="draftLocked"
        /><strong>매장에서 먹기</strong><span>매장에서 이용합니다</span></label
      ><label
        ><input
          v-model="serviceType"
          type="radio"
          value="TAKEOUT"
          :disabled="draftLocked"
        /><strong>포장하기</strong><span>포장 주문으로 준비합니다</span></label
      >
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <footer>
      <RouterLink v-if="!draftLocked" to="/kiosk/cart">이전</RouterLink
      ><button :disabled="!valid || busy" @click="submit">
        {{ busy ? '주문 처리 중…' : draftLocked ? '같은 요청으로 다시 확인' : '주문하고 결제하기' }}
      </button>
    </footer>
  </section>
</template>
<style scoped>
.checkout-page { max-width: 900px; margin: 0 auto; }.page-heading { margin-bottom: 26px; }.page-heading p { margin: 0 0 5px; color: #087f5b; font-size: 14px; font-weight: 800; }.page-heading h1 { margin: 0; font-size: 34px; letter-spacing: -1px; }.page-heading span { display: block; margin-top: 8px; color: #6b7280; font-size: 14px; }
.types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 28px 0;
}
.types label {
  display: grid; position: relative;
  min-height: 132px;
  align-content: center;
  gap: 6px;
  border: 1px solid #d4dad6;
  border-radius: 6px;
  background: #fff;
  padding: 24px;
}
.types label:has(input:checked) {
  border: 2px solid #087f5b;
  background: #f5faf7;
}
.types input {
  position: absolute;
  opacity: 0;
}
.types strong { font-size: 22px; }
.types span {
  color: #68766f;
}
.error {
  border: 1px solid #f1c4bd; border-radius: 4px; background: #fff6f4; padding: 14px; color: #a13b32;
  color: #b42318;
}
footer { position: sticky; bottom: 0; display: flex; justify-content: flex-end; gap: 12px; margin-top: 28px; border-top: 1px solid #d9ddda; background: #f3f4f3; padding: 18px 0; }
footer a,
footer button {
  display: grid;
  min-width: 170px;
  min-height: 58px;
  place-items: center;
  border: 0;
  border: 1px solid #d1d7d3;
  border-radius: 4px;
  background: #fff;
  color: #17211d;
  font-weight: 900;
}
footer button {
  border-color: #087f5b; background: #087f5b;
  color: #fff;
}
button:disabled {
  opacity: 0.45;
}
.handoff-result { display: grid; justify-items: center; }
.another { min-height: 52px; margin-top: 22px; border: 1px solid #087f5b; border-radius: 5px; background: #fff; padding: 0 24px; color: #087f5b; font-weight: 800; }
@media (max-width: 600px) {
  .types {
    grid-template-columns: 1fr;
  }
  footer {
    flex-direction: column;
  }
}
</style>
