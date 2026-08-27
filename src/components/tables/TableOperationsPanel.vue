<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '@/api/http'
import { assignOrderTable, getOrders, type OrderResponse } from '@/api/order'
import {
  listActivePaymentKioskCandidatesForStaff,
  type PaymentKioskCandidate,
} from '@/api/paymentKioskCandidates'
import { getTables, type TableResponse } from '@/api/table'
import { listActiveTableSessions, type TableSession } from '@/api/tableSessions'
import PosTableSessionPanel from '@/components/tables/PosTableSessionPanel.vue'

const sessions = ref<TableSession[]>([])
const tables = ref<TableResponse[]>([])
const candidates = ref<PaymentKioskCandidate[]>([])
const orders = ref<OrderResponse[]>([])
const assignments = ref<Record<string, string>>({})
const loading = ref(true)
const assigningOrderId = ref('')
const errorMessage = ref('')
const notice = ref('')

const unassignedKioskOrders = computed(() =>
  orders.value.filter(
    (order) =>
      order.sourceType === 'KIOSK' &&
      order.serviceType === 'DINE_IN' &&
      order.tableId === null &&
      order.status !== 'CANCELLED' &&
      order.status !== 'COMPLETED',
  ),
)

onMounted(load)

async function load() {
  if (loading.value && sessions.value.length > 0) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [nextSessions, nextTables, nextCandidates, nextOrders] = await Promise.all([
      listActiveTableSessions(),
      getTables(),
      listActivePaymentKioskCandidatesForStaff(),
      getOrders(),
    ])
    sessions.value = nextSessions
    tables.value = nextTables.filter((table) => table.status === 'ACTIVE')
    candidates.value = nextCandidates
    orders.value = nextOrders
  } catch {
    errorMessage.value = '테이블 운영 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    loading.value = false
  }
}

function updateSession(session: TableSession) {
  const index = sessions.value.findIndex((candidate) => candidate.sessionId === session.sessionId)
  if (session.status === 'CLOSED') {
    if (index >= 0) sessions.value.splice(index, 1)
  } else if (index >= 0) {
    sessions.value[index] = session
  } else {
    sessions.value.push(session)
  }
}

async function assign(order: OrderResponse) {
  const tableId = assignments.value[order.orderId]
  if (!tableId || assigningOrderId.value) {
    if (!tableId) errorMessage.value = '배정할 테이블을 선택해 주세요.'
    return
  }
  assigningOrderId.value = order.orderId
  errorMessage.value = ''
  notice.value = ''
  try {
    await assignOrderTable(order.orderId, tableId)
    notice.value = `주문 #${order.displayNumber}에 테이블을 배정했습니다.`
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      await load()
      errorMessage.value = '다른 직원이 주문이나 테이블을 변경했습니다. 최신 목록을 다시 불러왔습니다.'
    } else if (error instanceof ApiError && error.status === 503) {
      await load()
      errorMessage.value = '배정 결과를 확인할 수 없어 최신 주문 상태를 다시 조회했습니다.'
    } else if (error instanceof ApiError && error.status === 403) {
      errorMessage.value = '테이블을 배정할 권한이 없습니다.'
    } else {
      errorMessage.value = '테이블을 배정하지 못했습니다.'
    }
  } finally {
    assigningOrderId.value = ''
  }
}

function tableName(tableId: string) {
  const table = tables.value.find((candidate) => candidate.id === tableId)
  return table ? `${table.tableNumber} · ${table.displayName}` : '테이블 정보 확인 중'
}
</script>

<template>
  <section class="operations" aria-labelledby="table-operations-title" :aria-busy="loading">
    <div class="heading">
      <div>
        <p>실시간 운영</p>
        <h2 id="table-operations-title">활성 테이블 세션</h2>
        <span>서버가 계산한 주문 요약과 미결제 합계입니다.</span>
      </div>
      <button type="button" :disabled="loading" @click="load">전체 새로고침</button>
    </div>
    <p v-if="loading" role="status">활성 세션과 미배정 주문을 불러오는 중입니다…</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="!loading && sessions.length === 0" class="empty">현재 활성 테이블 세션이 없습니다.</p>
    <div v-else class="session-grid">
      <article v-for="session in sessions" :key="session.sessionId">
        <h3>{{ tableName(session.tableId) }}</h3>
        <PosTableSessionPanel
          :session="session"
          :payment-devices="candidates"
          @updated="updateSession"
        />
      </article>
    </div>

    <div class="unassigned">
      <h3>미배정 Kiosk 매장 주문</h3>
      <p v-if="!loading && unassignedKioskOrders.length === 0" class="empty">
        테이블 배정이 필요한 주문이 없습니다.
      </p>
      <ul v-else>
        <li v-for="order in unassignedKioskOrders" :key="order.orderId">
          <strong>주문 #{{ order.displayNumber }}</strong>
          <span>{{ order.paymentPolicy === 'PAY_LATER' ? '후불' : '즉시 결제' }}</span>
          <select
            v-model="assignments[order.orderId]"
            :disabled="assigningOrderId === order.orderId"
            :aria-label="`주문 ${order.displayNumber} 테이블`"
          >
            <option value="">테이블 선택</option>
            <option v-for="table in tables" :key="table.id" :value="table.id">
              {{ table.tableNumber }} · {{ table.displayName }}
            </option>
          </select>
          <button
            type="button"
            :disabled="assigningOrderId === order.orderId || !assignments[order.orderId]"
            @click="assign(order)"
          >
            {{ assigningOrderId === order.orderId ? '배정 확인 중…' : '테이블 배정' }}
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.operations{display:grid;gap:1rem;border:1px solid var(--color-border);border-radius:var(--radius-surface);background:#f8faf9;padding:1rem 1.25rem}.heading{display:flex;justify-content:space-between;gap:1rem;align-items:center}.heading p,.heading h2,.heading span,h3{margin:0}.heading p{color:var(--color-primary);font-size:.78rem;font-weight:700}.heading span,.empty{color:var(--color-muted)}button,select{border:1px solid var(--color-border);border-radius:3px;background:#fff;padding:.55rem}.session-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem}.session-grid article{display:grid;gap:.5rem}.unassigned{display:grid;gap:.6rem;border-top:1px solid var(--color-border);padding-top:1rem}ul{display:grid;gap:.5rem;margin:0;padding:0;list-style:none}li{display:grid;grid-template-columns:auto auto minmax(12rem,1fr) auto;gap:.75rem;align-items:center;border:1px solid var(--color-border);background:#fff;padding:.75rem}.error{margin:0;color:#a32d2d}.notice{margin:0;color:#17633b}@media(max-width:700px){.heading{align-items:flex-start}.session-grid{grid-template-columns:1fr}li{grid-template-columns:1fr}}
</style>
