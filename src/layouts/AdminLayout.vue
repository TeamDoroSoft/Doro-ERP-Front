<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AdminHeader from '@/components/layout/AdminHeader.vue'
import AdminSidebar from '@/components/layout/AdminSidebar.vue'

const sidebarOpen = ref(false)
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false" />
    <div class="admin-workspace">
      <AdminHeader @toggle-menu="sidebarOpen = !sidebarOpen" />
      <main class="admin-main"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout { min-height: 100vh; background: var(--color-background); }
.admin-workspace { min-width: 0; margin-left: var(--sidebar-width); }
.admin-main { width: min(100%, 1440px); margin: 0 auto; padding: 32px; }
.sidebar-backdrop { position: fixed; inset: 0; z-index: 20; background: rgb(15 23 42 / 42%); }
@media (max-width: 900px) {
  .admin-workspace { margin-left: 0; }
  .admin-main { padding: 24px 18px; }
}
</style>
