<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { formatCurrencyInt64 } from '@/api/int64'
import type { ManagedCategoryResponse, ManagedProductResponse } from '@/api/catalog'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useCatalogManagement } from '@/composables/useCatalogManagement'

const catalog = useCatalogManagement()
const categoryEditor = ref<ManagedCategoryResponse | null | undefined>()
const productEditor = ref<ManagedProductResponse | null | undefined>()
const categoryNameInput = ref<HTMLInputElement>()
const productCategoryInput = ref<HTMLSelectElement>()

onMounted(catalog.load)
watch(catalog.selectedCategoryId, (value) => {
  if (!productEditor.value) catalog.productDraft.categoryId = value
  if (productEditor.value === null) productEditor.value = undefined
})

async function openCategory(item: ManagedCategoryResponse | null) {
  productEditor.value = undefined
  categoryEditor.value = item
  if (item) catalog.editCategory(item)
  else catalog.resetCategoryDraft()
  await nextTick()
  categoryNameInput.value?.focus()
}
async function openProduct(item: ManagedProductResponse | null) {
  categoryEditor.value = undefined
  productEditor.value = item
  if (item) catalog.editProduct(item)
  else catalog.resetProductDraft()
  await nextTick()
  productCategoryInput.value?.focus()
}
async function submitCategory() { await catalog.saveCategory(categoryEditor.value ?? undefined); if (!catalog.errorMessage.value) categoryEditor.value = undefined }
async function submitProduct() { if (await catalog.saveProduct(productEditor.value ?? undefined)) productEditor.value = undefined }
const money = (value: string) => formatCurrencyInt64(value, 'KRW')
</script>

<template>
  <main class="catalog-page">
    <header class="page-heading">
      <div class="page-title"><span class="page-icon"><AppIcon name="catalog" :size="22" /></span><div><p>상품 관리</p><h1>상품·메뉴 관리</h1><span>메뉴 분류와 상품의 판매 상태를 관리합니다.</span></div></div>
      <button type="button" :disabled="catalog.loading.value" @click="catalog.load">새로고침</button>
    </header>
    <p v-if="catalog.notice.value" class="notice" role="status">{{ catalog.notice.value }}</p>
    <ApiErrorNotice v-if="catalog.error.value" :message="catalog.errorMessage.value" :code="catalog.error.value.code" :request-id="catalog.error.value.requestId" retryable @retry="catalog.load" />
    <LoadingState v-if="catalog.loading.value" />
    <template v-else>
      <section class="catalog-card category-panel" aria-labelledby="category-list-title">
        <div class="section-heading"><div><div class="title-row"><h2 id="category-list-title">메뉴 분류</h2><span class="count" aria-label="메뉴 분류 수">{{ catalog.categories.value.length }}</span></div><p>분류를 선택하면 해당 상품을 확인할 수 있습니다.</p></div><button v-if="catalog.canManage.value" class="primary" type="button" aria-controls="category-editor" :aria-expanded="categoryEditor !== undefined" @click="openCategory(null)">분류 등록</button></div>

        <section v-if="categoryEditor !== undefined && catalog.canManage.value" id="category-editor" class="editor editor-panel" aria-labelledby="category-editor-title">
          <div class="editor-heading"><div><p class="eyebrow">{{ categoryEditor ? '선택한 분류 편집' : '새 분류 만들기' }}</p><h3 id="category-editor-title">{{ categoryEditor ? '메뉴 분류 수정' : '메뉴 분류 등록' }}</h3></div><button type="button" aria-label="메뉴 분류 편집 닫기" @click="categoryEditor = undefined">닫기</button></div>
          <form @submit.prevent="submitCategory">
            <div class="featured-field"><label for="category-name">분류명</label><p id="category-name-help">고객과 직원이 메뉴를 찾을 때 표시되는 이름입니다.</p><input id="category-name" ref="categoryNameInput" v-model="catalog.categoryDraft.name" maxlength="100" aria-describedby="category-name-help" placeholder="예: 커피" /></div>
            <label for="category-order">표시 순서<input id="category-order" v-model.number="catalog.categoryDraft.displayOrder" type="number" min="0" max="9999" /></label>
            <label class="check"><input v-model="catalog.categoryDraft.active" type="checkbox" /> 운영 중</label>
            <div class="form-actions"><button type="button" @click="categoryEditor = undefined">취소</button><button class="primary" type="submit" :disabled="!!catalog.busyId.value">저장</button></div>
          </form>
        </section>

        <div v-if="catalog.categories.value.length === 0" class="empty" role="status"><strong>등록된 메뉴 분류가 없습니다.</strong><span v-if="catalog.canManage.value">첫 분류를 등록해 상품을 구성해 보세요.</span></div>
        <ul v-else class="category-list"><li v-for="item in catalog.categories.value" :key="item.categoryId" :class="{ selected: catalog.selectedCategoryId.value === item.categoryId }"><button type="button" class="category-select" :aria-pressed="catalog.selectedCategoryId.value === item.categoryId" @click="catalog.selectedCategoryId.value = item.categoryId"><strong>{{ item.name }}</strong><span>표시 순서 {{ item.displayOrder }}</span><span class="status" :class="{ inactive: !item.active }">{{ item.active ? '운영 중' : '이용 중지' }}</span></button><div v-if="catalog.canManage.value" class="actions" aria-label="분류 작업"><button type="button" @click="openCategory(item)">수정</button><button type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleCategory(item)">{{ item.active ? '이용 중지' : '이용 재개' }}</button></div></li></ul>
      </section>

      <section class="catalog-card product-panel" aria-labelledby="product-list-title">
        <div class="section-heading"><div><div class="title-row"><h2 id="product-list-title">상품 목록</h2><span v-if="catalog.selectedCategoryId.value" class="count" aria-label="선택한 분류의 상품 수">{{ catalog.selectedProducts.value.length }}</span></div><p>선택한 메뉴 분류의 판매 상태와 가격을 관리합니다.</p></div><button v-if="catalog.canManage.value && catalog.selectedCategoryId.value" class="primary" type="button" aria-controls="product-editor" :aria-expanded="productEditor !== undefined" @click="openProduct(null)">상품 등록</button></div>

        <section v-if="productEditor !== undefined && catalog.canManage.value" id="product-editor" class="editor editor-panel" aria-labelledby="product-editor-title">
          <div class="editor-heading"><div><p class="eyebrow">{{ productEditor ? '선택한 상품 편집' : '새 상품 만들기' }}</p><h3 id="product-editor-title">{{ productEditor ? '상품 수정' : '상품 등록' }}</h3></div><button type="button" aria-label="상품 편집 닫기" @click="productEditor = undefined">닫기</button></div>
          <form @submit.prevent="submitProduct">
            <label>메뉴 분류<select ref="productCategoryInput" v-model="catalog.productDraft.categoryId"><option v-for="item in catalog.categories.value" :key="item.categoryId" :value="item.categoryId">{{ item.name }}</option></select></label>
            <label>상품명<input v-model="catalog.productDraft.name" maxlength="100" /></label><label class="wide">설명<input v-model="catalog.productDraft.description" maxlength="500" /></label><label>가격<input v-model="catalog.productDraft.price" inputmode="numeric" pattern="(0|[1-9]\d*)" maxlength="9" /></label><label>표시 순서<input v-model.number="catalog.productDraft.displayOrder" type="number" min="0" max="9999" /></label><label class="check"><input v-model="catalog.productDraft.active" type="checkbox" /> 판매 중</label>
            <div class="form-actions"><button type="button" @click="productEditor = undefined">취소</button><button class="primary" type="submit" :disabled="!!catalog.busyId.value">저장</button></div>
          </form>
        </section>

        <div v-if="!catalog.selectedCategoryId.value" class="empty" role="status"><strong>메뉴 분류를 선택해 주세요.</strong><span>왼쪽 목록에서 상품을 확인할 분류를 선택하세요.</span></div>
        <div v-else-if="catalog.selectedProducts.value.length === 0" class="empty" role="status"><strong>선택한 분류에 등록된 상품이 없습니다.</strong><span v-if="catalog.canManage.value">상품 등록 버튼으로 첫 상품을 추가할 수 있습니다.</span></div>
        <div v-else class="table-wrap"><table><thead><tr><th scope="col">상품</th><th scope="col">가격</th><th scope="col">판매 상태</th><th scope="col">재고 상태</th><th scope="col">작업</th></tr></thead><tbody><tr v-for="item in catalog.selectedProducts.value" :key="item.productId"><td><strong>{{ item.name }}</strong><small>{{ item.description }}</small></td><td class="price">{{ money(item.price) }}</td><td><span class="status" :class="{ inactive: !item.active }">{{ item.active ? '판매 중' : '판매 중지' }}</span></td><td><span class="status" :class="{ warning: item.soldOut }">{{ item.soldOut ? '품절' : '판매 가능' }}</span></td><td><div class="actions" aria-label="상품 작업"><button type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleSoldOut(item)">{{ item.soldOut ? '품절 해제' : '품절 처리' }}</button><button v-if="catalog.canManage.value" type="button" @click="openProduct(item)">수정</button><button v-if="catalog.canManage.value" type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleProductActive(item)">{{ item.active ? '판매 중지' : '판매 재개' }}</button></div></td></tr></tbody></table></div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.catalog-page{display:grid;grid-template-columns:260px minmax(0,1fr);width:100%;overflow:hidden;border:1px solid var(--color-border);border-radius:var(--radius-surface);background:var(--color-surface)}.catalog-page>header,.catalog-page>.notice,.catalog-page>.api-error,.catalog-page>.loading-state{grid-column:1/-1}.page-heading,.page-title,.section-heading,.title-row,.editor-heading,.actions,.form-actions{display:flex;align-items:center}.page-heading{justify-content:space-between;gap:16px;border-bottom:1px solid var(--color-border);padding:18px 20px}.page-title{gap:12px}.page-icon{display:grid;width:40px;height:40px;place-items:center;border-radius:var(--radius-control);background:var(--color-primary-soft);color:var(--color-primary)}.page-heading p,.page-heading h1,.page-heading span,.section-heading h2,.section-heading p,.editor-heading p,.editor-heading h3{margin:0}.page-heading p,.eyebrow{color:var(--color-muted);font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.page-title>div>span,.section-heading p,small{color:var(--color-muted)}
.catalog-card{display:grid;align-content:start;gap:16px;min-width:0;padding:18px}.category-panel{border-right:1px solid var(--color-border)}.product-panel{min-height:440px}.section-heading{min-height:52px;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid var(--color-border);padding-bottom:14px}.section-heading h2{color:var(--color-heading);font-size:16px}.section-heading p{margin-top:4px;font-size:12px;line-height:1.45}.title-row{gap:8px}.count{display:inline-grid;min-width:22px;height:22px;place-items:center;border-radius:999px;background:var(--color-surface-subtle);color:var(--color-muted);font-size:12px;font-weight:750}
button{min-height:36px;border:1px solid var(--color-border-strong);border-radius:var(--radius-control);background:var(--color-surface);padding:0 11px;color:inherit;font:inherit;cursor:pointer}button:hover:not(:disabled){border-color:var(--color-primary);color:var(--color-primary)}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--color-primary-soft);outline-offset:2px}button:disabled{cursor:not-allowed;opacity:.5}.primary{border-color:var(--color-primary);background:var(--color-primary);color:white}.primary:hover:not(:disabled){color:white;filter:brightness(.96)}.notice{margin:0;border-bottom:1px solid #b7e4cc;background:#ecfdf5;padding:12px 18px;color:#17633b}.empty{display:grid;justify-items:center;gap:6px;margin:auto 0;padding:48px 16px;color:var(--color-muted);text-align:center}.empty strong{color:var(--color-heading);font-size:14px}.empty span{font-size:12px}
.category-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.category-list li{display:grid;gap:8px;border:1px solid var(--color-border);border-radius:var(--radius-control);padding:8px}.category-list li.selected{border-color:var(--color-primary);background:var(--color-primary-soft)}.category-select{display:grid;width:100%;justify-items:start;border:0;background:transparent;padding:6px;text-align:left}.category-select span{margin-top:4px;color:var(--color-muted);font-size:11px}.actions{justify-content:flex-start;flex-wrap:wrap;gap:6px}.category-list .actions{border-top:1px solid var(--color-border);padding-top:8px}.category-list .actions button{min-height:30px;font-size:12px}.status{display:inline-flex;align-items:center;gap:5px;border-radius:999px;background:#e8f7ef;padding:4px 8px;color:#17633b;font-size:11px;font-weight:750}.status::before{width:6px;height:6px;border-radius:50%;background:currentColor;content:""}.status.inactive{background:var(--color-surface-subtle);color:var(--color-muted)}.status.warning{background:#fff4df;color:#9a5b00}
.editor-panel{display:grid;gap:14px;border:1px solid var(--color-primary);border-radius:var(--radius-control);background:var(--color-primary-soft);padding:16px;box-shadow:0 8px 24px rgb(15 23 42 / 7%)}.editor-heading{justify-content:space-between;gap:12px}.editor-heading h3{margin-top:3px;color:var(--color-heading);font-size:16px}.editor-panel form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:end;gap:12px}.category-panel .editor-panel form{grid-template-columns:1fr}.editor-panel label,.featured-field{display:grid;gap:6px;font-weight:700}.editor-panel input,.editor-panel select{width:100%;min-height:40px;box-sizing:border-box;border:1px solid var(--color-border-strong);border-radius:var(--radius-control);background:white;padding:0 10px;font:inherit}.featured-field{grid-column:1/-1;border:1px solid var(--color-border-strong);border-radius:var(--radius-control);background:white;padding:14px}.category-panel .featured-field{grid-column:auto}.featured-field p{margin:0;color:var(--color-muted);font-size:12px;font-weight:400}.featured-field input{border-width:2px}.check{display:flex!important;align-items:center;align-self:center}.check input{width:auto;min-height:auto}.form-actions{grid-column:1/-1;justify-content:flex-end;gap:8px;border-top:1px solid var(--color-border);padding-top:12px}.wide{grid-column:1/-1}
.table-wrap{overflow-x:auto;border:1px solid var(--color-border);border-radius:var(--radius-control)}table{width:100%;min-width:720px;border-collapse:collapse}th,td{border-bottom:1px solid var(--color-border);padding:13px 14px;text-align:left}th{background:var(--color-surface-subtle);color:var(--color-muted);font-size:11px;font-weight:750;letter-spacing:.04em}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:var(--color-surface-subtle)}td{font-size:13px}td small{display:block;margin-top:4px}.price{white-space:nowrap;font-weight:700}
@media(max-width:900px){.catalog-page{grid-template-columns:220px minmax(0,1fr)}.editor-panel form{grid-template-columns:1fr}.featured-field,.wide{grid-column:auto}}@media(max-width:700px){.catalog-page{grid-template-columns:1fr}.catalog-page>header,.catalog-page>.notice,.catalog-page>.api-error,.catalog-page>.loading-state{grid-column:auto}.page-heading,.section-heading{align-items:stretch;flex-direction:column}.page-heading>button,.section-heading>button{align-self:flex-start}.category-panel{border-right:0;border-bottom:1px solid var(--color-border)}.category-list li{grid-template-columns:minmax(0,1fr) auto;align-items:center}.category-list .actions{border-top:0;padding-top:0}.empty{padding:32px 12px}}@media(max-width:460px){.catalog-card,.page-heading{padding:14px}.category-list li{grid-template-columns:1fr}.category-list .actions{border-top:1px solid var(--color-border);padding-top:8px}.form-actions button{flex:1}}
</style>
