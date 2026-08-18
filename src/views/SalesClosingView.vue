<script setup lang="ts">
import { ref } from 'vue'
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
const session = useOperatorSessionStore(),
  businessDate = ref(''),
  daily = ref<DailySales | null>(null),
  closing = ref<DailyClosing | null>(null),
  loading = ref(false),
  closingNow = ref(false),
  error = ref<ApiError | null>(null),
  notice = ref('')
async function load() {
  if (!businessDate.value) return
  loading.value = true
  error.value = null
  notice.value = ''
  daily.value = null
  closing.value = null
  try {
    daily.value = await getDailySales(businessDate.value)
    try {
      closing.value = await getDailyClosing(businessDate.value)
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e
    }
  } catch (e) {
    error.value = asError(e)
  } finally {
    loading.value = false
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
    : new ApiError(0, { code: 'NETWORK_ERROR', detail: '서버에 연결할 수 없습니다.' })
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
      description="영업일 기준 매출을 조회하고 마감 상태를 확인합니다."
      eyebrow="매출·마감"
    />
    <form class="panel query" @submit.prevent="load">
      <label>영업일<input v-model="businessDate" type="date" required /></label
      ><button :disabled="loading">조회</button>
    </form>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <LoadingState v-if="loading" /><ApiErrorNotice
      v-else-if="error"
      :message="safeApiErrorMessage(error)"
      :request-id="error.requestId"
      retryable
      @retry="load"
    /><EmptyState
      v-else-if="!daily"
      title="조회할 영업일을 선택하세요"
      description="영업일은 서버의 매장 운영 기준으로 집계됩니다."
    /><template v-else
      ><section class="panel heading">
        <div>
          <h2>{{ daily.businessDate }} 매출</h2>
          <p>통화: {{ daily.currency }}</p>
        </div>
        <StatusBadge
          :label="daily.closed ? '마감 완료' : '미마감'"
          :tone="daily.closed ? 'success' : 'warning'"
        />
      </section>
      <section class="metrics">
        <article v-for="row in amountRows(daily)" :key="row[0]">
          <span>{{ row[0] }}</span
          ><strong>{{ formatExactKrw(row[1]) }}</strong>
        </article>
        <article>
          <span>완료 주문</span><strong>{{ daily.completedOrderCount }}건</strong>
        </article>
        <article>
          <span>취소 주문</span><strong>{{ daily.cancelledOrderCount }}건</strong>
        </article>
      </section>
      <section class="panel closing">
        <div>
          <h2>마감 기록</h2>
          <p v-if="closing">
            마감 시각 {{ new Date(closing.closedAt).toLocaleString('ko-KR') }} · 기록 ID
            {{ closing.closingId }}
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
.panel,
.metrics article {
  border: 1px solid var(--color-border);
  border-radius: 14px;
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
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
}
.query button,
.closing button {
  min-height: 42px;
  border: 0;
  border-radius: 8px;
  background: var(--color-primary);
  padding: 0 18px;
  color: #fff;
  font-weight: 700;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.metrics span {
  display: block;
  color: var(--color-muted);
  font-size: 12px;
}
.metrics strong {
  display: block;
  margin-top: 8px;
  color: var(--color-heading);
  font-size: 20px;
}
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
  border-radius: 8px;
  background: #ecfdf5;
  padding: 12px;
  color: #047857;
}
button:disabled {
  opacity: 0.5;
}
@media (max-width: 900px) {
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .query,
  .heading,
  .closing {
    align-items: stretch;
    flex-direction: column;
  }
  .metrics {
    grid-template-columns: 1fr;
  }
}
</style>
