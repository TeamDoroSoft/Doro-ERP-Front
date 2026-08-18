<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import PosHeader from '@/components/layout/PosHeader.vue'
import PosSidebar from '@/components/layout/PosSidebar.vue'

const sidebarOpen = ref(false)
const route = useRoute()
const router = useRouter()

const routeFeedback = computed(() => {
  if (route.query.reason === 'forbidden') {
    return '현재 계정으로는 요청한 화면에 접근할 수 없습니다.'
  }
  if (route.query.reason === 'not-found') {
    return '요청한 화면을 찾을 수 없어 주문 화면으로 이동했습니다.'
  }
  return ''
})

async function dismissRouteFeedback() {
  const query = { ...route.query }
  delete query.reason
  await router.replace({ query })
}
</script>

<template>
  <div class="pos-layout">
    <PosSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false" />
    <div class="pos-workspace">
      <PosHeader @toggle-menu="sidebarOpen = !sidebarOpen" />
      <main class="pos-main">
        <div v-if="routeFeedback" class="route-feedback" role="status">
          <p>{{ routeFeedback }}</p>
          <button type="button" aria-label="안내 닫기" @click="dismissRouteFeedback">닫기</button>
        </div>
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.pos-layout { min-height: 100vh; background: var(--color-background); }
.pos-workspace { min-width: 0; margin-left: var(--sidebar-width); }
.pos-main { width: min(100%, 1440px); margin: 0 auto; padding: 32px; }
.route-feedback { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; border: 1px solid #fed7aa; border-radius: 10px; background: #fff7ed; padding: 12px 14px; color: #9a3412; font-size: 13px; }
.route-feedback p { margin: 0; }
.route-feedback button { border: 0; border-radius: 7px; background: transparent; padding: 5px 8px; color: inherit; font-weight: 700; }
.route-feedback button:hover { background: #ffedd5; }
.sidebar-backdrop { position: fixed; inset: 0; z-index: 20; background: rgb(15 23 42 / 42%); }
@media (max-width: 900px) {
  .pos-workspace { margin-left: 0; }
  .pos-main { padding: 24px 18px; }
}
</style>
