<script setup lang="ts">
defineProps<{ label: string; tone?: 'success' | 'warning' | 'danger' | 'neutral' }>()
</script>
<template><span class="status-badge" :class="tone ?? 'neutral'">{{ label }}</span></template>
<style scoped>
.status-badge { display: inline-flex; border-radius: 999px; background: #f1f5f9; padding: 4px 9px; color: #475569; font-size: 11px; font-weight: 750; }
.success { background: #ecfdf5; color: #047857; }.warning { background: #fffbeb; color: #b45309; }.danger { background: #fef2f2; color: #b91c1c; }
</style>
