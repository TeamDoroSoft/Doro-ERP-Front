<script setup lang="ts">
export interface SalesMenuProduct {
  productId: string
  name: string
  description: string
  price: number
}
export interface SalesMenuCategory {
  categoryId: string
  name: string
  products: SalesMenuProduct[]
}
defineProps<{ categories: SalesMenuCategory[]; disabled?: boolean }>()
defineEmits<{ add: [product: SalesMenuProduct] }>()
</script>
<template>
  <section class="menu" aria-label="판매 메뉴">
    <section v-for="category in categories" :key="category.categoryId" class="category">
      <h2>{{ category.name }}</h2>
      <ul>
        <li v-for="product in category.products" :key="product.productId">
          <div>
            <strong>{{ product.name }}</strong>
            <p v-if="product.description">{{ product.description }}</p>
          </div>
          <span>{{ product.price.toLocaleString('ko-KR') }}원</span
          ><button type="button" :disabled="disabled" @click="$emit('add', product)">담기</button>
        </li>
      </ul>
    </section>
  </section>
</template>
<style scoped>
.menu {
  display: grid;
  gap: 1rem;
}
.category {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
}
h2 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
}
ul {
  display: grid;
  gap: 0.5rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  align-items: center;
}
p {
  margin: 0.2rem 0 0;
  color: var(--color-muted);
  font-size: 0.82rem;
}
button {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  background: var(--color-background);
}
</style>
