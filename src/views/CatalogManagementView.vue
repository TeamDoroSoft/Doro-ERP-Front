<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { formatCurrencyInt64 } from '@/api/int64'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { useCatalogManagement } from '@/composables/useCatalogManagement'
import type { ManagedCategoryResponse, ManagedProductResponse } from '@/api/catalog'
const catalog = useCatalogManagement()
const categoryEditor = ref<ManagedCategoryResponse | null | undefined>()
const productEditor = ref<ManagedProductResponse | null | undefined>()
onMounted(catalog.load)
watch(catalog.selectedCategoryId, (value) => { catalog.productDraft.categoryId = value })
function openCategory(item: ManagedCategoryResponse | null) { categoryEditor.value = item; if (item) catalog.editCategory(item); else catalog.resetCategoryDraft() }
function openProduct(item: ManagedProductResponse | null) { productEditor.value = item; if (item) catalog.editProduct(item); else catalog.resetProductDraft() }
async function submitCategory() { await catalog.saveCategory(categoryEditor.value ?? undefined); if (!catalog.errorMessage.value) categoryEditor.value = undefined }
async function submitProduct() { await catalog.saveProduct(productEditor.value ?? undefined); if (!catalog.errorMessage.value) productEditor.value = undefined }
const money = (value: string) => formatCurrencyInt64(value, 'KRW')
</script>
<template>
  <main class="catalog-page">
    <header><div><p>상품 관리</p><h1>상품·메뉴 관리</h1><span>메뉴 분류와 상품의 판매 상태를 관리합니다.</span></div><button type="button" :disabled="catalog.loading.value" @click="catalog.load">새로고침</button></header>
    <p v-if="catalog.notice.value" class="notice" role="status">{{ catalog.notice.value }}</p>
    <ApiErrorNotice v-if="catalog.errorMessage.value" :message="catalog.errorMessage.value" retryable @retry="catalog.load" />
    <LoadingState v-if="catalog.loading.value" />
    <template v-else>
      <section class="catalog-card category-panel"><div class="section-heading"><div><h2>메뉴 분류</h2><p>상품을 구분하는 메뉴 분류입니다.</p></div><button v-if="catalog.canManage.value" class="primary" type="button" @click="openCategory(null)">분류 등록</button></div>
        <p v-if="catalog.categories.value.length === 0" class="empty">등록된 메뉴 분류가 없습니다.</p>
        <ul v-else class="category-list"><li v-for="item in catalog.categories.value" :key="item.categoryId" :class="{ selected: catalog.selectedCategoryId.value === item.categoryId }"><button type="button" class="category-select" @click="catalog.selectedCategoryId.value = item.categoryId"><strong>{{ item.name }}</strong><span>표시 순서 {{ item.displayOrder }} · {{ item.active ? '운영 중' : '이용 중지' }}</span></button><div v-if="catalog.canManage.value" class="actions"><button type="button" @click="openCategory(item)">수정</button><button type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleCategory(item)">{{ item.active ? '이용 중지' : '이용 재개' }}</button></div></li></ul>
      </section>
      <section v-if="categoryEditor !== undefined && catalog.canManage.value" class="catalog-card editor" aria-labelledby="category-editor-title"><div class="section-heading"><h2 id="category-editor-title">{{ categoryEditor ? '메뉴 분류 수정' : '메뉴 분류 등록' }}</h2><button type="button" @click="categoryEditor = undefined">닫기</button></div><form @submit.prevent="submitCategory"><label>분류명<input v-model="catalog.categoryDraft.name" maxlength="100" /></label><label>표시 순서<input v-model.number="catalog.categoryDraft.displayOrder" type="number" min="0" max="9999" /></label><label class="check"><input v-model="catalog.categoryDraft.active" type="checkbox" /> 운영 중</label><button class="primary" type="submit" :disabled="!!catalog.busyId.value">저장</button></form></section>
      <section class="catalog-card product-panel"><div class="section-heading"><div><h2>상품 목록</h2><p>선택한 메뉴 분류의 판매 상태와 가격을 관리합니다.</p></div><button v-if="catalog.canManage.value && catalog.selectedCategoryId.value" class="primary" type="button" @click="openProduct(null)">상품 등록</button></div>
        <p v-if="!catalog.selectedCategoryId.value" class="empty">메뉴 분류를 선택해 주세요.</p><p v-else-if="catalog.selectedProducts.value.length === 0" class="empty">선택한 분류에 등록된 상품이 없습니다.</p>
        <div v-else class="table-wrap"><table><thead><tr><th>상품</th><th>가격</th><th>판매 상태</th><th>재고 상태</th><th>작업</th></tr></thead><tbody><tr v-for="item in catalog.selectedProducts.value" :key="item.productId"><td><strong>{{ item.name }}</strong><small>{{ item.description }}</small></td><td>{{ money(item.price) }}</td><td>{{ item.active ? '판매 중' : '판매 중지' }}</td><td>{{ item.soldOut ? '품절' : '판매 가능' }}</td><td class="actions"><button type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleSoldOut(item)">{{ item.soldOut ? '품절 해제' : '품절 처리' }}</button><button v-if="catalog.canManage.value" type="button" @click="openProduct(item)">수정</button><button v-if="catalog.canManage.value" type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleProductActive(item)">{{ item.active ? '판매 중지' : '판매 재개' }}</button></td></tr></tbody></table></div>
      </section>
      <section v-if="productEditor !== undefined && catalog.canManage.value" class="catalog-card editor" aria-labelledby="product-editor-title"><div class="section-heading"><h2 id="product-editor-title">{{ productEditor ? '상품 수정' : '상품 등록' }}</h2><button type="button" @click="productEditor = undefined">닫기</button></div><form @submit.prevent="submitProduct"><label>메뉴 분류<select v-model="catalog.productDraft.categoryId"><option v-for="item in catalog.categories.value" :key="item.categoryId" :value="item.categoryId">{{ item.name }}</option></select></label><label>상품명<input v-model="catalog.productDraft.name" maxlength="100" /></label><label>설명<input v-model="catalog.productDraft.description" maxlength="500" /></label><label>가격<input v-model="catalog.productDraft.price" inputmode="numeric" pattern="\d+" /></label><label>표시 순서<input v-model.number="catalog.productDraft.displayOrder" type="number" min="0" max="9999" /></label><label class="check"><input v-model="catalog.productDraft.active" type="checkbox" /> 판매 중</label><button class="primary" type="submit" :disabled="!!catalog.busyId.value">저장</button></form></section>
    </template>
  </main>
</template>
<style scoped>
.catalog-page{display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;width:100%}.catalog-page>header,.catalog-page>.notice,.catalog-page>.api-error,.catalog-page>.loading-state{grid-column:1/-1}header,.section-heading,.actions{display:flex;align-items:center;justify-content:space-between;gap:12px}header p,header h1,header span,h2,.section-heading p{margin:0}header p{color:var(--color-muted);font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}header span,.section-heading p,small{color:var(--color-muted)}.catalog-card{display:grid;gap:14px;border:1px solid var(--color-border);border-radius:var(--radius-surface);background:white;padding:16px}.category-panel{align-self:start}.product-panel{min-width:0}.editor{grid-column:1/-1}button{min-height:34px;border:1px solid var(--color-border-strong);border-radius:var(--radius-control);background:white;padding:0 10px;font:inherit;cursor:pointer}button:disabled{opacity:.5}.primary{border-color:var(--color-primary);background:var(--color-primary);color:white}.notice{margin:0;border-radius:var(--radius-control);background:#ecfdf5;padding:12px;color:#17633b}.empty{padding:24px 12px;color:var(--color-muted);text-align:center}.category-list{display:grid;gap:2px;margin:0;padding:0;list-style:none}.category-list li{display:flex;justify-content:space-between;gap:6px;border:0;border-radius:var(--radius-control);padding:5px}.category-list li.selected{background:var(--color-primary-soft)}.category-select{display:grid;flex:1;justify-items:start;border:0}.category-select span,td small{display:block;margin-top:3px;font-size:11px}.editor form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:12px}label{display:grid;gap:5px;font-weight:700}input,select{min-height:36px;border:1px solid var(--color-border-strong);border-radius:var(--radius-control);padding:0 9px}.check{display:flex;align-items:center}.check input{min-height:auto}.table-wrap{overflow-x:auto;border:1px solid var(--color-border);border-radius:var(--radius-control)}table{width:100%;min-width:700px;border-collapse:collapse}th,td{border-bottom:1px solid var(--color-border);padding:11px 12px;text-align:left}th{background:var(--color-surface-subtle);color:var(--color-muted);font-size:11px;font-weight:750;letter-spacing:.04em}tbody tr:hover{background:#fafafa}.actions{justify-content:flex-start;flex-wrap:wrap}@media(max-width:760px){.catalog-page{grid-template-columns:1fr}header,.section-heading,.category-list li{align-items:stretch;flex-direction:column}.editor form{grid-template-columns:1fr}}
/* Square-style catalogue workspace: a category rail and a single working table, not a card grid. */
.catalog-page { gap: 0; grid-template-columns: 232px minmax(0, 1fr); border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); }
.catalog-page > header { align-items: center; grid-column: 1 / -1; border-bottom: 1px solid var(--color-border); padding: 16px 18px; }
.catalog-page > .notice, .catalog-page > .api-error, .catalog-page > .loading-state { margin: 0; grid-column: 1 / -1; }
.catalog-card { border: 0; border-radius: 0; padding: 16px; }
.category-panel { border-right: 1px solid var(--color-border); }
.product-panel { min-height: 420px; }
.section-heading { align-items: flex-start; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.section-heading h2 { color: var(--color-heading); font-size: 14px; }
.section-heading p { font-size: 12px; }
.category-list { margin: 0 -8px; }.category-list li { border-bottom: 1px solid var(--color-border); }.category-select { border-radius: 0; padding: 10px 8px; }.category-list li.selected .category-select { border-left: 2px solid var(--color-primary); background: var(--color-primary-soft); }
.table-wrap { margin: 0 -16px -16px; }.table-wrap th, .table-wrap td { padding: 11px 16px; font-size: 13px; }.table-wrap th { background: var(--color-surface-subtle); font-size: 11px; }
@media (max-width: 760px){ .catalog-page{grid-template-columns:1fr}.catalog-page>header,.catalog-page>.notice,.catalog-page>.api-error,.catalog-page>.loading-state{grid-column:auto}.category-panel{border-right:0;border-bottom:1px solid var(--color-border)}.editor{grid-column:auto} }
</style>
