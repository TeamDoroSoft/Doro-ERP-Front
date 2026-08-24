<script setup lang="ts">
type PreviewState = 'normal' | 'loading' | 'empty' | 'error'

const state = defineModel<PreviewState>({ required: true })
</script>

<template>
  <details class="preview-drawer">
    <summary>화면 상태 확인</summary>
    <label>
      표시 상태
      <select v-model="state">
        <option value="normal">정상</option>
        <option value="loading">불러오는 중</option>
        <option value="empty">목록 없음</option>
        <option value="error">오류</option>
      </select>
    </label>
  </details>
</template>

<style scoped>
.preview-drawer {
  margin-top: auto;
  border-top: 1px solid #303238;
  padding: 12px 8px 0;
  color: #80828b;
  font-size: 11px;
}
.preview-drawer summary { cursor: pointer; }
.preview-drawer label { display: grid; gap: 5px; margin-top: 8px; }
.preview-drawer select {
  min-height: 28px;
  border: 1px solid #3a3c43;
  border-radius: 3px;
  background: #282a30;
  color: #d9dade;
  font-size: 11px;
}
@media (max-width: 760px) { .preview-drawer { display: none; } }
</style>
