<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useFulfillmentQueue } from '@/composables/useFulfillmentQueue'
import { displayLabel } from '@/ui/displayLabels'

const router = useRouter()
const queue = useFulfillmentQueue()

onMounted(async () => {
  await queue.load()
  queue.polling.start()
})
</script>

<template>
  <main class="queue-page">
    <header class="queue-header">
      <div><p>주문 조리</p><h1>조리 현황</h1><span>주문 접수 이벤트로 생성된 준비 항목을 확인합니다.</span></div>
      <button type="button" @click="router.push('/pos/queues/entry')">입장 대기 보기</button>
    </header>
    <p class="queue-lag">결제 승인 후 주문 접수 이벤트가 반영되기까지 잠시 걸릴 수 있습니다. 목록에 없으면 새로고침해 주세요.</p>
    <ApiErrorNotice v-if="queue.errorMessage.value" :message="queue.errorMessage.value" retryable @retry="() => queue.load()" />
    <section class="queue-card" aria-labelledby="fulfillment-list-title">
      <div class="queue-section-heading"><h2 id="fulfillment-list-title">조리 목록</h2><button type="button" :disabled="queue.loading.value" @click="() => queue.load()">새로고침</button></div>
      <LoadingState v-if="queue.loading.value" />
      <p v-else-if="queue.fulfillments.value.length === 0" class="queue-empty">현재 조리 중인 주문이 없습니다. 이벤트 반영이 지연될 수 있습니다.</p>
      <div v-else class="queue-table-wrap">
        <table><thead><tr><th>주문</th><th>상태</th><th>주문 상세</th><th>처리</th></tr></thead>
          <tbody><tr v-for="item in queue.fulfillments.value" :key="item.fulfillmentId">
            <td><strong>#{{ item.displayNumber }}</strong></td><td>{{ displayLabel(item.status) }}</td>
            <td><RouterLink :to="`/pos/orders/${item.orderId}`">주문 보기</RouterLink></td>
            <td class="queue-actions"><button type="button" :disabled="item.status !== 'PREPARING' || !!queue.actingId.value" @click="queue.ready(item)">{{ queue.actingId.value === item.fulfillmentId ? '처리 중…' : '준비 완료' }}</button></td>
          </tr></tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped src="./queue.css"></style>
