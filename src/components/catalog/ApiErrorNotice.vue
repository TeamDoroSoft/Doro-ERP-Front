<script setup lang="ts">
import { computed } from 'vue'
import { errorKind, fieldErrorMap, problemMessage, type CatalogErrorKind } from '@/api/catalog'

const props = defineProps<{ error: unknown }>()

const kindLabel: Record<CatalogErrorKind, string> = {
  VALIDATION: '입력 오류',
  AUTHENTICATION: '인증 오류',
  FORBIDDEN: '권한 부족',
  NOT_FOUND: '대상 없음',
  CONFLICT: '동시 수정 충돌',
  SERVER: '서버 오류',
  NETWORK: '네트워크 오류',
}

const kind = computed(() => errorKind(props.error))
const label = computed(() => kindLabel[kind.value])
const message = computed(() => problemMessage(props.error))
const fieldErrors = computed(() => Object.entries(fieldErrorMap(props.error)))
</script>

<template>
  <div v-if="props.error" class="api-error" role="alert" aria-live="assertive" data-testid="api-error">
    <p class="api-error__title">
      <span class="api-error__kind" data-testid="api-error-kind">{{ label }}</span>
      <span data-testid="api-error-message">{{ message }}</span>
    </p>
    <ul v-if="fieldErrors.length > 0" class="api-error__fields" data-testid="api-error-fields">
      <li v-for="[field, detail] in fieldErrors" :key="field">{{ field }}: {{ detail }}</li>
    </ul>
  </div>
</template>

<style scoped>
.api-error {
  border: 1px solid #d64545;
  border-left-width: 4px;
  background: #fdf2f2;
  color: #7a1f1f;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin: 0.75rem 0;
}

.api-error__title {
  margin: 0;
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.api-error__kind {
  font-weight: 700;
}

.api-error__fields {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}
</style>
