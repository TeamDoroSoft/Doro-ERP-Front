<script setup lang="ts">
defineProps<{ message: string; requestId?: string; retryable?: boolean }>()
defineEmits<{ retry: [] }>()
</script>
<template><div class="api-error" role="alert"><div><strong>문제가 발생했습니다.</strong><p>{{ message }}</p></div><button v-if="retryable" type="button" @click="$emit('retry')">다시 시도</button></div></template>
<style scoped>
.api-error { display:flex; align-items:center; justify-content:space-between; gap:16px; border-left:3px solid #c44b4b; background:#fff; padding:12px 14px; color:#7f1d1d; font-size:13px; }
.api-error strong { font-weight:700; }.api-error p { margin:2px 0 0; }.api-error small { color:#9f3b3b; }.api-error button { border:1px solid #d6b2b2; border-radius:3px; background:white; padding:7px 10px; color:#7f1d1d; font-size:12px; }
</style>
