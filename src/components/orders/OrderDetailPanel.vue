<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { displayLabel } from '@/ui/displayLabels'
import type { OrderStatus } from '@/api/order'
import { formatInt64, type Int64String } from '@/api/int64'

export interface OrderDetail {
  orderId: string
  displayNumber: number
  totalAmount: Int64String
  currency: string
  status: OrderStatus
  businessDate: string
}

defineProps<{ order: OrderDetail; cancelling: boolean; completing: boolean }>()
defineEmits<{ cancel: []; complete: [] }>()

function formatAmount(amount: Int64String, currency: string): string {
  const formatted = formatInt64(amount)
  return `${formatted} ${currency}`
}

function tone(status: OrderStatus) {
  return status === 'COMPLETED' ? 'success' : status === 'CANCELLED' ? 'danger' : 'warning'
}
</script>

<template>
  <article class="order-detail">
    <header>
      <div>
        <p class="eyebrow">주문 #{{ order.displayNumber }}</p>
        <h1>주문 상세</h1>
      </div>
      <StatusBadge :label="displayLabel(order.status)" :tone="tone(order.status)" />
    </header>
    <dl>
      <div>
        <dt>영업일</dt>
        <dd>{{ order.businessDate }}</dd>
      </div>
      <div>
        <dt>주문 금액</dt>
        <dd>{{ formatAmount(order.totalAmount, order.currency) }}</dd>
      </div>
    </dl>
    <section class="contract-notice" aria-label="주문 상세 정보 안내">
      <h2>주문 요약</h2>
      <p>
        이 화면에서는 주문 번호, 영업일, 금액과 상태를 확인할 수 있습니다. 메뉴와 테이블 정보는
        표시되지 않습니다.
      </p>
    </section>
    <div class="actions">
      <button
        v-if="order.status === 'CREATED'"
        class="danger"
        type="button"
        :disabled="cancelling"
        @click="$emit('cancel')"
      >
        {{ cancelling ? '취소 중…' : '주문 취소' }}
      </button>
      <p v-else-if="order.status === 'ACCEPTED'" class="payment-guidance">
        결제가 완료된 주문은 먼저 결제를 전액 취소해 주세요.
      </p>
      <button
        v-if="order.status === 'ACCEPTED'"
        class="primary"
        type="button"
        :disabled="completing"
        @click="$emit('complete')"
      >
        {{ completing ? '완료 확인 중…' : '주문 완료' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.order-detail {
  display: grid;
  gap: 1.25rem;
}
.order-detail header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.eyebrow {
  margin: 0 0 0.25rem;
  color: var(--color-primary);
  font-weight: 700;
}
.order-detail h1 {
  margin: 0;
  color: var(--color-heading);
}
.order-detail dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
}
.order-detail dl > div,
.contract-notice {
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  padding: 1rem;
}
.order-detail dt {
  color: var(--color-muted);
  font-size: 0.875rem;
}
.order-detail dd {
  margin: 0.25rem 0 0;
  font-weight: 750;
}
.contract-notice {
  background: #f8fafc;
}
.contract-notice h2,
.contract-notice p {
  margin: 0;
}
.contract-notice p {
  margin-top: 0.4rem;
  color: var(--color-muted);
}
.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.payment-guidance {
  margin: 0;
  color: var(--color-muted);
}
.primary,
.danger {
  border: 0;
  border-radius: 8px;
  padding: 0.65rem 1rem;
  color: white;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.primary {
  background: var(--color-primary);
}
.danger {
  background: #b91c1c;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 640px) {
  .order-detail dl {
    grid-template-columns: 1fr;
  }
}
</style>
