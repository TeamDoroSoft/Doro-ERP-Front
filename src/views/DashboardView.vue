<script setup lang="ts">
import { useRouter } from 'vue-router'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SummaryCard from '@/components/ui/SummaryCard.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const summaries = [
  { label: '오늘 주문', value: '연동 준비 중', note: '연동 후 주문 건수를 확인할 수 있습니다.', tone: 'primary' as const, icon: 'orders' },
  { label: '진행 중 주문', value: '연동 준비 중', note: 'CREATED·ACCEPTED 집계', tone: 'warning' as const, icon: 'queue' },
  { label: '활성 테이블', value: '테이블에서 확인', note: '기존 Table 관리 화면 연결됨', tone: 'success' as const, icon: 'tables' },
  { label: '결제 현황', value: '연동 준비 중', note: '연동 후 결제 현황을 확인할 수 있습니다.', tone: 'muted' as const, icon: 'payment' },
]
</script>

<template>
  <section>
    <PageHeader title="대시보드" description="매장 운영 현황을 한눈에 확인합니다." eyebrow="운영 요약">
      <template #actions><StatusBadge label="관리 화면" tone="success" /></template>
    </PageHeader>
    <div class="summary-grid">
      <SummaryCard v-for="item in summaries" :key="item.label" v-bind="item"><template #icon><AppIcon :name="item.icon" /></template></SummaryCard>
    </div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-heading"><div><h2>운영 현황</h2><p>연동 후 실제 운영 수치를 확인할 수 있습니다.</p></div><StatusBadge label="연동 준비 중" tone="warning" /></div>
        <EmptyState title="운영 현황을 준비하고 있습니다" description="연동이 완료되면 주문과 조리 현황을 확인할 수 있습니다." />
      </section>
      <aside class="panel quick-actions">
        <div class="panel-heading"><div><h2>빠른 이동</h2><p>현재 사용할 수 있는 화면으로 이동합니다.</p></div></div>
        <button type="button" @click="router.push('/admin/tables')"><span><AppIcon name="tables" /></span><div><strong>테이블 관리</strong><small>활성 테이블 조회 및 관리</small></div><b>›</b></button>
        <RouterLink to="/payments/test"><span><AppIcon name="payment" /></span><div><strong>토스 테스트 결제</strong><small>직원용 테스트 결제</small></div><b>›</b></RouterLink>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.dashboard-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 18px; margin-top: 18px; }
.panel { border: 1px solid var(--color-border); border-radius: 14px; background: white; padding: 22px; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
.panel h2 { margin-bottom: 3px; color: var(--color-heading); font-size: 17px; font-weight: 750; }.panel p { margin-bottom: 0; color: var(--color-muted); font-size: 13px; }
.quick-actions { align-self: start; }.quick-actions button, .quick-actions a { display: grid; width: 100%; grid-template-columns: 34px 1fr auto; align-items: center; gap: 12px; border: 1px solid var(--color-border); border-radius: 10px; background: white; padding: 13px; color: var(--color-text); text-align: left; }.quick-actions button + a { margin-top: 9px; }.quick-actions button:hover, .quick-actions a:hover { border-color: #c7d2fe; background: var(--color-primary-soft); }.quick-actions div { display: grid; }.quick-actions strong { color: var(--color-heading); font-size: 13px; font-weight: 700; }.quick-actions small { color: var(--color-muted); }.quick-actions b { color: var(--color-primary); font-size: 20px; }
@media (max-width: 1150px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .summary-grid, .dashboard-grid { grid-template-columns: 1fr; } }
</style>
