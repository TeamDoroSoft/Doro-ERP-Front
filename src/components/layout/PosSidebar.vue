<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { navigationForRole, type PosNavigationItem } from '@/navigation/posNavigation'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const session = useOperatorSessionStore()
const items = computed(() => navigationForRole(session.role))
const groups = computed(() => {
  const byPath = new Map(items.value.map((item) => [item.to, item]))
  return [
    { label: 'OPERATIONS', paths: ['/pos/orders', '/pos/tables', '/pos/queues/entry'] },
    { label: 'CATALOG', paths: ['/pos/catalog'] },
    { label: 'FINANCIALS', paths: ['/pos/sales'] },
    { label: 'ADMIN', paths: ['/pos/settings', '/pos/history'] },
  ].map((group) => ({ label: group.label, items: group.paths.map((path) => byPath.get(path)).filter((item): item is PosNavigationItem => item !== undefined) }))
})
</script>

<template>
  <aside class="sidebar" :class="{ open }" aria-label="운영 메뉴">
    <RouterLink class="brand" to="/pos/orders" @click="$emit('close')">
      <span class="brand-mark">D</span><span class="brand-copy"><strong>Doro</strong><small>매장 운영</small></span>
    </RouterLink>
    <nav>
      <section v-for="group in groups" :key="group.label" class="nav-group">
        <p class="section-label">{{ group.label }}</p>
        <RouterLink v-for="item in group.items" :key="item.to" :to="item.to" @click="$emit('close')">
          <span class="nav-icon"><AppIcon :name="item.icon" /></span>
          <span>{{ item.label }}</span>
          <span v-if="!item.ready" class="planned">준비</span>
        </RouterLink>
      </section>
    </nav>
    <div class="sidebar-note"><span class="sync-dot" aria-hidden="true" /><div><strong>매장 운영</strong><span>권한에 따라 메뉴가 표시됩니다.</span></div></div>
  </aside>
</template>

<style scoped>
.sidebar { position:fixed; inset:0 auto 0 0; z-index:30; width:208px; border-right:1px solid #272a31; background:#1b1c20; padding:14px 10px; transition:transform .2s ease; }
.brand { display:flex; align-items:center; gap:9px; padding:4px 7px 30px; color:#fff; letter-spacing:-.02em; }
.brand-mark { display:grid; width:22px; height:22px; place-items:center; border-radius:4px; background:#009b6b; color:#fff; font-size:10px; font-weight:850; box-shadow:none; }
.brand-copy { display:grid; gap:1px; }.brand-copy strong { font-size:13px; font-weight:800; }.brand-copy small { color:#8b8d96; font-size:9px; font-weight:500; letter-spacing:.02em; }
nav { display:grid; gap:20px; }
.nav-group { display: grid; gap: 2px; }
.section-label { margin:0 8px 6px; color:#777982; font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
nav a { display:grid; grid-template-columns:18px 1fr auto; align-items:center; gap:8px; min-height:34px; border-radius:3px; padding:0 8px; color:#9b9da5; font-size:12px; font-weight:600; }
nav a:hover { background:#292b30; color:#fff; } nav a.router-link-active { background:#2d3036; color:#fff; box-shadow:inset 2px 0 0 #00a878; }
.nav-icon { font-size:14px; text-align:center; }.planned { border-radius:3px; background:#303238; padding:2px 5px; color:#92949d; font-size:9px; }
.sidebar-note { position:absolute; right:10px; bottom:14px; left:10px; display:flex; gap:7px; align-items:flex-start; border-top:1px solid #303238; padding:12px 8px 0; color:#80828b; font-size:9px; }.sidebar-note div{display:grid;gap:2px}.sidebar-note strong{color:#d5d6db;font-size:10px}.sync-dot{width:5px;height:5px;margin-top:4px;border-radius:50%;background:#00a878;box-shadow:none}
@media (max-width: 900px) { .sidebar { transform: translateX(-100%); box-shadow: 10px 0 30px rgb(15 23 42 / 12%); } .sidebar.open { transform: translateX(0); } }
</style>
