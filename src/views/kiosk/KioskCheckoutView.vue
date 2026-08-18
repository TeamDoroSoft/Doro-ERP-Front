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
    error.value = '테이블을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.'
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
    await router.push(`/kiosk/payments/${flow.payment.id}`)
  } catch {
    error.value = '주문을 처리하지 못했습니다. 같은 주문으로 다시 시도해주세요.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section>
    <header>
      <p>주문 확인</p>
      <h1>어디에서 드시나요?</h1>
    </header>
    <div class="types">
      <label
        ><input
          v-model="serviceType"
          type="radio"
          value="DINE_IN"
          @change="selectType('DINE_IN')"
        /><strong>매장 이용</strong><span>매장에서 드실게요</span></label
      ><label
        ><input
          v-model="serviceType"
          type="radio"
          value="TAKEOUT"
          @change="selectType('TAKEOUT')"
        /><strong>포장</strong><span>가지고 갈게요</span></label
      >
    </div>
    <section v-if="serviceType === 'DINE_IN'" class="tables">
      <h2>테이블 선택</h2>
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
header p {
  color: #126a5a;
  font-weight: 900;
}
header h1 {
  font-size: 42px;
}
.types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin: 28px 0;
}
.types label {
  display: grid;
  min-height: 150px;
  align-content: center;
  gap: 8px;
  border: 3px solid #ddd6ca;
  border-radius: 28px;
  background: #fff;
  padding: 26px;
}
.types label:has(input:checked) {
  border-color: #126a5a;
  background: #edf7f3;
}
.types input {
  position: absolute;
  opacity: 0;
}
.types strong {
  font-size: 28px;
}
.types span {
  color: #68766f;
}
.tables {
  border-radius: 24px;
  background: #fff;
  padding: 24px;
}
.tables > div {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.tables label {
  min-height: 54px;
  border: 2px solid #ddd6ca;
  border-radius: 16px;
  padding: 15px;
}
.tables label:has(input:checked) {
  border-color: #126a5a;
}
.tables input {
  position: absolute;
  opacity: 0;
}
.error {
  border-radius: 16px;
  background: #fff0ed;
  padding: 16px;
  color: #b42318;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 28px;
}
footer a,
footer button {
  display: grid;
  min-width: 180px;
  min-height: 62px;
  place-items: center;
  border: 0;
  border-radius: 19px;
  background: #fff;
  color: #17211d;
  font-weight: 900;
}
footer button {
  background: #126a5a;
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
