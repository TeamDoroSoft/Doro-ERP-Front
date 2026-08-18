<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getSecurityHistory, type SecurityEntry } from '@/api/administration'
import { ApiError } from '@/api/http'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
const now = new Date(),
  from = new Date(now.getTime() - 7 * 86400000),
  filters = reactive({
    from: from.toISOString().slice(0, 16),
    to: now.toISOString().slice(0, 16),
    eventType: '',
    targetType: '',
    targetId: '',
    result: '',
  }),
  items = ref<SecurityEntry[]>([]),
  loading = ref(false),
  error = ref<ApiError | null>(null),
  nextAt = ref<string | null>(null),
  nextId = ref<string | null>(null),
  hasMore = ref(false)
onMounted(() => load(false))
async function load(append: boolean) {
  loading.value = true
  error.value = null
  try {
    const page = await getSecurityHistory({
      from: new Date(filters.from).toISOString(),
      to: new Date(filters.to).toISOString(),
      eventType: filters.eventType || undefined,
      targetType: filters.targetType || undefined,
      targetId: filters.targetId || undefined,
      result: filters.result || undefined,
      cursorOccurredAt: append ? nextAt.value || undefined : undefined,
      cursorId: append ? nextId.value || undefined : undefined,
      size: 20,
    })
    items.value = append ? [...items.value, ...page.items] : page.items
    nextAt.value = page.nextCursorOccurredAt
    nextId.value = page.nextCursorId
    hasMore.value = page.hasMore
  } catch (e) {
    error.value =
      e instanceof ApiError
        ? e
        : new ApiError(0, { code: 'NETWORK_ERROR', detail: '서버에 연결할 수 없습니다.' })
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <section class="security">
    <form class="filters" @submit.prevent="load(false)">
      <label>시작<input v-model="filters.from" type="datetime-local" required /></label
      ><label>종료<input v-model="filters.to" type="datetime-local" required /></label
      ><label>이벤트<input v-model.trim="filters.eventType" placeholder="LOGIN_FAILED" /></label
      ><label
        >결과<select v-model="filters.result">
          <option value="">전체</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
        </select></label
      ><label>대상 유형<input v-model.trim="filters.targetType" /></label
      ><label>대상 ID<input v-model.trim="filters.targetId" /></label><button>조회</button>
    </form>
    <ApiErrorNotice
      v-if="error"
      :message="error.message"
      :request-id="error.requestId"
      retryable
      @retry="load(false)"
    /><LoadingState v-else-if="loading && !items.length" /><EmptyState
      v-else-if="!items.length"
      title="보안 이력이 없습니다"
      description="조회 기간이나 조건을 변경해 보세요."
    />
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>발생 시각</th>
            <th>이벤트</th>
            <th>수행 직원</th>
            <th>대상</th>
            <th>결과</th>
            <th>사유</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>{{ new Date(item.occurredAt).toLocaleString('ko-KR') }}</td>
            <td>{{ item.eventType }}</td>
            <td>{{ item.actorEmployeeId }}</td>
            <td>
              {{ item.targetType }}<small>{{ item.targetId }}</small>
            </td>
            <td>{{ item.result }}</td>
            <td>{{ item.reasonCode || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <button v-if="hasMore" class="more" :disabled="loading" @click="load(true)">
        {{ loading ? '불러오는 중…' : '더 보기' }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.security {
  display: grid;
  gap: 16px;
}
.filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #fff;
  padding: 20px;
}
.filters label {
  display: grid;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
}
.filters input,
.filters select {
  min-height: 40px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 9px;
}
.filters button,
.more {
  min-height: 40px;
  border: 0;
  border-radius: 8px;
  background: var(--color-primary);
  padding: 0 16px;
  color: #fff;
  font-weight: 700;
}
.table-wrap {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #fff;
  padding: 18px;
}
table {
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;
}
th,
td {
  border-bottom: 1px solid var(--color-border);
  padding: 11px;
  text-align: left;
  font-size: 12px;
}
td small {
  display: block;
  color: var(--color-muted);
}
.more {
  display: block;
  margin: 16px auto 0;
}
@media (max-width: 700px) {
  .filters {
    grid-template-columns: 1fr;
  }
}
</style>
