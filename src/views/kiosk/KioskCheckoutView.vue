<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createKioskOrder, getKioskTables, type KioskTable } from '@/api/kiosk'
import { createPayment } from '@/api/payment'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskFlowStore } from '@/stores/kioskFlow'
const cart = useKioskCartStore(),
  flow = useKioskFlowStore(),
  router = useRouter(),
  serviceType = ref<'DINE_IN' | 'TAKEOUT'>('TAKEOUT'),
  tableId = ref(''),
  tables = ref<KioskTable[]>([]),
  loadingTables = ref(false),
  busy = ref(false),
  error = ref(''),
  valid = computed(
    () => cart.lines.length > 0 && (serviceType.value === 'TAKEOUT' || !!tableId.value),
  )
onMounted(() => {
  if (!cart.lines.length) router.replace('/kiosk/cart')
})
async function selectType(type: 'DINE_IN' | 'TAKEOUT') {
  serviceType.value = type
  if (type === 'TAKEOUT') {
    tableId.value = ''
    return
  }
  loadingTables.value = true
  try {
    tables.value = await getKioskTables()
  } catch {
    error.value = '테이블을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    loadingTables.value = false
  }
}
async function submit() {
  if (!valid.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    flow.order = await createKioskOrder(
      {
        orderChannel: 'KIOSK',
        serviceType: serviceType.value,
        ...(serviceType.value === 'DINE_IN' ? { tableId: tableId.value } : {}),
        lines: cart.lines.map((x) => ({ productId: x.productId, quantity: x.quantity })),
      },
      flow.orderKey,
    )
    if (!flow.order.orderAccessToken) throw new Error('missing access token')
    flow.payment = await createPayment(flow.order.orderId, flow.paymentCreateKey, 'kiosk')
    if (!flow.persistPaymentFlow()) throw new Error('payment recovery unavailable')
    await router.push(`/kiosk/payments/${flow.payment.id}`)
  } catch {
    error.value = '주문을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="checkout-page">
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
          @change="selectType('DINE_IN')"
        /><strong>매장에서 먹기</strong><span>테이블을 선택하고 매장에서 이용합니다</span></label
      ><label
        ><input
          v-model="serviceType"
          type="radio"
          value="TAKEOUT"
          @change="selectType('TAKEOUT')"
        /><strong>포장하기</strong><span>포장 주문으로 준비합니다</span></label
      >
    </div>
    <section v-if="serviceType === 'DINE_IN'" class="tables">
      <h2>테이블을 선택해 주세요</h2>
      <p v-if="loadingTables">테이블을 확인하고 있어요…</p>
      <div>
        <label v-for="table in tables" :key="table.id"
          ><input v-model="tableId" type="radio" :value="table.id" /><span>{{
            table.displayName
          }}</span></label
        >
      </div>
    </section>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <footer>
      <RouterLink to="/kiosk/cart">이전</RouterLink
      ><button :disabled="!valid || busy" @click="submit">
        {{ busy ? '주문 처리 중…' : '주문하고 결제하기' }}
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
.tables {
  border: 1px solid #d9ddda; border-radius: 6px; background: #fff; padding: 22px;
}
.tables h2 { margin: 0 0 16px; font-size: 18px; }
.tables > div {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.tables label {
  min-height: 50px; border: 1px solid #d4dad6; border-radius: 4px; padding: 14px 16px; font-weight: 700;
}
.tables label:has(input:checked) {
  border: 2px solid #087f5b; color: #087f5b;
}
.tables input {
  position: absolute;
  opacity: 0;
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
@media (max-width: 600px) {
  .types {
    grid-template-columns: 1fr;
  }
  footer {
    flex-direction: column;
  }
}
</style>
