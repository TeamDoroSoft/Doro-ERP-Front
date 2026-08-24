<script setup lang="ts">
defineProps<{ title: string; description?: string; eyebrow?: string }>()
</script>

<template>
  <header class="page-header">
    <div>
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
h1 { margin-bottom: 5px; color: var(--color-heading); font-size: clamp(23px, 3vw, 28px); font-weight: 740; letter-spacing: -.025em; }
.description { margin-bottom: 0; color: var(--color-muted); }
.eyebrow { margin-bottom: 5px; color: var(--color-muted); font-size: 11px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
@media (max-width: 640px) { .page-header { flex-direction: column; } }
</style>
