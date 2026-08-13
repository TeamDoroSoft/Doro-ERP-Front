<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { getAudit, getAudits, type AuditRecord } from '@/api/audit'
import { ApiError } from '@/api/http'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import { displayLabel } from '@/ui/displayLabels'

const pageSize = 20
const session = useOperatorSessionStore()
const filters = reactive(defaultFilters())
const items = ref<AuditRecord[]>([])
const nextCursor = ref<string | null>(null)
const cursorHistory = ref<(string | undefined)[]>([undefined])
const pageIndex = ref(0)
const loading = ref(false)
const error = ref<ApiError | null>(null)
const validationError = ref('')
const selected = ref<AuditRecord | null>(null)
const detailLoading = ref(false)
const detailError = ref<ApiError | null>(null)
const canQuery = computed(() => session.role === 'OWNER' || session.role === 'MANAGER')

onMounted(() => {
  if (canQuery.value) void loadPage()
})

async function applyFilters() {
  validationError.value = validateFilters()
  if (validationError.value) return
  cursorHistory.value = [undefined]
  pageIndex.value = 0
  await loadPage()
}

async function resetFilters() {
  Object.assign(filters, defaultFilters())
  validationError.value = ''
  cursorHistory.value = [undefined]
  pageIndex.value = 0
  await loadPage()
}

async function loadPage() {
  if (!canQuery.value) return
  loading.value = true
  error.value = null
  selected.value = null
  try {
    const page = await getAudits({
      from: new Date(filters.from).toISOString(),
      to: new Date(filters.to).toISOString(),
      action: normalized(filters.action),
      targetType: normalized(filters.targetType),
      targetId: normalized(filters.targetId),
      size: pageSize,
      cursor: cursorHistory.value[pageIndex.value],
    })
    items.value = page.items
    nextCursor.value = page.nextCursor
  } catch (reason) {
    error.value = asApiError(reason)
    items.value = []
    nextCursor.value = null
  } finally {
    loading.value = false
  }
}

async function nextPage() {
  if (!nextCursor.value) return
  cursorHistory.value = cursorHistory.value.slice(0, pageIndex.value + 1)
  cursorHistory.value.push(nextCursor.value)
  pageIndex.value += 1
  await loadPage()
}

async function previousPage() {
  if (pageIndex.value === 0) return
  pageIndex.value -= 1
  await loadPage()
}

async function openDetail(item: AuditRecord) {
  selected.value = item
  detailLoading.value = true
  detailError.value = null
  try {
    selected.value = await getAudit(item.id)
  } catch (reason) {
    detailError.value = asApiError(reason)
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  selected.value = null
  detailError.value = null
}

function validateFilters() {
  if (!filters.from || !filters.to) return '조회 시작과 종료 시각을 모두 입력해 주세요.'
  const from = new Date(filters.from)
  const to = new Date(filters.to)
  if (from > to) return '조회 종료 시각은 시작 시각보다 빠를 수 없습니다.'
  if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) return '조회 기간은 최대 31일입니다.'
  if (Boolean(filters.targetType.trim()) !== Boolean(filters.targetId.trim())) return '대상 유형과 대상 ID를 함께 입력해 주세요.'
  return ''
}

function defaultFilters() {
  const to = new Date()
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
  return { from: localDateTime(from), to: localDateTime(to), action: '', targetType: '', targetId: '' }
}

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

function normalized(value: string) {
  return value.trim() || undefined
}

function asApiError(reason: unknown) {
  return reason instanceof ApiError ? reason : new ApiError(0, { code: 'NETWORK_ERROR', detail: '서버에 연결할 수 없습니다.' })
}

function errorMessage(value: ApiError) {
  if (value.status === 403 || value.code === 'AUDIT_ROLE_NOT_ALLOWED') return '이 기능에 접근할 권한이 없습니다.'
  if (value.code === 'AUDIT_RECORD_NOT_FOUND') return '감사 기록을 찾을 수 없습니다.'
  if (value.code === 'SESSION_VALIDATION_UNAVAILABLE') return '로그인 정보를 확인할 수 없습니다.'
  if (value.code === 'DEPENDENCY_UNAVAILABLE') return '감사 조회 기능을 일시적으로 사용할 수 없습니다.'
  return value.message
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}

function actorLabel(item: AuditRecord) {
  if (item.actor.type === 'EMPLOYEE') return item.actor.role ? displayLabel(item.actor.role) : '직원'
  return displayLabel(item.actor.type)
}
</script>

<template>
  <section class="audit-page">
    <PageHeader title="감사 이력" description="직원과 시스템의 주요 변경 내역을 확인합니다." eyebrow="운영 기록">
      <template #actions><StatusBadge label="최대 31일 조회" tone="neutral" /></template>
    </PageHeader>

    <section v-if="!canQuery" class="permission-panel">
      <div class="permission-icon"><AppIcon name="audit" :size="24" /></div>
      <h2>이 기능에 접근할 권한이 없습니다.</h2>
      <p>감사 이력은 소유자와 관리자만 조회할 수 있습니다.</p>
    </section>

    <template v-else>
      <form class="filter-panel" aria-label="감사 이력 필터" @submit.prevent="applyFilters">
        <div class="filter-heading"><div><h2>조회 조건</h2><p>조회 기간을 선택하고 필요한 조건을 입력하세요.</p></div><button class="reset-button" type="button" :disabled="loading" @click="resetFilters">초기화</button></div>
        <div class="filter-grid">
          <label>시작 시각<input v-model="filters.from" name="from" type="datetime-local" required /></label>
          <label>종료 시각<input v-model="filters.to" name="to" type="datetime-local" required /></label>
          <label>작업 코드<input v-model.trim="filters.action" name="action" placeholder="예: ORDER_ACCEPTED" /></label>
          <label>대상 유형<input v-model.trim="filters.targetType" name="targetType" placeholder="예: ORDER" /></label>
          <label class="target-id">대상 ID<input v-model.trim="filters.targetId" name="targetId" placeholder="UUID" /></label>
          <button class="apply-button" type="submit" :disabled="loading">{{ loading ? '조회 중…' : '필터 적용' }}</button>
        </div>
        <p v-if="validationError" class="validation-error" role="alert">{{ validationError }}</p>
      </form>

      <section class="list-panel" aria-labelledby="audit-list-title">
        <div class="list-heading"><div><h2 id="audit-list-title">조회 결과</h2><p>최신 발생 시각 순 · 페이지당 {{ pageSize }}개</p></div><StatusBadge :label="`${pageIndex + 1} 페이지`" tone="neutral" /></div>
        <LoadingState v-if="loading" />
        <ApiErrorNotice v-else-if="error" :message="errorMessage(error)" :request-id="error.requestId" :retryable="error.status !== 403" @retry="loadPage" />
        <EmptyState v-else-if="items.length === 0" title="감사 이력이 없습니다" description="조회 기간이나 조건을 변경해 보세요." />
        <template v-else>
          <div class="table-scroll">
            <table>
              <thead><tr><th>발생 시각</th><th>수행자</th><th>작업</th><th>대상</th><th>결과</th><th><span class="sr-only">상세</span></th></tr></thead>
              <tbody><tr v-for="item in items" :key="item.id" tabindex="0" @click="openDetail(item)" @keydown.enter="openDetail(item)"><td><time :datetime="item.occurredAt">{{ formatDate(item.occurredAt) }}</time><small>{{ item.sourceService }}</small></td><td><strong>{{ actorLabel(item) }}</strong></td><td><strong>{{ displayLabel(item.action) }}</strong><small>{{ item.action }}</small></td><td><strong>{{ displayLabel(item.target.type) }}</strong><small class="mono">{{ item.target.id }}</small></td><td><StatusBadge :label="item.result === 'SUCCESS' ? '성공' : '실패'" :tone="item.result === 'SUCCESS' ? 'success' : 'danger'" /></td><td><button type="button" aria-label="감사 기록 상세 보기" @click.stop="openDetail(item)">상세</button></td></tr></tbody>
            </table>
          </div>
          <nav class="pagination" aria-label="감사 이력 페이지"><button type="button" :disabled="pageIndex === 0 || loading" @click="previousPage">이전</button><span>{{ pageIndex + 1 }} 페이지</span><button type="button" :disabled="!nextCursor || loading" @click="nextPage">다음</button></nav>
        </template>
      </section>
    </template>

    <div v-if="selected" class="drawer-backdrop" @click.self="closeDetail">
      <aside class="detail-drawer" aria-labelledby="audit-detail-title">
        <header><div><p>상세 정보</p><h2 id="audit-detail-title">감사 기록 상세</h2></div><button type="button" aria-label="상세 닫기" @click="closeDetail">×</button></header>
        <LoadingState v-if="detailLoading" />
        <ApiErrorNotice v-else-if="detailError" :message="errorMessage(detailError)" :request-id="detailError.requestId" />
        <div v-else class="detail-content">
          <div class="detail-hero"><StatusBadge :label="selected.result === 'SUCCESS' ? '성공' : '실패'" :tone="selected.result === 'SUCCESS' ? 'success' : 'danger'" /><h3>{{ displayLabel(selected.action) }}</h3><time>{{ formatDate(selected.occurredAt) }}</time></div>
          <dl><div><dt>작업 코드</dt><dd class="mono">{{ selected.action }}</dd></div><div><dt>수행자</dt><dd>{{ actorLabel(selected) }}</dd></div><div><dt>수행자 ID</dt><dd class="mono">{{ selected.actor.id }}</dd></div><div><dt>대상</dt><dd>{{ displayLabel(selected.target.type) }}</dd></div><div><dt>대상 ID</dt><dd class="mono">{{ selected.target.id }}</dd></div><div><dt>발생 서비스</dt><dd>{{ selected.sourceService }}</dd></div><div><dt>감사 기록 ID</dt><dd class="mono">{{ selected.id }}</dd></div><div><dt>이벤트 ID</dt><dd class="mono">{{ selected.eventId }}</dd></div><div><dt>추적 ID</dt><dd class="mono">{{ selected.traceId }}</dd></div><div v-if="selected.reasonCode"><dt>사유 코드</dt><dd>{{ selected.reasonCode }}</dd></div></dl>
          <section class="metadata"><h3>추가 정보</h3><p v-if="Object.keys(selected.metadata).length === 0">추가 정보가 없습니다.</p><dl v-else><div v-for="(value, key) in selected.metadata" :key="key"><dt>{{ key }}</dt><dd>{{ value === null ? '없음' : String(value) }}</dd></div></dl></section>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.audit-page { display: grid; gap: 18px; }.filter-panel, .list-panel, .permission-panel { border: 1px solid var(--color-border); border-radius: 14px; background: white; padding: 22px; }.filter-heading, .list-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }.filter-heading h2, .list-heading h2 { margin-bottom: 3px; color: var(--color-heading); font-size: 16px; font-weight: 750; }.filter-heading p, .list-heading p { margin-bottom: 0; color: var(--color-muted); font-size: 12px; }.filter-grid { display: grid; grid-template-columns: 1.1fr 1.1fr 1fr 1fr 1.35fr auto; align-items: end; gap: 12px; }label { display: grid; gap: 6px; color: var(--color-heading); font-size: 11px; font-weight: 700; }input { width: 100%; min-width: 0; min-height: 41px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 10px; color: var(--color-heading); }input:focus-visible, button:focus-visible, tr:focus-visible { border-color: var(--color-primary); outline: 3px solid rgb(79 70 229 / 13%); outline-offset: 1px; }.apply-button, .reset-button, .pagination button, tbody button { min-height: 39px; border: 1px solid var(--color-border); border-radius: 8px; background: white; padding: 0 13px; color: var(--color-text); font-weight: 650; }.apply-button { border-color: var(--color-primary); background: var(--color-primary); color: white; }.apply-button:hover:not(:disabled) { background: #4338ca; }.reset-button:hover:not(:disabled), .pagination button:hover:not(:disabled), tbody button:hover { border-color: #c7d2fe; background: var(--color-primary-soft); color: var(--color-primary); }.validation-error { margin: 12px 0 0; color: var(--color-danger); font-size: 12px; }.table-scroll { overflow-x: auto; }table { width: 100%; min-width: 900px; border-collapse: collapse; }th { border-bottom: 1px solid var(--color-border); background: #f8fafc; padding: 11px 13px; color: var(--color-muted); font-size: 11px; font-weight: 750; text-align: left; }td { border-bottom: 1px solid #eef2f7; padding: 13px; color: var(--color-text); font-size: 12px; vertical-align: middle; }tbody tr { cursor: pointer; transition: background .15s ease; }tbody tr:hover { background: #fafaff; }td strong, td small { display: block; }td strong { color: var(--color-heading); font-weight: 650; }td small { max-width: 220px; overflow: hidden; margin-top: 3px; color: #94a3b8; text-overflow: ellipsis; white-space: nowrap; }code { border-radius: 5px; background: #f1f5f9; padding: 4px 7px; color: #4338ca; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }.pagination { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding-top: 16px; }.pagination span { color: var(--color-muted); font-size: 12px; }.pagination button:disabled, button:disabled { cursor: not-allowed; opacity: .5; }.permission-panel { display: grid; min-height: 360px; place-items: center; align-content: center; text-align: center; }.permission-icon { display: grid; width: 52px; height: 52px; place-items: center; border-radius: 13px; background: #fef2f2; color: var(--color-danger); }.permission-panel h2 { margin: 16px 0 5px; color: var(--color-heading); font-size: 18px; font-weight: 750; }.permission-panel p { color: var(--color-muted); }.drawer-backdrop { position: fixed; inset: 0; z-index: 50; background: rgb(15 23 42 / 38%); }.detail-drawer { position: absolute; inset: 0 0 0 auto; width: min(100%, 480px); overflow-y: auto; background: white; box-shadow: -18px 0 50px rgb(15 23 42 / 13%); }.detail-drawer > header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border); background: white; padding: 22px 24px; }.detail-drawer header p { margin-bottom: 3px; color: var(--color-primary); font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }.detail-drawer header h2 { margin: 0; color: var(--color-heading); font-size: 19px; font-weight: 750; }.detail-drawer header button { width: 34px; height: 34px; border: 1px solid var(--color-border); border-radius: 8px; background: white; color: var(--color-muted); font-size: 20px; }.detail-content { padding: 24px; }.detail-hero { border-radius: 12px; background: #f8fafc; padding: 18px; }.detail-hero h3 { margin: 12px 0 5px; color: var(--color-heading); font-size: 18px; font-weight: 750; }.detail-hero time { color: var(--color-muted); font-size: 12px; }.detail-content > dl, .metadata dl { display: grid; margin: 20px 0; }.detail-content dl div { display: grid; grid-template-columns: 110px minmax(0, 1fr); border-bottom: 1px solid #eef2f7; padding: 11px 2px; }.detail-content dt { color: var(--color-muted); font-size: 11px; font-weight: 650; }.detail-content dd { min-width: 0; overflow-wrap: anywhere; margin: 0; color: var(--color-heading); font-size: 12px; }.metadata { margin-top: 24px; }.metadata h3 { color: var(--color-heading); font-size: 14px; font-weight: 750; }.metadata > p { color: var(--color-muted); font-size: 12px; }.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
@media (max-width: 1200px) { .filter-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }.apply-button { width: 100%; } }
@media (max-width: 760px) { .filter-panel, .list-panel { padding: 17px; }.filter-grid { grid-template-columns: 1fr 1fr; }.target-id { grid-column: 1 / -1; }.filter-heading, .list-heading { align-items: stretch; flex-direction: column; }.reset-button { align-self: flex-start; } }
@media (max-width: 520px) { .filter-grid { grid-template-columns: 1fr; }.target-id { grid-column: auto; }.detail-drawer { width: 100%; } }
</style>
