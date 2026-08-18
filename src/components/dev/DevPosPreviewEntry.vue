<script setup lang="ts">
defineEmits<{ preview: [] }>()
</script>

<template>
  <div class="preview-entry">
    <span>개발 환경 전용</span>
    <button type="button" @click="$emit('preview')">POS 화면 미리보기</button>
    <p>로그인 없이 POS 화면 구성을 확인합니다.</p>
  </div>
</template>

<style scoped>
.preview-entry { display: grid; margin-top: 18px; border: 1px solid #c7d2fe; border-radius: 10px; background: var(--color-primary-soft); padding: 13px; text-align: center; }
.preview-entry > span { color: var(--color-primary); font-size: 9px; font-weight: 800; letter-spacing: .12em; }
.preview-entry button { min-height: 38px; border: 0; background: transparent; color: #4338ca; font-weight: 750; }
.preview-entry p { margin: 0; color: #64748b; font-size: 10px; }
</style>
