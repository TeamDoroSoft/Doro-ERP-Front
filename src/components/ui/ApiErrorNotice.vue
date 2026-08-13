<script setup lang="ts">
defineProps<{ message: string; requestId?: string; retryable?: boolean }>()
defineEmits<{ retry: [] }>()
</script>
<template><div class="api-error" role="alert"><div><strong>요청을 처리하지 못했습니다.</strong><p>{{ message }}</p><small v-if="requestId">요청 ID: {{ requestId }}</small></div><button v-if="retryable" type="button" @click="$emit('retry')">다시 시도</button></div></template>
<style scoped>
.api-error { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid #fecaca; border-radius: 10px; background: #fef2f2; padding: 14px 16px; color: #991b1b; }
.api-error strong { font-weight: 750; }.api-error p { margin: 2px 0 0; }.api-error small { color: #b91c1c; }.api-error button { border: 1px solid #fca5a5; border-radius: 8px; background: white; padding: 8px 12px; color: #991b1b; }
</style>
