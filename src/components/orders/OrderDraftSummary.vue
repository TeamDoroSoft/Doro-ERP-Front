<script setup lang="ts">
import { formatKrw } from '@/api/int64'
import type { OrderDraftLine } from '@/composables/useOrderDraft'
defineProps<{ lines: OrderDraftLine[]; estimatedTotal: string; disabled?: boolean }>()
defineEmits<{
  increment: [productId: string]
  decrement: [productId: string]
  remove: [productId: string]
}>()
</script>
<template>
  <section class="summary" aria-label="주문 초안">
    <h2>주문 내역</h2>
    <p v-if="lines.length === 0" class="empty">담은 메뉴가 없습니다.</p>
    <ul v-else>
      <li v-for="line in lines" :key="line.productId">
        <span>{{ line.name }}</span
        ><span>{{ formatKrw(line.price) }}</span>
        <div>
          <button
            type="button"
            :disabled="disabled"
            aria-label="수량 줄이기"
            @click="$emit('decrement', line.productId)"
          >
            −</button
          ><span>{{ line.quantity }}</span
          ><button
            type="button"
            :disabled="disabled"
            aria-label="수량 늘리기"
            @click="$emit('increment', line.productId)"
          >
            +
          </button>
        </div>
        <button type="button" :disabled="disabled" @click="$emit('remove', line.productId)">
          삭제
        </button>
      </li>
    </ul>
    <div class="total">
      <strong>예상 합계</strong><span>{{ estimatedTotal }}원</span>
    </div>
    <p class="notice">최종 결제 금액은 주문을 등록할 때 확정됩니다.</p>
  </section>
</template>
<style scoped>
.summary {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
}
.summary h2 {
  font-size: 1rem;
}
ul {
  display: grid;
  gap: 0.5rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
li {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 0.5rem;
  align-items: center;
}
li div {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
button {
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-background);
  padding: 0.25rem 0.45rem;
}
.empty,
.notice {
  color: var(--color-muted);
  font-size: 0.85rem;
}
.total {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  border-top: 1px solid var(--color-border);
  padding-top: 0.75rem;
}
</style>
