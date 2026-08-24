<script setup lang="ts">
defineEmits<{ preview: [] }>()
</script>

<template>
  <div class="preview-entry">
    <span>화면 체험</span>
    <button type="button" @click="$emit('preview')">매장 운영 화면 둘러보기</button>
    <p>로그인 없이 주요 화면을 살펴볼 수 있습니다.</p>
  </div>
</template>

<style scoped>
.preview-entry { display: grid; margin-top: 18px; border: 1px solid #c7d2fe; border-radius: 10px; background: var(--color-primary-soft); padding: 13px; text-align: center; }
.preview-entry > span { color: var(--color-primary); font-size: 9px; font-weight: 800; letter-spacing: .12em; }
.preview-entry button { min-height: 38px; border: 0; background: transparent; color: #4338ca; font-weight: 750; }
.preview-entry p { margin: 0; color: #64748b; font-size: 10px; }
</style>
