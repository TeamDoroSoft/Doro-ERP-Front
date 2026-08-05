<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { useCatalogStore } from '@/stores/catalog'
import type { ProductBasicInfoRequest, ProductOptionEntry, ProductResponse } from '@/types/catalog'

const store = useCatalogStore()
const route = useRoute()
const router = useRouter()

const selectedCategoryId = ref<string>((route.query.categoryId as string) ?? '')
const isInitialLoading = computed(() => store.loading && !store.overview)
const categories = computed(() => store.overview?.categories ?? [])
const selectedCategory = computed(() =>
  categories.value.find((category) => category.categoryId === selectedCategoryId.value),
)
const products = computed(() => selectedCategory.value?.products ?? [])

watch(selectedCategoryId, (categoryId) => {
  void router.replace({ query: { ...route.query, categoryId: categoryId || undefined } })
})

watch(
  categories,
  (list) => {
    if (!selectedCategoryId.value && list.length > 0) {
      selectedCategoryId.value = list[0]!.categoryId
    }
  },
  { immediate: true },
)

interface FormState {
  name: string
  description: string
  basePrice: string
  imageAltText: string
  salesEnabled: boolean
  stockManaged: boolean
  mediaId: string | null
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    basePrice: '',
    imageAltText: '',
    salesEnabled: true,
    stockManaged: false,
    mediaId: null,
  }
}

const formMode = ref<'closed' | 'create' | { editingProductId: string }>('closed')
const form = reactive<FormState>(emptyForm())
const fieldErrors = reactive<Partial<Record<keyof FormState, string>>>({})
const formError = ref('')
const hasVersionConflict = ref(false)
const imageFile = ref<File | null>(null)
const imageUploadStatus = ref<'idle' | 'uploading' | 'done' | 'failed'>('idle')
const imageUploadError = ref('')
const listError = ref('')

function openCreateForm(): void {
  formMode.value = 'create'
  Object.assign(form, emptyForm())
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key as keyof FormState])
  formError.value = ''
  hasVersionConflict.value = false
  imageFile.value = null
  imageUploadStatus.value = 'idle'
  imageUploadError.value = ''
}

function openEditForm(product: ProductResponse): void {
  formMode.value = { editingProductId: product.productId }
  form.name = product.name
  form.description = product.description ?? ''
  form.basePrice = String(product.basePrice)
  form.imageAltText = product.imageAltText ?? ''
  form.salesEnabled = product.salesEnabled
  form.stockManaged = product.stockManaged
  form.mediaId = product.mediaId
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key as keyof FormState])
  formError.value = ''
  hasVersionConflict.value = false
  imageFile.value = null
  imageUploadStatus.value = 'idle'
  imageUploadError.value = ''
}

function closeForm(): void {
  formMode.value = 'closed'
}

function validateForm(): boolean {
  const errors: Partial<Record<keyof FormState, string>> = {}
  const trimmedName = form.name.trim()
  if (trimmedName.length < 1 || trimmedName.length > 100) {
    errors.name = '상품명은 1~100자로 입력해 주세요.'
  }
  if (form.description.length > 2000) {
    errors.description = '설명은 최대 2000자까지 입력할 수 있습니다.'
  }
  const price = Number(form.basePrice)
  if (!Number.isInteger(price) || price < 0) {
    errors.basePrice = '금액은 0 이상의 정수로 입력해 주세요.'
  }
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key as keyof FormState])
  Object.assign(fieldErrors, errors)
  return Object.keys(errors).length === 0
}

async function handleImageSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  imageFile.value = file
  imageUploadError.value = ''
  if (!file) return

  imageUploadStatus.value = 'uploading'
  try {
    form.mediaId = await store.uploadProductImage(file)
    imageUploadStatus.value = 'done'
  } catch (caught) {
    imageUploadStatus.value = 'failed'
    imageUploadError.value = caught instanceof ApiError ? caught.detail : '이미지 업로드에 실패했습니다.'
  }
}

async function submitForm(): Promise<void> {
  if (!validateForm()) return
  if (!selectedCategoryId.value) return

  const payload: ProductBasicInfoRequest = {
    categoryId: selectedCategoryId.value,
    name: form.name.trim(),
    description: form.description.trim() || null,
    basePrice: Number(form.basePrice),
    mediaId: form.mediaId,
    imageAltText: form.imageAltText.trim() || null,
    salesEnabled: form.salesEnabled,
    stockManaged: form.stockManaged,
  }

  formError.value = ''
  hasVersionConflict.value = false

  try {
    if (formMode.value === 'create') {
      await store.createProduct(payload)
    } else if (formMode.value !== 'closed') {
      await store.updateProduct(formMode.value.editingProductId, payload)
    }
    closeForm()
  } catch (caught) {
    if (!(caught instanceof ApiError)) {
      formError.value = '알 수 없는 오류가 발생했습니다.'
      return
    }
    if (caught.status === 409 && caught.code === 'VERSION_CONFLICT') {
      hasVersionConflict.value = true
      return
    }
    formError.value = caught.detail
  }
}

async function toggleSoldOut(product: ProductResponse): Promise<void> {
  listError.value = ''
  try {
    await store.changeSoldOut(product.productId, { soldOut: !product.soldOut })
  } catch (caught) {
    listError.value = caught instanceof ApiError ? caught.detail : '품절 상태를 바꾸지 못했습니다.'
  }
}

async function toggleSalesEnabled(product: ProductResponse): Promise<void> {
  listError.value = ''
  try {
    await store.changeSalesPolicy(product.productId, {
      salesEnabled: !product.salesEnabled,
      stockManaged: product.stockManaged,
    })
  } catch (caught) {
    listError.value = caught instanceof ApiError ? caught.detail : '판매 상태를 바꾸지 못했습니다.'
  }
}

async function moveProduct(index: number, direction: -1 | 1): Promise<void> {
  const targetIndex = index + direction
  const list = products.value
  if (targetIndex < 0 || targetIndex >= list.length || !selectedCategoryId.value) return

  const orderedIds = list.map((p) => p.productId)
  const [moved] = orderedIds.splice(index, 1)
  orderedIds.splice(targetIndex, 0, moved!)

  listError.value = ''
  try {
    await store.reorderProducts(selectedCategoryId.value, orderedIds)
  } catch (caught) {
    listError.value = caught instanceof ApiError ? caught.detail : '순서를 바꾸지 못했습니다.'
  }
}

// --- 옵션 관리 ---------------------------------------------------------------

const editingOptionsProductId = ref<string | null>(null)
const optionRows = ref<ProductOptionEntry[]>([])
const optionsError = ref('')

function openOptionsEditor(product: ProductResponse): void {
  editingOptionsProductId.value = product.productId
  optionRows.value = product.options.map((option) => ({
    optionId: option.optionId,
    name: option.name,
    additionalPrice: option.additionalPrice,
    enabled: option.enabled,
  }))
  optionsError.value = ''
}

function closeOptionsEditor(): void {
  editingOptionsProductId.value = null
  optionRows.value = []
}

function addOptionRow(): void {
  optionRows.value.push({ optionId: null, name: '', additionalPrice: 0, enabled: true })
}

function removeNewOptionRow(index: number): void {
  const row = optionRows.value[index]
  if (row && row.optionId === null) {
    optionRows.value.splice(index, 1)
  }
}

async function submitOptions(): Promise<void> {
  if (!editingOptionsProductId.value) return

  for (const row of optionRows.value) {
    const trimmed = row.name.trim()
    if (trimmed.length < 1 || trimmed.length > 100 || row.additionalPrice < 0) {
      optionsError.value = '옵션명은 1~100자, 추가 금액은 0 이상의 정수로 입력해 주세요.'
      return
    }
  }

  optionsError.value = ''
  try {
    await store.replaceProductOptions(editingOptionsProductId.value, {
      options: optionRows.value.map((row) => ({ ...row, name: row.name.trim() })),
    })
    closeOptionsEditor()
  } catch (caught) {
    optionsError.value = caught instanceof ApiError ? caught.detail : '옵션을 저장하지 못했습니다.'
  }
}

async function loadCatalog(): Promise<void> {
  try {
    await store.load()
  } catch {
    // store.error가 화면에 표시할 오류 상태를 갖고 있다.
  }
}

onMounted(() => {
  if (!store.overview) void loadCatalog()
})
</script>

<template>
  <main class="product-management">
    <header>
      <h1>상품 관리</h1>
      <p>카테고리별 상품과 옵션, 판매·품절 상태를 관리합니다.</p>
    </header>

    <p v-if="isInitialLoading" class="status" role="status">상품을 불러오는 중입니다.</p>

    <section v-else-if="!store.overview" class="error-panel" role="alert">
      <p>{{ store.error?.detail ?? '상품을 불러오지 못했습니다.' }}</p>
      <button type="button" :disabled="store.loading" @click="loadCatalog">다시 시도</button>
    </section>

    <template v-else>
      <div class="category-select">
        <label for="category-select">카테고리</label>
        <select id="category-select" v-model="selectedCategoryId">
          <option v-for="category in categories" :key="category.categoryId" :value="category.categoryId">
            {{ category.name }}
          </option>
        </select>
      </div>

      <p v-if="categories.length === 0" class="status">먼저 카테고리를 만들어 주세요.</p>

      <template v-else>
        <button type="button" class="add-button" :disabled="store.loading" @click="openCreateForm">
          + 새 상품 추가
        </button>

        <p v-if="listError" class="submit-error" role="alert">{{ listError }}</p>

        <form
          v-if="formMode !== 'closed'"
          class="product-form"
          novalidate
          @submit.prevent="submitForm"
        >
          <h2>{{ formMode === 'create' ? '새 상품' : '상품 수정' }}</h2>

          <div class="field">
            <label for="product-name">상품명</label>
            <input
              id="product-name"
              v-model="form.name"
              type="text"
              maxlength="100"
              required
              :aria-invalid="Boolean(fieldErrors.name)"
              :aria-describedby="fieldErrors.name ? 'product-name-error' : undefined"
            />
            <p v-if="fieldErrors.name" id="product-name-error" class="field-error">{{ fieldErrors.name }}</p>
          </div>

          <div class="field">
            <label for="product-description">설명</label>
            <textarea
              id="product-description"
              v-model="form.description"
              maxlength="2000"
              rows="3"
              :aria-invalid="Boolean(fieldErrors.description)"
              :aria-describedby="fieldErrors.description ? 'product-description-error' : undefined"
            />
            <p v-if="fieldErrors.description" id="product-description-error" class="field-error">
              {{ fieldErrors.description }}
            </p>
          </div>

          <div class="field">
            <label for="product-price">가격(원)</label>
            <input
              id="product-price"
              v-model="form.basePrice"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              required
              :aria-invalid="Boolean(fieldErrors.basePrice)"
              :aria-describedby="fieldErrors.basePrice ? 'product-price-error' : undefined"
            />
            <p v-if="fieldErrors.basePrice" id="product-price-error" class="field-error">
              {{ fieldErrors.basePrice }}
            </p>
          </div>

          <div class="field">
            <label for="product-image">대표 이미지</label>
            <input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" @change="handleImageSelected" />
            <p v-if="imageUploadStatus === 'uploading'" class="status" role="status">업로드 중입니다…</p>
            <p v-else-if="imageUploadStatus === 'done'" class="success" role="status">업로드 완료</p>
            <p v-else-if="imageUploadStatus === 'failed'" class="field-error" role="alert">{{ imageUploadError }}</p>
          </div>

          <div class="field">
            <label for="product-image-alt">이미지 대체 텍스트</label>
            <input id="product-image-alt" v-model="form.imageAltText" type="text" maxlength="200" />
          </div>

          <div class="field checkbox-field">
            <label>
              <input v-model="form.salesEnabled" type="checkbox" />
              판매 활성화
            </label>
          </div>

          <div class="field checkbox-field">
            <label>
              <input v-model="form.stockManaged" type="checkbox" />
              재고 관리 대상
            </label>
          </div>

          <div v-if="hasVersionConflict" class="error-panel" role="alert">
            <p>다른 곳에서 먼저 수정됐습니다. 최신 값을 다시 불러온 뒤 다시 시도해 주세요.</p>
            <button type="button" :disabled="store.loading" @click="loadCatalog">다시 불러오기</button>
          </div>
          <p v-else-if="formError" class="submit-error" role="alert">{{ formError }}</p>

          <div class="form-actions">
            <button type="submit" :disabled="store.loading">저장</button>
            <button type="button" :disabled="store.loading" @click="closeForm">취소</button>
          </div>
        </form>

        <ul class="product-list">
          <li v-for="(product, index) in products" :key="product.productId" class="product-row">
            <div class="order-buttons">
              <button
                type="button"
                :disabled="store.loading || index === 0"
                :aria-label="`${product.name}을(를) 위로 이동`"
                @click="moveProduct(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                :disabled="store.loading || index === products.length - 1"
                :aria-label="`${product.name}을(를) 아래로 이동`"
                @click="moveProduct(index, 1)"
              >
                ↓
              </button>
            </div>

            <div class="product-summary">
              <span class="product-name">{{ product.name }}</span>
              <span class="product-price">{{ product.basePrice.toLocaleString() }}원</span>
              <span v-if="product.soldOut" class="badge badge-soldout">품절</span>
              <span v-if="!product.salesEnabled" class="badge badge-disabled">판매 중지</span>
            </div>

            <div class="product-actions">
              <button type="button" :disabled="store.loading" @click="openEditForm(product)">수정</button>
              <button type="button" :disabled="store.loading" @click="openOptionsEditor(product)">옵션</button>
              <button type="button" :disabled="store.loading" @click="toggleSoldOut(product)">
                {{ product.soldOut ? '품절 해제' : '품절 처리' }}
              </button>
              <button type="button" :disabled="store.loading" @click="toggleSalesEnabled(product)">
                {{ product.salesEnabled ? '판매 중지' : '판매 재개' }}
              </button>
            </div>

            <form
              v-if="editingOptionsProductId === product.productId"
              class="options-editor"
              novalidate
              @submit.prevent="submitOptions"
            >
              <h3>옵션</h3>
              <p class="help">옵션을 없애려면 삭제하지 말고 사용 안 함으로 바꿔 주세요(기존 주문 이력 보존).</p>
              <div v-for="(option, optionIndex) in optionRows" :key="option.optionId ?? `new-${optionIndex}`" class="option-row">
                <input
                  v-model="option.name"
                  type="text"
                  maxlength="100"
                  placeholder="옵션명"
                  :aria-label="`옵션 ${optionIndex + 1} 이름`"
                />
                <input
                  v-model.number="option.additionalPrice"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="추가 금액"
                  :aria-label="`옵션 ${optionIndex + 1} 추가 금액`"
                />
                <label>
                  <input v-model="option.enabled" type="checkbox" />
                  사용
                </label>
                <button
                  v-if="option.optionId === null"
                  type="button"
                  @click="removeNewOptionRow(optionIndex)"
                >
                  제거
                </button>
              </div>
              <button type="button" @click="addOptionRow">+ 옵션 추가</button>

              <p v-if="optionsError" class="submit-error" role="alert">{{ optionsError }}</p>

              <div class="form-actions">
                <button type="submit" :disabled="store.loading">옵션 저장</button>
                <button type="button" :disabled="store.loading" @click="closeOptionsEditor">취소</button>
              </div>
            </form>
          </li>
        </ul>

        <p v-if="products.length === 0" class="status">이 카테고리에는 아직 상품이 없습니다.</p>
      </template>
    </template>
  </main>
</template>

<style scoped>
.product-management {
  width: min(100%, 880px);
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  margin-bottom: 1.5rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
}

header p {
  color: #5f6368;
}

.category-select {
  margin-bottom: 1.25rem;
}

.category-select label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 600;
}

select {
  padding: 0.55rem 0.7rem;
  border: 1px solid #b7bcc3;
  border-radius: 0.35rem;
  font: inherit;
}

.add-button {
  margin-bottom: 1rem;
}

button {
  padding: 0.55rem 0.9rem;
  border: 1px solid #777;
  border-radius: 0.35rem;
  background: white;
  font: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.field {
  margin-bottom: 1.1rem;
}

.field label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 600;
}

.checkbox-field label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
}

input[type='text'],
input[type='number'],
textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #b7bcc3;
  border-radius: 0.35rem;
  font: inherit;
}

input[aria-invalid='true'],
textarea[aria-invalid='true'] {
  border-color: #b42318;
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

.success {
  color: #18794e;
}

.help {
  color: #5f6368;
  font-size: 0.875rem;
}

.product-form,
.options-editor {
  margin: 1rem 0 1.5rem;
  padding: 1.25rem;
  border: 1px solid #e3e5e8;
  border-radius: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.product-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.product-row {
  padding: 0.9rem 0;
  border-bottom: 1px solid #e3e5e8;
}

.order-buttons {
  display: inline-flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-right: 0.75rem;
  vertical-align: top;
}

.order-buttons button {
  padding: 0.2rem 0.5rem;
}

.product-summary {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.product-name {
  font-weight: 600;
}

.product-price {
  color: #5f6368;
}

.badge {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
}

.badge-soldout {
  color: #b42318;
  background: #fff5f4;
}

.badge-disabled {
  color: #5f6368;
  background: #f1f2f4;
}

.product-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.options-editor {
  margin-top: 0.75rem;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.option-row input[type='text'] {
  flex: 2;
}

.option-row input[type='number'] {
  flex: 1;
}

.option-row label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}
</style>
