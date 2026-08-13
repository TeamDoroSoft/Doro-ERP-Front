<script setup lang="ts">
defineProps<{ label: string; value: string; note: string; tone?: 'primary' | 'success' | 'warning' | 'muted' }>()
</script>

<template>
  <article class="summary-card">
    <div class="summary-icon" :class="tone ?? 'muted'" aria-hidden="true"><slot name="icon">·</slot></div>
    <div><p>{{ label }}</p><strong>{{ value }}</strong><span>{{ note }}</span></div>
  </article>
</template>

<style scoped>
.summary-card { display: flex; min-height: 142px; gap: 15px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); padding: 20px; }
.summary-icon { display: grid; width: 40px; height: 40px; flex: 0 0 40px; place-items: center; border-radius: 10px; background: #f1f5f9; color: var(--color-muted); font-weight: 800; }
.summary-icon.primary { background: var(--color-primary-soft); color: var(--color-primary); }
.summary-icon.success { background: #ecfdf5; color: var(--color-success); }
.summary-icon.warning { background: #fffbeb; color: var(--color-warning); }
p { margin-bottom: 7px; color: var(--color-muted); font-size: 13px; font-weight: 650; }
strong, span { display: block; }
strong { color: var(--color-heading); font-size: 20px; font-weight: 800; }
span { margin-top: 8px; color: #94a3b8; font-size: 11px; }
</style>
