<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCatalogHistory } from '@/api/catalog'
import { ApiError } from '@/api/http'
import type { CatalogHistoryEntry, CatalogHistoryQuery } from '@/types/catalog'

const targetTypeFilter = ref<'' | 'CATEGORY' | 'PRODUCT'>('')
const actionFilter = ref('')

const entries = ref<CatalogHistoryEntry[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadError = ref('')

const hasMore = computed(() => nextCursor.value !== null)

function currentFilter(cursor?: string): CatalogHistoryQuery {
  const filter: CatalogHistoryQuery = {}
  if (targetTypeFilter.value) filter.targetType = targetTypeFilter.value
  if (actionFilter.value.trim()) filter.action = actionFilter.value.trim()
  if (cursor) filter.cursor = cursor
  return filter
}

async function search(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const page = await getCatalogHistory(currentFilter())
    entries.value = page.items
    nextCursor.value = page.nextCursor
  } catch (caught) {
    loadError.value = caught instanceof ApiError ? caught.detail : '이력을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (!nextCursor.value) return
  loading.value = true
  loadError.value = ''
  try {
    const page = await getCatalogHistory(currentFilter(nextCursor.value))
    entries.value = [...entries.value, ...page.items]
    nextCursor.value = page.nextCursor
  } catch (caught) {
    loadError.value = caught instanceof ApiError ? caught.detail : '이력을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

function formatOccurredAt(occurredAt: string): string {
  return new Date(occurredAt).toLocaleString('ko-KR')
}

onMounted(() => {
  void search()
})
</script>

<template>
  <main class="catalog-history">
    <header>
      <h1>변경 이력</h1>
      <p>카테고리·상품 변경 이력을 조회합니다.</p>
    </header>

    <form class="filter-form" novalidate @submit.prevent="search">
      <div class="filter-field">
        <label for="target-type-filter">대상 유형</label>
        <select id="target-type-filter" v-model="targetTypeFilter">
          <option value="">전체</option>
          <option value="CATEGORY">카테고리</option>
          <option value="PRODUCT">상품</option>
        </select>
      </div>
      <div class="filter-field">
        <label for="action-filter">Action</label>
        <input id="action-filter" v-model="actionFilter" type="text" placeholder="예: PRODUCT_PRICE_CHANGED" />
      </div>
      <button type="submit" :disabled="loading">조회</button>
    </form>

    <p v-if="loadError" class="error-panel" role="alert">{{ loadError }}</p>

    <p v-if="loading && entries.length === 0" class="status" role="status">이력을 불러오는 중입니다.</p>
    <p v-else-if="entries.length === 0" class="status">조회된 이력이 없습니다.</p>

    <ul v-else class="history-list">
      <li v-for="entry in entries" :key="entry.auditId" class="history-row">
        <div class="history-row-header">
          <span class="action">{{ entry.action }}</span>
          <span class="occurred-at">{{ formatOccurredAt(entry.occurredAt) }}</span>
        </div>
        <div class="history-row-meta">
          <span v-if="entry.targetType">{{ entry.targetType }} · {{ entry.targetId }}</span>
          <span v-if="entry.actorRoleSnapshot">처리자: {{ entry.actorRoleSnapshot }}</span>
        </div>
        <details v-if="entry.beforeValue || entry.afterValue">
          <summary>변경 내용</summary>
          <div class="diff">
            <div v-if="entry.beforeValue">
              <h3>변경 전</h3>
              <pre>{{ JSON.stringify(entry.beforeValue, null, 2) }}</pre>
            </div>
            <div v-if="entry.afterValue">
              <h3>변경 후</h3>
              <pre>{{ JSON.stringify(entry.afterValue, null, 2) }}</pre>
            </div>
          </div>
        </details>
      </li>
    </ul>

    <button v-if="hasMore" type="button" class="load-more" :disabled="loading" @click="loadMore">더 보기</button>
  </main>
</template>

<style scoped>
.catalog-history {
  width: min(100%, 840px);
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  margin-bottom: 2rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
}

header p {
  color: #5f6368;
}

.filter-form {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

label {
  font-weight: 600;
}

input,
select {
  box-sizing: border-box;
  padding: 0.55rem 0.7rem;
  border: 1px solid #b7bcc3;
  border-radius: 0.35rem;
  font: inherit;
}

button {
  padding: 0.55rem 0.9rem;
  border: 1px solid #777;
  border-radius: 0.35rem;
  background: white;
  font: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.error-panel {
  margin-bottom: 1rem;
  padding: 0.9rem;
  border: 1px solid #f0aaa4;
  border-radius: 0.35rem;
  background: #fff5f4;
  color: #b42318;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history-row {
  padding: 0.9rem 0;
  border-bottom: 1px solid #e3e5e8;
}

.history-row-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}

.history-row-meta {
  display: flex;
  gap: 1rem;
  color: #5f6368;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

details {
  margin-top: 0.5rem;
}

.diff {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.diff pre {
  background: #f4f5f6;
  padding: 0.6rem;
  border-radius: 0.35rem;
  overflow-x: auto;
  max-width: 380px;
}

.load-more {
  margin-top: 1.5rem;
}
</style>
