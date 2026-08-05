<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError } from '@/api/http'
import { useCatalogStore } from '@/stores/catalog'

const store = useCatalogStore()

const newCategoryName = ref('')
const createError = ref('')
const renamingCategoryId = ref<string | null>(null)
const renameValue = ref('')
const renameError = ref('')
const actionError = ref('')

const categories = computed(() => store.overview?.categories ?? [])
const isInitialLoading = computed(() => store.loading && !store.overview)

function validateName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 60) {
    return '카테고리명은 1~60자로 입력해 주세요.'
  }
  return ''
}

async function loadCategories(): Promise<void> {
  actionError.value = ''
  try {
    await store.load()
  } catch {
    // store.error가 화면에 표시할 오류 상태를 갖고 있다.
  }
}

async function submitCreate(): Promise<void> {
  const trimmed = newCategoryName.value.trim()
  const validation = validateName(trimmed)
  createError.value = validation
  if (validation) return

  try {
    await store.createCategory(trimmed)
    newCategoryName.value = ''
  } catch (caught) {
    createError.value = caught instanceof ApiError ? caught.detail : '카테고리를 만들지 못했습니다.'
  }
}

function startRename(categoryId: string, currentName: string): void {
  renamingCategoryId.value = categoryId
  renameValue.value = currentName
  renameError.value = ''
}

function cancelRename(): void {
  renamingCategoryId.value = null
  renameValue.value = ''
  renameError.value = ''
}

async function submitRename(categoryId: string): Promise<void> {
  const trimmed = renameValue.value.trim()
  const validation = validateName(trimmed)
  renameError.value = validation
  if (validation) return

  try {
    await store.renameCategory(categoryId, trimmed)
    cancelRename()
  } catch (caught) {
    renameError.value = caught instanceof ApiError ? caught.detail : '카테고리명을 바꾸지 못했습니다.'
  }
}

async function moveCategory(index: number, direction: -1 | 1): Promise<void> {
  const targetIndex = index + direction
  const list = categories.value
  if (targetIndex < 0 || targetIndex >= list.length) return

  const orderedIds = list.map((c) => c.categoryId)
  const [moved] = orderedIds.splice(index, 1)
  orderedIds.splice(targetIndex, 0, moved!)

  actionError.value = ''
  try {
    await store.reorderCategories(orderedIds)
  } catch (caught) {
    actionError.value = caught instanceof ApiError ? caught.detail : '순서를 바꾸지 못했습니다.'
  }
}

onMounted(() => {
  if (!store.overview) void loadCategories()
})
</script>

<template>
  <main class="category-management">
    <header>
      <h1>카테고리 관리</h1>
      <p>메뉴 카테고리를 만들고 순서를 정리합니다.</p>
      <RouterLink :to="{ name: 'catalog-history' }">변경 이력 보기</RouterLink>
    </header>

    <p v-if="isInitialLoading" class="status" role="status">카테고리를 불러오는 중입니다.</p>

    <section v-else-if="!store.overview" class="error-panel" role="alert">
      <p>{{ store.error?.detail ?? '카테고리를 불러오지 못했습니다.' }}</p>
      <button type="button" :disabled="store.loading" @click="loadCategories">다시 시도</button>
    </section>

    <template v-else>
      <form class="create-form" novalidate @submit.prevent="submitCreate">
        <label for="new-category-name">새 카테고리명</label>
        <div class="inline-field">
          <input
            id="new-category-name"
            v-model="newCategoryName"
            type="text"
            maxlength="60"
            required
            :aria-invalid="Boolean(createError)"
            :aria-describedby="createError ? 'new-category-error' : undefined"
          />
          <button type="submit" :disabled="store.loading">추가</button>
        </div>
        <p v-if="createError" id="new-category-error" class="field-error" role="alert">{{ createError }}</p>
      </form>

      <p v-if="actionError" class="submit-error" role="alert">{{ actionError }}</p>

      <ul class="category-list">
        <li v-for="(category, index) in categories" :key="category.categoryId" class="category-row">
          <div class="order-buttons">
            <button
              type="button"
              :disabled="store.loading || index === 0"
              :aria-label="`${category.name}을(를) 위로 이동`"
              @click="moveCategory(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="store.loading || index === categories.length - 1"
              :aria-label="`${category.name}을(를) 아래로 이동`"
              @click="moveCategory(index, 1)"
            >
              ↓
            </button>
          </div>

          <template v-if="renamingCategoryId === category.categoryId">
            <form class="rename-form" novalidate @submit.prevent="submitRename(category.categoryId)">
              <input
                v-model="renameValue"
                type="text"
                maxlength="60"
                required
                :aria-invalid="Boolean(renameError)"
                :aria-describedby="renameError ? `rename-error-${category.categoryId}` : undefined"
              />
              <button type="submit" :disabled="store.loading">저장</button>
              <button type="button" :disabled="store.loading" @click="cancelRename">취소</button>
              <p v-if="renameError" :id="`rename-error-${category.categoryId}`" class="field-error" role="alert">
                {{ renameError }}
              </p>
            </form>
          </template>
          <template v-else>
            <span class="category-name">{{ category.name }}</span>
            <span class="product-count">상품 {{ category.products.length }}개</span>
            <button type="button" :disabled="store.loading" @click="startRename(category.categoryId, category.name)">
              이름 변경
            </button>
            <RouterLink :to="{ name: 'product-management', query: { categoryId: category.categoryId } }">
              상품 관리
            </RouterLink>
          </template>
        </li>
      </ul>

      <p v-if="categories.length === 0" class="status">아직 카테고리가 없습니다.</p>
    </template>
  </main>
</template>

<style scoped>
.category-management {
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  margin-bottom: 2rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
}

header p {
  color: #5f6368;
}

.create-form {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 600;
}

.inline-field {
  display: flex;
  gap: 0.5rem;
}

input {
  box-sizing: border-box;
  flex: 1;
  padding: 0.6rem 0.75rem;
  border: 1px solid #b7bcc3;
  border-radius: 0.35rem;
  font: inherit;
}

input[aria-invalid='true'] {
  border-color: #b42318;
}

button {
  padding: 0.55rem 0.9rem;
  border: 1px solid #777;
  border-radius: 0.35rem;
  background: white;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.field-error,
.submit-error,
.error-panel {
  color: #b42318;
}

.error-panel {
  margin-bottom: 1rem;
  padding: 0.9rem;
  border: 1px solid #f0aaa4;
  border-radius: 0.35rem;
  background: #fff5f4;
}

.category-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e3e5e8;
}

.order-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.order-buttons button {
  padding: 0.2rem 0.5rem;
}

.category-name {
  flex: 1;
  font-weight: 600;
}

.product-count {
  color: #5f6368;
  font-size: 0.875rem;
}

.rename-form {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}
</style>
