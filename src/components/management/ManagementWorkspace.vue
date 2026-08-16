<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { WorkspaceDefinition } from '@/views/management/workspaceDefinitions'
import { useOperatorSessionStore } from '@/stores/operatorSession'

const props = defineProps<{ definition: WorkspaceDefinition }>()
const session = useOperatorSessionStore()
const activeTab = ref(props.definition.tabs?.[0] ?? '')
const drawerOpen = ref(false)
const filtersApplied = ref(false)
const canAccess = computed(() => session.role !== null && props.definition.accessRoles.includes(session.role))
const canUsePrimaryAction = computed(() =>
  Boolean(session.role && props.definition.primaryAction?.roles.includes(session.role)),
)

function applyFilters() {
  filtersApplied.value = true
}

function resetFilters(event: Event) {
  const form = (event.currentTarget as HTMLElement).closest('form')
  form?.reset()
  filtersApplied.value = false
}

function optionValue(option: string | { value: string; label: string }) {
  return typeof option === 'string' ? option : option.value
}

function optionLabel(option: string | { value: string; label: string }) {
  return typeof option === 'string' ? option : option.label
}
</script>

<template>
  <section class="workspace">
    <PageHeader :title="definition.title" :description="definition.description" :eyebrow="definition.eyebrow">
      <template #actions>
        <button
          v-if="definition.primaryAction"
          class="primary-button"
          type="button"
          :disabled="!canUsePrimaryAction"
          :title="canUsePrimaryAction ? '' : '현재 계정에는 이 작업 권한이 없습니다.'"
          @click="drawerOpen = true"
        >
          {{ definition.primaryAction.label }}
        </button>
      </template>
    </PageHeader>

    <div v-if="!canAccess" class="permission-card">
      <span aria-hidden="true">!</span>
      <h2>이 기능에 접근할 권한이 없습니다</h2>
      <p>현재 계정으로는 이 화면을 이용할 수 없습니다.</p>
    </div>

    <template v-else>
      <div class="contract-banner">
        <strong>이용 안내</strong>
        <p>{{ definition.contractNote }}</p>
        <StatusBadge label="연동 준비 중" tone="warning" />
      </div>

      <div v-if="definition.tabs" class="tabs" role="tablist" :aria-label="`${definition.title} 보기`">
        <button
          v-for="tab in definition.tabs"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >{{ tab }}</button>
      </div>

      <section class="workflow-card" aria-label="업무 흐름">
        <div><span>업무 흐름</span><h2>{{ definition.workflowTitle }}</h2></div>
        <ol><li v-for="(step, index) in definition.workflow" :key="step"><b>{{ index + 1 }}</b><span>{{ step }}</span></li></ol>
      </section>

      <form class="filter-card" aria-label="목록 필터" @submit.prevent="applyFilters">
        <div class="filter-heading"><div><h2>조회 조건</h2><p>필요한 조건을 선택해 조회하세요.</p></div><button type="button" @click="resetFilters">초기화</button></div>
        <div class="filter-fields" :class="{ empty: definition.filters.length === 0 }">
          <template v-if="definition.filters.length">
            <label v-for="field in definition.filters" :key="field.label">
              <span>{{ field.label }}</span>
              <select v-if="field.type === 'select'" :aria-label="field.label">
                <option v-for="option in field.options" :key="optionValue(option)" :value="optionValue(option)">{{ optionLabel(option) }}</option>
              </select>
              <input v-else :type="field.type ?? 'text'" :placeholder="field.placeholder" :aria-label="field.label" />
            </label>
            <button class="filter-button" type="submit">조회</button>
          </template>
          <p v-else>로그인한 매장을 기준으로 정보를 표시합니다.</p>
        </div>
        <p v-if="filtersApplied" class="filter-feedback" role="status">선택한 조회 조건을 적용했습니다.</p>
      </form>

      <section class="data-card">
        <header><div><h2>{{ activeTab || definition.title }} 목록</h2><p>연동 후 실제 내역을 확인할 수 있습니다.</p></div><div class="status-list"><StatusBadge v-for="status in definition.statuses" :key="status.label" :label="status.label" :tone="status.tone" /></div></header>
        <div class="table-scroll">
          <table><thead><tr><th v-for="column in definition.columns" :key="column">{{ column }}</th></tr></thead></table>
        </div>
        <EmptyState :title="definition.emptyTitle" :description="definition.emptyDescription" />
      </section>
    </template>

    <div v-if="drawerOpen && definition.primaryAction" class="drawer-backdrop" @click.self="drawerOpen = false">
      <aside class="action-drawer" :aria-label="definition.primaryAction.title">
        <header><div><p>{{ definition.eyebrow }}</p><h2>{{ definition.primaryAction.title }}</h2></div><button type="button" aria-label="닫기" @click="drawerOpen = false">×</button></header>
        <div class="drawer-content">
          <p>{{ definition.primaryAction.description }}</p>
          <form>
            <label v-for="field in definition.primaryAction.fields" :key="field.label">
              <span>{{ field.label }}</span>
              <select v-if="field.type === 'select'" :aria-label="field.label"><option value="">{{ field.placeholder }}</option><option v-for="option in field.options" :key="optionValue(option)" :value="optionValue(option)">{{ optionLabel(option) }}</option></select>
              <input v-else :type="field.type ?? 'text'" :placeholder="field.placeholder" :aria-label="field.label" />
            </label>
          </form>
          <div class="drawer-notice"><strong>저장 기능 준비 중</strong><p>현재는 내용을 미리 확인할 수 있으며 저장은 지원하지 않습니다.</p></div>
        </div>
        <footer><button type="button" @click="drawerOpen = false">취소</button><button type="button" disabled>저장</button></footer>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.workspace { display: grid; gap: 18px; }.primary-button,.filter-button { min-height: 40px; border: 1px solid var(--color-primary); border-radius: 9px; background: var(--color-primary); padding: 0 16px; color: white; font-weight: 700; }.primary-button:hover:not(:disabled),.filter-button:hover { background: #4338ca; }.primary-button:disabled { cursor: not-allowed; opacity: .5; }.contract-banner { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; border: 1px solid #fde68a; border-radius: 11px; background: #fffbeb; padding: 12px 15px; }.contract-banner strong { color: #92400e; font-size: 12px; }.contract-banner p { margin: 0; color: #78716c; font-size: 12px; }.tabs { display: flex; gap: 4px; width: fit-content; border: 1px solid var(--color-border); border-radius: 10px; background: white; padding: 4px; }.tabs button { min-height: 34px; border: 0; border-radius: 7px; background: transparent; padding: 0 14px; color: var(--color-muted); font-weight: 650; }.tabs button.active { background: var(--color-primary-soft); color: var(--color-primary); }.workflow-card,.filter-card,.data-card,.permission-card { border: 1px solid var(--color-border); border-radius: 14px; background: white; padding: 20px 22px; }.workflow-card { display: grid; grid-template-columns: 180px 1fr; align-items: center; gap: 20px; }.workflow-card > div > span { color: var(--color-primary); font-size: 10px; font-weight: 800; letter-spacing: .1em; }.workflow-card h2,.filter-heading h2,.data-card h2 { margin: 3px 0 0; color: var(--color-heading); font-size: 16px; font-weight: 760; }.workflow-card ol { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 0; margin: 0; padding: 0; list-style: none; }.workflow-card li { position: relative; display: flex; align-items: center; gap: 8px; color: var(--color-text); font-size: 11px; font-weight: 650; }.workflow-card li:not(:last-child)::after { width: 100%; height: 1px; margin-left: 4px; background: #dbe3ef; content: ''; }.workflow-card b { display: grid; flex: 0 0 25px; height: 25px; place-items: center; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); font-size: 10px; }.workflow-card li span { white-space: nowrap; }.filter-heading,.data-card > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }.filter-heading p,.data-card header p { margin: 4px 0 0; color: var(--color-muted); font-size: 12px; }.filter-heading button { border: 1px solid var(--color-border); border-radius: 8px; background: white; padding: 8px 12px; color: var(--color-text); font-weight: 650; }.filter-fields { display: flex; align-items: end; gap: 12px; }.filter-fields label,.drawer-content label { display: grid; flex: 1; gap: 6px; min-width: 0; color: var(--color-heading); font-size: 11px; font-weight: 700; }.filter-fields input,.filter-fields select,.drawer-content input,.drawer-content select { width: 100%; min-height: 41px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; padding: 0 10px; color: var(--color-heading); }.filter-fields.empty p { margin: 0; color: var(--color-muted); font-size: 12px; }.filter-feedback { margin: 10px 0 0; color: var(--color-primary); font-size: 12px; }.status-list { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }.table-scroll { overflow-x: auto; }table { width: 100%; min-width: 760px; border-collapse: collapse; }th { border-bottom: 1px solid var(--color-border); background: #f8fafc; padding: 11px 13px; color: var(--color-muted); font-size: 11px; font-weight: 750; text-align: left; }.data-card :deep(.empty-state) { min-height: 210px; border-top: 0; border-radius: 0 0 12px 12px; }.permission-card { display: grid; min-height: 380px; place-items: center; align-content: center; text-align: center; }.permission-card > span { display: grid; width: 50px; height: 50px; place-items: center; border-radius: 13px; background: #fef2f2; color: var(--color-danger); font-weight: 800; }.permission-card h2 { margin: 15px 0 4px; color: var(--color-heading); font-size: 18px; }.permission-card p { max-width: 480px; color: var(--color-muted); }.drawer-backdrop { position: fixed; inset: 0; z-index: 60; background: rgb(15 23 42 / 38%); }.action-drawer { position: absolute; inset: 0 0 0 auto; display: grid; grid-template-rows: auto 1fr auto; width: min(100%,480px); overflow-y: auto; background: white; box-shadow: -18px 0 50px rgb(15 23 42 / 13%); }.action-drawer > header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding: 22px 24px; }.action-drawer header p { margin: 0 0 3px; color: var(--color-primary); font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }.action-drawer h2 { margin: 0; color: var(--color-heading); font-size: 20px; }.action-drawer header button { width: 34px; height: 34px; border: 1px solid var(--color-border); border-radius: 8px; background: white; font-size: 20px; }.drawer-content { padding: 24px; }.drawer-content > p { margin: 0 0 20px; color: var(--color-muted); font-size: 13px; }.drawer-content form { display: grid; gap: 14px; }.drawer-notice { margin-top: 22px; border-radius: 10px; background: #f8fafc; padding: 14px; }.drawer-notice strong { color: var(--color-heading); font-size: 12px; }.drawer-notice p { margin: 4px 0 0; color: var(--color-muted); font-size: 12px; }.action-drawer footer { display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--color-border); padding: 16px 24px; }.action-drawer footer button { min-height: 39px; border: 1px solid var(--color-border); border-radius: 8px; background: white; padding: 0 16px; font-weight: 650; }.action-drawer footer button:last-child { border-color: var(--color-primary); background: var(--color-primary); color: white; opacity: .5; }
@media (max-width: 1024px) { .workflow-card { grid-template-columns: 1fr; }.filter-fields { flex-wrap: wrap; }.filter-fields label { flex-basis: calc(50% - 12px); }.filter-button { flex: 1; }.workflow-card ol { overflow-x: auto; padding-bottom: 4px; }.workflow-card li { min-width: 150px; } }
@media (max-width: 640px) { .contract-banner { grid-template-columns: 1fr; }.workflow-card,.filter-card,.data-card { padding: 17px; }.filter-heading,.data-card > header { flex-direction: column; }.filter-fields { display: grid; }.filter-fields label { width: 100%; }.status-list { justify-content: flex-start; }.action-drawer { width: 100%; } }
</style>
