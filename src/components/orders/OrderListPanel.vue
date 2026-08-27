<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { displayLabel } from '@/ui/displayLabels'
import type { OrderSourceType, OrderStatus } from '@/api/order'
import { formatInt64, type Int64String } from '@/api/int64'

export interface OrderSummary {
  orderId: string
  displayNumber: number
  totalAmount: Int64String
  currency: string
  status: OrderStatus
  businessDate: string
  sourceType?: OrderSourceType | null
  sourceDeviceNameSnapshot?: string | null
}

defineProps<{ orders: OrderSummary[] }>()
defineEmits<{ select: [orderId: string] }>()

function formatAmount(amount: Int64String, currency: string): string {
  return `${formatInt64(amount)} ${currency}`
}

function tone(status: OrderStatus) {
  return status === 'COMPLETED' ? 'success' : status === 'CANCELLED' ? 'danger' : 'warning'
}

function sourceLabel(order: OrderSummary): string {
  if (order.sourceType === 'KIOSK') {
    return order.sourceDeviceNameSnapshot ? `Kiosk · ${order.sourceDeviceNameSnapshot}` : 'Kiosk'
  }
  if (order.sourceType === 'EMPLOYEE_POS') return '직원 POS'
  return '출처 정보 없음'
}
</script>

<template>
  <div class="order-table-wrap"><table class="order-table" aria-label="주문 목록"><thead><tr><th>주문 번호</th><th>주문 생성</th><th>영업일</th><th>상태</th><th class="amount-head">결제 금액</th><th aria-label="상세" /></tr></thead><tbody><tr v-for="order in orders" :key="order.orderId" @click="$emit('select', order.orderId)"><td class="number">#{{ order.displayNumber }}</td><td><span class="source-badge" :class="{ kiosk: order.sourceType === 'KIOSK' }">{{ sourceLabel(order) }}</span></td><td class="date">{{ order.businessDate }}</td><td><StatusBadge :label="displayLabel(order.status)" :tone="tone(order.status)" /></td><td class="amount">{{ formatAmount(order.totalAmount, order.currency) }}</td><td><button type="button" class="open-order" @click.stop="$emit('select', order.orderId)">열기</button></td></tr></tbody></table></div>
</template>

<style scoped>
.order-table-wrap { overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-surface); background: var(--color-surface); }
.order-table { width: 100%; border-collapse: collapse; }
.order-table th, .order-table td { height: 48px; border-bottom: 1px solid var(--color-border); padding: 0 16px; text-align: left; font-size: 13px; }
.order-table th { height: 36px; background: var(--color-surface-subtle); color: var(--color-muted); font-size: 11px; font-weight: 750; letter-spacing: .04em; }
.order-table tbody tr { cursor: pointer; }.order-table tbody tr:hover { background: #fafafa; }.order-table tbody tr:last-child td { border-bottom: 0; }
.number {
  color: var(--color-heading);
  font-weight: 800;
}
.amount {
  font-weight: 700;
  text-align: right !important;
}
.amount-head { text-align: right !important; }.open-order { border: 0; background: transparent; color: var(--color-primary); font-size: 12px; font-weight: 700; }
.date {
  color: var(--color-muted);
  font-size: 0.875rem;
  text-align: right;
}
.source-badge { display: inline-flex; border-radius: 999px; background: #eef1f4; padding: 3px 8px; color: #4b5563; font-size: 11px; font-weight: 700; }
.source-badge.kiosk { background: #e8f6f0; color: #087f5b; }
@media (max-width: 640px) {
  .order-table { min-width: 620px; }.order-table-wrap { overflow-x: auto; }
}
</style>
