<script setup lang="ts">
defineProps<{ title: string; message: string; kind?: 'loading' | 'empty' | 'error' }>()
</script>
<template>
  <section class="state" role="status">
    <strong>{{ kind === 'loading' ? '···' : kind === 'error' ? '!' : '○' }}</strong>
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <slot />
  </section>
</template>
<style scoped>
.state {
  display: grid;
  min-height: 300px;
  place-items: center;
  align-content: center;
  gap: 12px;
  border: 1px dashed #c6cfca;
  border-radius: 6px;
  padding: 40px;
  background: #fff;
  text-align: center;
}
.state > strong {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: 5px;
  background: #edf3ef;
  color: #087f5b;
  font-size: 28px;
}
.state h2 { margin: 0; font-size: 24px; }
.state p {
  color: #68766f;
}
</style>
