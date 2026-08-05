<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getPublishedMenu } from '@/api/catalog'
import { ApiError } from '@/api/http'
import type { PublishedMenu } from '@/types/catalog'

const menu = ref<PublishedMenu | null>(null)
const loading = ref(true)
const loadError = ref('')

function formatPrice(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

async function loadMenu(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    menu.value = await getPublishedMenu()
  } catch (caught) {
    loadError.value = caught instanceof ApiError ? caught.detail : '메뉴를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadMenu()
})
</script>

<template>
  <main class="public-menu">
    <header>
      <h1>메뉴</h1>
    </header>

    <p v-if="loading" class="status" role="status">메뉴를 불러오는 중입니다.</p>

    <section v-else-if="loadError" class="error-panel" role="alert">
      <p>{{ loadError }}</p>
      <button type="button" @click="loadMenu">다시 시도</button>
    </section>

    <template v-else-if="menu">
      <section v-for="category in menu.categories" :key="category.categoryId" class="category-section">
        <h2>{{ category.name }}</h2>
        <p v-if="category.products.length === 0" class="status">판매 중인 상품이 없습니다.</p>
        <ul v-else class="product-list">
          <li v-for="product in category.products" :key="product.productId" class="product-card">
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
              :alt="product.imageAltText ?? product.name"
              class="product-image"
            />
            <div class="product-info">
              <div class="product-name-row">
                <span class="product-name">{{ product.name }}</span>
                <span v-if="product.soldOut" class="sold-out-badge">품절</span>
              </div>
              <p v-if="product.description" class="product-description">{{ product.description }}</p>
              <span class="product-price">{{ formatPrice(product.basePrice) }}</span>
              <ul v-if="product.options.length > 0" class="option-list">
                <li v-for="option in product.options" :key="option.optionId">
                  {{ option.name }}
                  <template v-if="option.additionalPrice > 0"> (+{{ formatPrice(option.additionalPrice) }})</template>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </section>

      <p v-if="menu.categories.length === 0" class="status">등록된 메뉴가 없습니다.</p>
    </template>
  </main>
</template>

<style scoped>
.public-menu {
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  margin-bottom: 1.5rem;
}

h1 {
  margin: 0;
  font-size: 1.75rem;
}

.status {
  color: #5f6368;
}

.error-panel {
  padding: 0.9rem;
  border: 1px solid #f0aaa4;
  border-radius: 0.35rem;
  background: #fff5f4;
  color: #b42318;
}

.category-section {
  margin-bottom: 2rem;
}

h2 {
  font-size: 1.25rem;
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e3e5e8;
}

.product-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.product-card {
  display: flex;
  gap: 1rem;
}

.product-image {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.product-name {
  font-weight: 600;
}

.sold-out-badge {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: #f4f5f6;
  color: #5f6368;
  font-size: 0.75rem;
}

.product-description {
  margin: 0.25rem 0;
  color: #5f6368;
  font-size: 0.9rem;
}

.product-price {
  font-weight: 600;
}

.option-list {
  margin: 0.4rem 0 0;
  padding-left: 1.1rem;
  color: #5f6368;
  font-size: 0.85rem;
}
</style>
