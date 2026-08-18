<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useEntryQueue } from '@/composables/useEntryQueue'
import { displayLabel } from '@/ui/displayLabels'

const router = useRouter()
const queue = useEntryQueue()
const partySize = ref<number | null>(null)

onMounted(() => queue.polling.stop())

async function search() {
  await queue.load()
  queue.polling.start()
}

async function submit() {
  await queue.register(Number(partySize.value))
  if (!queue.validationMessage.value && !queue.errorMessage.value) partySize.value = null
}
</script>

<template>
  <main class="queue-page">
    <header class="queue-header">
      <div><p>입장 대기</p><h1>입장 대기 관리</h1><span>영업일별 대기 등록과 입장 상태를 처리합니다.</span></div>
      <button type="button" @click="router.push('/pos/queues/fulfillment')">조리 현황 보기</button>
    </header>

    <section class="queue-card" aria-labelledby="entry-register-title">
      <h2 id="entry-register-title">입장 대기 등록</h2>
      <div class="queue-form">
        <label>영업일<input v-model="queue.businessDate.value" type="date" /></label>
        <label>인원수<input v-model.number="partySize" type="number" min="1" max="100" /></label>
        <button type="button" :disabled="queue.submitting.value" @click="submit">
          {{ queue.submitting.value ? '등록 중…' : '등록' }}
        </button>
      </div>
      <p v-if="queue.validationMessage.value" class="queue-error" role="alert">{{ queue.validationMessage.value }}</p>
    </section>

    <ApiErrorNotice v-if="queue.errorMessage.value" :message="queue.errorMessage.value" retryable @retry="search" />
    <section class="queue-card" aria-labelledby="entry-list-title">
      <div class="queue-section-heading">
        <div><h2 id="entry-list-title">대기 목록</h2><p>경과 시간은 Service가 등록 시각을 제공한 뒤 표시됩니다.</p></div>
        <button type="button" :disabled="queue.loading.value || !queue.businessDate.value" @click="search">새로고침</button>
      </div>
      <LoadingState v-if="queue.loading.value" />
      <p v-else-if="!queue.businessDate.value" class="queue-empty">조회할 영업일을 선택해 주세요.</p>
      <p v-else-if="queue.entries.value.length === 0" class="queue-empty">등록된 입장 대기가 없습니다.</p>
      <div v-else class="queue-table-wrap">
        <table><thead><tr><th>대기번호</th><th>인원수</th><th>상태</th><th>경과 시간</th><th>처리</th></tr></thead>
          <tbody><tr v-for="entry in queue.entries.value" :key="entry.entryId">
            <td><strong>#{{ entry.queueNumber }}</strong></td><td>{{ entry.partySize }}명</td><td>{{ displayLabel(entry.status) }}</td><td>정보 없음</td>
            <td class="queue-actions">
              <button type="button" :disabled="entry.status !== 'WAITING' || !!queue.actingId.value" @click="queue.act(entry, 'enter')">입장</button>
              <button type="button" :disabled="entry.status !== 'WAITING' || !!queue.actingId.value" @click="queue.act(entry, 'cancel')">취소</button>
              <button type="button" :disabled="entry.status !== 'WAITING' || !!queue.actingId.value" @click="queue.act(entry, 'no-show')">미방문</button>
            </td>
          </tr></tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped src="./queue.css"></style>
