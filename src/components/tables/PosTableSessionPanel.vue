<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PaymentKioskCandidate } from '@/api/paymentKioskCandidates'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import { formatCurrencyInt64 } from '@/api/int64'
import {
  checkoutTableSession,
  getTableSession,
  type TableSession,
  type TableSessionCheckoutHandoff,
} from '@/api/tableSessions'
import { displayLabel } from '@/ui/displayLabels'

const props = defineProps<{ session: TableSession; paymentDevices: PaymentKioskCandidate[] }>()
const emit = defineEmits<{ updated: [session: TableSession] }>()
const selectedDeviceId = ref('')
const loading = ref(false)
const errorMessage = ref('')
const notice = ref('')
const handoff = ref<TableSessionCheckoutHandoff | null>(null)
const canCheckout = computed(
  () =>
    props.session.status === 'OPEN' && props.session.unpaidTotal !== '0' && selectedDeviceId.value,
)

async function refresh() {
  loading.value = true
  errorMessage.value = ''
  try {
    emit('updated', await getTableSession(props.session.sessionId))
  } catch (error) {
    errorMessage.value = safeApiErrorMessage(error, '테이블 주문을 새로고침하지 못했습니다.')
  } finally {
    loading.value = false
  }
}

async function checkout() {
  if (!canCheckout.value || loading.value) return
  loading.value = true
  errorMessage.value = ''
  notice.value = ''
  try {
    handoff.value = await checkoutTableSession(props.session.sessionId, selectedDeviceId.value)
    const latest = await getTableSession(props.session.sessionId)
    emit('updated', latest)
    notice.value = `${handoff.value.targetPaymentDeviceName}에서 결제코드 ${handoff.value.displayCode}를 확인해 주세요.`
  } catch (error) {
    // A conflict can mean another employee changed the lock; a 503 is deliberately ambiguous.
    if (error instanceof ApiError && (error.status === 409 || error.status === 503)) {
      try {
        emit('updated', await getTableSession(props.session.sessionId))
      } catch {
        // Preserve the original safe operation error when recovery lookup also fails.
      }
    }
    errorMessage.value = tableCheckoutMessage(error)
  } finally {
    loading.value = false
  }
}

function tableCheckoutMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 409)
    return '다른 직원이 테이블을 변경했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.'
  if (error instanceof ApiError && error.status === 503)
    return '결제 요청 결과를 확인하고 있습니다. 새 결제를 만들지 말고 현재 상태를 새로고침해 주세요.'
  return safeApiErrorMessage(error, '테이블 합산 결제를 시작하지 못했습니다.')
}
</script>

<template>
  <section class="table-session" aria-labelledby="table-session-title">
    <div class="heading">
      <div>
        <p>테이블 세션</p>
        <h2 id="table-session-title">후불 주문 합계</h2>
      </div>
      <button type="button" :disabled="loading" @click="refresh">새로고침</button>
    </div>
    <dl>
      <div>
        <dt>상태</dt>
        <dd>{{ displayLabel(session.status) }}</dd>
      </div>
      <div>
        <dt>서버 미결제 합계</dt>
        <dd>{{ formatCurrencyInt64(session.unpaidTotal, 'KRW') }}</dd>
      </div>
    </dl>
    <p v-if="session.status === 'CHECKOUT_PENDING'" class="lock-notice">
      합산 결제가 진행 중이라 추가 주문이 잠겨 있습니다.
    </p>
    <ul v-if="session.orders.length">
      <li v-for="order in session.orders" :key="order.orderId">
        <span><strong>주문 #{{ order.displayNumber }}</strong><small>{{ order.itemSummary }}</small></span>
        <span>{{ formatCurrencyInt64(order.amount, 'KRW') }}</span>
        <span>{{ displayLabel(order.paymentStatus) }}</span>
      </li>
    </ul>
    <p v-else>아직 연결된 주문이 없습니다.</p>
    <div v-if="session.status === 'OPEN'" class="checkout-controls">
      <label for="table-payment-device">합산 결제 Kiosk</label>
      <select id="table-payment-device" v-model="selectedDeviceId" :disabled="loading">
        <option value="">결제 Kiosk 선택</option>
        <option
          v-for="device in paymentDevices"
          :key="device.deviceId"
          :value="device.deviceId"
        >
          {{ device.displayName }}
        </option>
      </select>
      <button type="button" :disabled="!canCheckout || loading" @click="checkout">
        {{ loading ? '처리 중…' : '합산 결제' }}
      </button>
    </div>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
  </section>
</template>

<style scoped>
.table-session {
  display: grid;
  gap: 0.85rem;
  border: 1px solid var(--color-border);
  background: #fff;
  padding: 1rem;
}
.heading,
.heading > div,
dl,
dl div,
.checkout-controls,
li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
li > span:first-child { display: grid; gap: .2rem; }
li small { color: var(--color-muted); }
.heading {
  justify-content: space-between;
}
.heading p,
.heading h2,
dl,
dd {
  margin: 0;
}
.heading p {
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}
.heading h2 {
  font-size: 1.05rem;
}
dl {
  flex-wrap: wrap;
}
dl div {
  gap: 0.35rem;
}
dt {
  color: var(--color-muted);
}
dd {
  font-weight: 700;
}
ul {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  justify-content: space-between;
  border-top: 1px solid var(--color-border);
  padding-top: 0.5rem;
}
.checkout-controls {
  flex-wrap: wrap;
}
.checkout-controls label {
  font-weight: 700;
}
select,
button {
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-background);
  padding: 0.55rem;
}
.notice,
.lock-notice {
  margin: 0;
  color: #17633b;
}
.error {
  margin: 0;
  color: #a32d2d;
}
</style>
