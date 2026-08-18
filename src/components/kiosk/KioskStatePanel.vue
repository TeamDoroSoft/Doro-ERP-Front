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
  min-height: 320px;
  place-items: center;
  align-content: center;
  gap: 12px;
  border: 2px dashed #d8d1c5;
  border-radius: 32px;
  padding: 40px;
  background: #fff;
  text-align: center;
}
.state > strong {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: 22px;
  background: #e8f3ef;
  color: #126a5a;
  font-size: 28px;
}
.state h2 {
  font-size: 28px;
}
.state p {
  color: #68766f;
}
</style>
