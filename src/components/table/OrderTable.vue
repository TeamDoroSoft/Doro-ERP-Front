<script setup lang="ts">
import type { TableOrderSummaryResponse } from '@/api/table'

defineProps<{
  orders: TableOrderSummaryResponse[]
}>()

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatAmount(value: string, currency: string) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currency || 'KRW',
  }).format(Number(value))
}

function itemSummary(order: TableOrderSummaryResponse) {
  if (order.items.length === 0) {
    return '-'
  }
  const first = order.items[0]!
  const extra = order.items.length > 1 ? ` 외 ${order.items.length - 1}` : ''
  return `${first.productName} ${first.quantity}개${extra}`
}
</script>

<template>
  <div class="order-table-wrap">
    <p v-if="orders.length === 0" class="empty-state">조회된 주문이 없습니다.</p>
    <table v-else class="order-table">
      <thead>
        <tr>
          <th scope="col">주문 번호</th>
          <th scope="col">주문 시각</th>
          <th scope="col">상태</th>
          <th scope="col">금액</th>
          <th scope="col">결제</th>
          <th scope="col">상품</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in orders" :key="order.orderId">
          <td>{{ order.orderNumber }}</td>
          <td>{{ formatDate(order.createdAt) }}</td>
          <td>{{ order.status }}</td>
          <td>{{ formatAmount(order.totalAmount, order.currency) }}</td>
          <td>{{ order.paymentStatus }}</td>
          <td>{{ itemSummary(order) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
