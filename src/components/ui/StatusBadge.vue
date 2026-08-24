<script setup lang="ts">
defineProps<{ label: string; tone?: 'success' | 'warning' | 'danger' | 'neutral' }>()
</script>
<template><span class="status-badge" :class="tone ?? 'neutral'"><i aria-hidden="true" />{{ label }}</span></template>
<style scoped>
.status-badge { display:inline-flex; align-items:center; gap:5px; padding:0; color:#4b5563; font-size:11px; font-weight:650; }.status-badge i { width:5px; height:5px; border-radius:50%; background:#9ca3af; }.success { color:#374151; }.success i{background:#64748b}.warning { color:#7c5a10; }.warning i{background:#b7791f}.danger { color:#9b3131; }.danger i{background:#c44b4b}
</style>
