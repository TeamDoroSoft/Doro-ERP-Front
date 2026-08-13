<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { navigationForRole } from '@/navigation/adminNavigation'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const session = useOperatorSessionStore()
const items = computed(() => navigationForRole(session.role))
</script>

<template>
  <aside class="sidebar" :class="{ open }" aria-label="관리자 메뉴">
    <RouterLink class="brand" to="/admin/dashboard" @click="$emit('close')">
      <span class="brand-mark">D</span><span>Doro ERP</span>
    </RouterLink>
    <p class="section-label">매장 운영</p>
    <nav>
      <RouterLink v-for="item in items" :key="item.to" :to="item.to" @click="$emit('close')">
        <span class="nav-icon"><AppIcon :name="item.icon" /></span>
        <span>{{ item.label }}</span>
        <span v-if="!item.ready" class="planned">준비</span>
      </RouterLink>
    </nav>
    <div class="sidebar-note"><strong>운영자 화면</strong><span>권한에 따라 메뉴가 표시됩니다.</span></div>
  </aside>
</template>

<style scoped>
.sidebar { position: fixed; inset: 0 auto 0 0; z-index: 30; width: var(--sidebar-width); border-right: 1px solid var(--color-border); background: var(--color-surface); padding: 24px 16px; transition: transform .2s ease; }
.brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 28px; color: var(--color-heading); font-size: 18px; font-weight: 800; }
.brand-mark { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: var(--color-primary); color: white; font-weight: 800; }
.section-label { margin: 0 10px 8px; color: #94a3b8; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
nav { display: grid; gap: 4px; }
nav a { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 9px; min-height: 42px; border-radius: 9px; padding: 0 11px; color: #475569; font-weight: 600; }
nav a:hover, nav a.router-link-active { background: var(--color-primary-soft); color: #4338ca; }
.nav-icon { font-size: 16px; text-align: center; }
.planned { border-radius: 999px; background: #f1f5f9; padding: 2px 6px; color: #94a3b8; font-size: 10px; }
.sidebar-note { position: absolute; right: 16px; bottom: 20px; left: 16px; display: grid; gap: 3px; border: 1px solid var(--color-border); border-radius: 10px; padding: 12px; color: var(--color-muted); font-size: 12px; }
.sidebar-note strong { color: var(--color-heading); font-size: 13px; }
@media (max-width: 900px) { .sidebar { transform: translateX(-100%); box-shadow: 10px 0 30px rgb(15 23 42 / 12%); } .sidebar.open { transform: translateX(0); } }
</style>
