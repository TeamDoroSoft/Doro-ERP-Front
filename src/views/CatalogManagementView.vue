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
    <header><div><p>상품 운영</p><h1>상품·메뉴 관리</h1><span>관리 목록은 판매용 메뉴 응답과 분리되어 있습니다.</span></div><button type="button" :disabled="catalog.loading.value" @click="catalog.load">새로고침</button></header>
    <p v-if="catalog.notice.value" class="notice" role="status">{{ catalog.notice.value }}</p>
    <ApiErrorNotice v-if="catalog.errorMessage.value" :message="catalog.errorMessage.value" retryable @retry="catalog.load" />
    <LoadingState v-if="catalog.loading.value" />
    <template v-else>
      <section class="catalog-card"><div class="section-heading"><div><h2>Category</h2><p>활성 상태와 표시 순서를 관리합니다.</p></div><button v-if="catalog.canManage.value" class="primary" type="button" @click="openCategory(null)">Category 생성</button></div>
        <p v-if="catalog.categories.value.length === 0" class="empty">등록된 Category가 없습니다.</p>
        <ul v-else class="category-list"><li v-for="item in catalog.categories.value" :key="item.categoryId" :class="{ selected: catalog.selectedCategoryId.value === item.categoryId }"><button type="button" class="category-select" @click="catalog.selectedCategoryId.value = item.categoryId"><strong>{{ item.name }}</strong><span>순서 {{ item.displayOrder }} · {{ item.active ? '활성' : '비활성' }}</span></button><div v-if="catalog.canManage.value" class="actions"><button type="button" @click="openCategory(item)">수정</button><button type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleCategory(item)">{{ item.active ? '비활성화' : '활성화' }}</button></div></li></ul>
      </section>
      <section v-if="categoryEditor !== undefined && catalog.canManage.value" class="catalog-card editor" aria-labelledby="category-editor-title"><div class="section-heading"><h2 id="category-editor-title">{{ categoryEditor ? 'Category 수정' : 'Category 생성' }}</h2><button type="button" @click="categoryEditor = undefined">닫기</button></div><form @submit.prevent="submitCategory"><label>이름<input v-model="catalog.categoryDraft.name" maxlength="100" /></label><label>표시 순서<input v-model.number="catalog.categoryDraft.displayOrder" type="number" min="0" max="9999" /></label><label class="check"><input v-model="catalog.categoryDraft.active" type="checkbox" /> 활성</label><button class="primary" type="submit" :disabled="!!catalog.busyId.value">저장</button></form></section>
      <section class="catalog-card"><div class="section-heading"><div><h2>상품</h2><p>선택한 Category의 상품입니다.</p></div><button v-if="catalog.canManage.value && catalog.selectedCategoryId.value" class="primary" type="button" @click="openProduct(null)">상품 생성</button></div>
        <p v-if="!catalog.selectedCategoryId.value" class="empty">Category를 선택해 주세요.</p><p v-else-if="catalog.selectedProducts.value.length === 0" class="empty">선택한 Category에 상품이 없습니다.</p>
        <div v-else class="table-wrap"><table><thead><tr><th>상품</th><th>가격</th><th>상태</th><th>품절</th><th>처리</th></tr></thead><tbody><tr v-for="item in catalog.selectedProducts.value" :key="item.productId"><td><strong>{{ item.name }}</strong><small>{{ item.description }}</small></td><td>{{ money(item.price) }}</td><td>{{ item.active ? '활성' : '비활성' }}</td><td>{{ item.soldOut ? '품절' : '판매 가능' }}</td><td class="actions"><button type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleSoldOut(item)">{{ item.soldOut ? '품절 해제' : '품절 처리' }}</button><button v-if="catalog.canManage.value" type="button" @click="openProduct(item)">수정</button><button v-if="catalog.canManage.value" type="button" :disabled="!!catalog.busyId.value" @click="catalog.toggleProductActive(item)">{{ item.active ? '비활성화' : '활성화' }}</button></td></tr></tbody></table></div>
      </section>
      <section v-if="productEditor !== undefined && catalog.canManage.value" class="catalog-card editor" aria-labelledby="product-editor-title"><div class="section-heading"><h2 id="product-editor-title">{{ productEditor ? '상품 수정' : '상품 생성' }}</h2><button type="button" @click="productEditor = undefined">닫기</button></div><form @submit.prevent="submitProduct"><label>Category<select v-model="catalog.productDraft.categoryId"><option v-for="item in catalog.categories.value" :key="item.categoryId" :value="item.categoryId">{{ item.name }}</option></select></label><label>상품명<input v-model="catalog.productDraft.name" maxlength="100" /></label><label>설명<input v-model="catalog.productDraft.description" maxlength="500" /></label><label>가격<input v-model="catalog.productDraft.price" inputmode="numeric" pattern="\d+" /></label><label>표시 순서<input v-model.number="catalog.productDraft.displayOrder" type="number" min="0" max="9999" /></label><label class="check"><input v-model="catalog.productDraft.active" type="checkbox" /> 활성</label><button class="primary" type="submit" :disabled="!!catalog.busyId.value">저장</button></form></section>
    </template>
  </main>
</template>
<style scoped>
.catalog-page{display:grid;gap:18px;width:100%}header,.section-heading,.actions{display:flex;align-items:center;justify-content:space-between;gap:12px}header p,header h1,header span,h2,.section-heading p{margin:0}header p{color:var(--color-primary);font-weight:800}header span,.section-heading p,small{color:var(--color-muted)}.catalog-card{display:grid;gap:15px;border:1px solid var(--color-border);border-radius:14px;background:white;padding:20px}button{min-height:38px;border:1px solid var(--color-border);border-radius:8px;background:white;padding:0 12px;font:inherit;cursor:pointer}button:disabled{opacity:.5}.primary{border-color:var(--color-primary);background:var(--color-primary);color:white}.notice{margin:0;border-radius:9px;background:#e6f7ed;padding:12px;color:#17633b}.empty{padding:30px;color:var(--color-muted);text-align:center}.category-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.category-list li{display:flex;justify-content:space-between;gap:12px;border:1px solid var(--color-border);border-radius:9px;padding:10px}.category-list li.selected{border-color:var(--color-primary)}.category-select{display:grid;flex:1;justify-items:start;border:0}.category-select span,td small{display:block;margin-top:3px}.editor form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:12px}label{display:grid;gap:5px;font-weight:700}input,select{min-height:40px;border:1px solid var(--color-border);border-radius:8px;padding:0 9px}.check{display:flex;align-items:center}.check input{min-height:auto}.table-wrap{overflow-x:auto}table{width:100%;min-width:760px;border-collapse:collapse}th,td{border-bottom:1px solid var(--color-border);padding:11px;text-align:left}.actions{justify-content:flex-start;flex-wrap:wrap}@media(max-width:760px){header,.section-heading,.category-list li{align-items:stretch;flex-direction:column}.editor form{grid-template-columns:1fr}}
</style>
