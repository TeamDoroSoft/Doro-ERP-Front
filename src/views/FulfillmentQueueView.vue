<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useFulfillmentQueue } from '@/composables/useFulfillmentQueue'
import { displayLabel } from '@/ui/displayLabels'

const queue = useFulfillmentQueue()

onMounted(async () => {
  await queue.load()
  queue.polling.start()
})
</script>

<template>
  <main class="queue-page">
    <header class="queue-header">
      <div><p>주문 준비</p><h1>조리 목록</h1><span>접수된 주문의 준비 상태를 확인합니다.</span></div>
    </header>
    <p class="queue-lag">결제가 완료된 주문은 잠시 후 목록에 표시될 수 있습니다. 보이지 않으면 새로고침해 주세요.</p>
    <ApiErrorNotice v-if="queue.errorMessage.value" :message="queue.errorMessage.value" retryable @retry="() => queue.load()" />
    <section class="queue-card" aria-labelledby="fulfillment-list-title">
      <div class="queue-section-heading"><h2 id="fulfillment-list-title">조리 목록</h2><button type="button" :disabled="queue.loading.value" @click="() => queue.load()">새로고침</button></div>
      <LoadingState v-if="queue.loading.value" />
      <p v-else-if="!queue.errorMessage.value && queue.fulfillments.value.length === 0" class="queue-empty">현재 조리 중인 주문이 없습니다.</p>
      <div v-else-if="queue.fulfillments.value.length > 0" class="queue-table-wrap">
        <table><thead><tr><th>주문</th><th>주문 생성</th><th>품목</th><th>상태</th><th>주문 상세</th><th>작업</th></tr></thead>
          <tbody><tr v-for="item in queue.fulfillments.value" :key="item.fulfillmentId">
            <td><strong>#{{ item.displayNumber }}</strong></td><td><span class="source-badge" :class="{ kiosk: item.sourceType === 'KIOSK' }">{{ item.sourceType === 'KIOSK' ? item.sourceDeviceNameSnapshot || 'Kiosk' : item.sourceType === 'EMPLOYEE_POS' ? '직원 POS' : '출처 정보 없음' }}</span></td><td>{{ item.itemSummary ?? '품목 정보 없음' }}</td><td>{{ displayLabel(item.status) }}</td>
            <td><RouterLink :to="`/pos/orders/${item.orderId}`">주문 보기</RouterLink></td>
            <td class="queue-actions"><button type="button" :disabled="item.status !== 'PREPARING' || !!queue.actingId.value" @click="queue.ready(item)">{{ queue.actingId.value === item.fulfillmentId ? '처리 중…' : '준비 완료' }}</button></td>
          </tr></tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped src="./queue.css"></style>
<style scoped>
.source-badge { display: inline-flex; border-radius: 999px; background: #eef1f4; padding: 3px 8px; color: #4b5563; font-size: 11px; font-weight: 700; }
.source-badge.kiosk { background: #e8f6f0; color: #087f5b; }
</style>
