<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import {
  closeDailySales,
  formatExactKrw,
  getDailyClosing,
  getDailySales,
  type DailyClosing,
  type DailySales,
} from '@/api/sales'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import { useCurrentBusinessDate } from '@/composables/useCurrentBusinessDate'
const session = useOperatorSessionStore(),
  daily = ref<DailySales | null>(null),
  closing = ref<DailyClosing | null>(null),
  loading = ref(false),
  closingNow = ref(false),
  error = ref<ApiError | null>(null),
  notice = ref('')
const { businessDate, loadingBusinessDate, businessDateError, resolveBusinessDate } =
  useCurrentBusinessDate()
let loadSequence = 0
watch(businessDate, () => {
  if (businessDate.value) businessDateError.value = ''
  void load()
}, { immediate: true })
onMounted(resolveBusinessDate)
async function load() {
  if (!businessDate.value) {
    loadSequence += 1
    daily.value = null
    closing.value = null
    error.value = null
    loading.value = false
    notice.value = ''
    return
  }
  const sequence = ++loadSequence
  const requestedDate = businessDate.value
  loading.value = true
  error.value = null
  notice.value = ''
  daily.value = null
  closing.value = null
  try {
    const nextDaily = await getDailySales(requestedDate)
    let nextClosing: DailyClosing | null = null
    try {
      nextClosing = await getDailyClosing(requestedDate)
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e
    }
    if (sequence === loadSequence && requestedDate === businessDate.value) {
      daily.value = nextDaily
      closing.value = nextClosing
    }
  } catch (e) {
    if (sequence === loadSequence) error.value = asError(e)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}
async function closeDay() {
  if (
    !businessDate.value ||
    !confirm(`${businessDate.value} 영업일을 마감할까요? 마감 후에는 되돌릴 수 없습니다.`)
  )
    return
  closingNow.value = true
  error.value = null
  try {
    await closeDailySales(businessDate.value)
    await load()
    notice.value = '영업일 마감이 완료되었습니다.'
  } catch (e) {
    error.value = asError(e)
  } finally {
    closingNow.value = false
  }
}
function asError(e: unknown) {
  return e instanceof ApiError
    ? e
    : new ApiError(0, { code: 'NETWORK_ERROR', detail: '연결 상태를 확인해 주세요.' })
}
function amountRows(v: DailySales | DailyClosing): Array<[string, string]> {
  return [
    ['승인 금액', v.approvedAmount],
    ['취소 금액', v.cancelledAmount],
    ['순매출', v.netSales],
  ]
}
</script>
<template>
  <section class="page">
    <PageHeader
      title="일별 매출과 마감"
      description="영업일별 매출과 마감 상태를 확인합니다."
      eyebrow="매출·마감"
    />
    <form class="panel query" @submit.prevent="load">
      <label>영업일<input v-model="businessDate" type="date" required :disabled="loadingBusinessDate" /></label
      ><button :disabled="loading || loadingBusinessDate">조회</button>
    </form>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <LoadingState v-if="loading || loadingBusinessDate" /><ApiErrorNotice
      v-if="businessDateError"
      :message="businessDateError"
      retryable
      @retry="resolveBusinessDate"
    /><ApiErrorNotice
      v-if="!loading && !loadingBusinessDate && error"
      :message="safeApiErrorMessage(error)"
      :request-id="error.requestId"
      retryable
      @retry="load"
    /><EmptyState
      v-if="!loading && !loadingBusinessDate && !daily && !error"
      title="조회할 영업일을 선택해 주세요"
      description="영업일을 선택하면 매출과 마감 상태를 확인할 수 있습니다."
    /><template v-if="!loading && !loadingBusinessDate && daily && !error"
      ><section class="panel heading">
        <div><p class="section-kicker">일일 정산</p><h2>{{ daily.businessDate }} 정산</h2><p>결제 통화 {{ daily.currency }}</p></div>
        <StatusBadge :label="daily.closed ? '마감 완료' : '미마감'" :tone="daily.closed ? 'success' : 'warning'" />
      </section>
      <section class="sales-table-wrap"><table class="sales-table"><thead><tr><th>정산 항목</th><th>금액 / 건수</th></tr></thead><tbody><tr v-for="row in amountRows(daily)" :key="row[0]"><td>{{ row[0] }}</td><td>{{ formatExactKrw(row[1]) }}</td></tr><tr><td>완료 주문</td><td>{{ daily.completedOrderCount }}건</td></tr><tr><td>취소 주문</td><td>{{ daily.cancelledOrderCount }}건</td></tr></tbody></table></section>
      <section class="panel closing">
        <div>
          <h2>마감 기록</h2>
          <p v-if="closing">
            마감 시각 {{ new Date(closing.closedAt).toLocaleString('ko-KR') }}
          </p>
          <p v-else>아직 생성된 마감 기록이 없습니다.</p>
        </div>
        <button
          v-if="session.canDoDailyClosing && !daily.closed"
          class="danger"
          :disabled="closingNow"
          @click="closeDay"
        >
          {{ closingNow ? '마감 중…' : '영업일 마감' }}
        </button>
      </section></template
    >
  </section>
</template>
<style scoped>
.page {
  display: grid;
  gap: 18px;
}
.panel {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #fff;
  padding: 20px;
}
.query,
.heading,
.closing {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}
.query {
  justify-content: flex-start;
}
.query label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}
.query input {
  min-height: 42px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  padding: 0 10px;
}
.query button,
.closing button {
  min-height: 42px;
  border: 0;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  padding: 0 18px;
  color: #fff;
  font-weight: 700;
}
.section-kicker{margin:0 0 4px;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:.08em}.sales-table-wrap{border:1px solid var(--color-border);background:#fff}.sales-table{width:100%;border-collapse:collapse}.sales-table th,.sales-table td{border-bottom:1px solid var(--color-border);padding:12px 16px;text-align:left;font-size:13px}.sales-table th{background:#f7f7f8;color:#6b7280;font-size:11px}.sales-table td:last-child{font-weight:700;text-align:right}.sales-table tr:last-child td{border-bottom:0}
.heading h2,
.closing h2 {
  margin: 0;
  color: var(--color-heading);
  font-size: 18px;
}
.heading p,
.closing p {
  margin: 5px 0 0;
  color: var(--color-muted);
  font-size: 12px;
}
.closing .danger {
  background: var(--color-danger);
}
.notice {
  margin: 0;
  border-left:3px solid #00a878;
  background:#fff;
  padding:12px;
  color:#276749;
}
button:disabled {
  opacity: 0.5;
}
@media (max-width: 900px) {
}
@media (max-width: 560px) {
  .query,
  .heading,
  .closing {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
