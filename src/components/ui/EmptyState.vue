<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'
defineProps<{ title: string; description: string }>()
</script>

<template>
  <div class="empty-state">
    <span><AppIcon name="dashboard" :size="20" /></span><strong>{{ title }}</strong><p>{{ description }}</p><slot />
  </div>
</template>

<style scoped>
.empty-state { display:grid; min-height:180px; place-items:center; align-content:center; border-top:1px solid var(--color-border); border-bottom:1px solid var(--color-border); padding:24px; text-align:center; }
.empty-state > span { display:grid; width:28px; height:28px; place-items:center; border-radius:4px; background:var(--color-primary-soft); color:var(--color-primary); font-size:16px; }
.empty-state strong { margin-top: 12px; color: var(--color-heading); }
.empty-state p { max-width: 440px; margin: 6px 0 0; color: var(--color-muted); font-size: 13px; }
</style>
