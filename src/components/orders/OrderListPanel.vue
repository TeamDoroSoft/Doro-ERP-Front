<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { displayLabel } from '@/ui/displayLabels'
import type { OrderStatus } from '@/api/order'
import { formatInt64, type Int64String } from '@/api/int64'

export interface OrderSummary {
  orderId: string
  displayNumber: number
  totalAmount: Int64String
  currency: string
  status: OrderStatus
  businessDate: string
}

defineProps<{ orders: OrderSummary[] }>()
defineEmits<{ select: [orderId: string] }>()

function formatAmount(amount: Int64String, currency: string): string {
  return `${formatInt64(amount)} ${currency}`
}

function tone(status: OrderStatus) {
  return status === 'COMPLETED' ? 'success' : status === 'CANCELLED' ? 'danger' : 'warning'
}
</script>

<template>
  <ul class="order-list" aria-label="주문 목록">
    <li v-for="order in orders" :key="order.orderId">
      <button type="button" class="order-card" @click="$emit('select', order.orderId)">
        <span class="number">#{{ order.displayNumber }}</span>
        <span class="amount">{{ formatAmount(order.totalAmount, order.currency) }}</span>
        <StatusBadge :label="displayLabel(order.status)" :tone="tone(order.status)" />
        <span class="date">영업일 {{ order.businessDate }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.order-list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.order-card {
  display: grid;
  grid-template-columns: minmax(4rem, 0.6fr) minmax(8rem, 1fr) auto minmax(8rem, 0.8fr);
  align-items: center;
  width: 100%;
  gap: 1rem;
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  background: white;
  padding: 1rem;
  text-align: left;
  color: inherit;
  cursor: pointer;
}
.order-card:hover,
.order-card:focus-visible {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
.number {
  color: var(--color-heading);
  font-weight: 800;
}
.amount {
  font-weight: 700;
}
.date {
  color: var(--color-muted);
  font-size: 0.875rem;
  text-align: right;
}
@media (max-width: 640px) {
  .order-card {
    grid-template-columns: 1fr auto;
  }
  .date {
    grid-column: 1 / -1;
    text-align: left;
  }
}
</style>
