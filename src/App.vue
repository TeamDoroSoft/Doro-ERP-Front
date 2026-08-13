<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="app-header">
    <RouterLink class="brand" to="/tables">Doro ERP</RouterLink>
    <nav aria-label="주요 메뉴">
      <RouterLink to="/tables">테이블</RouterLink>
      <RouterLink to="/payments/test">결제 테스트</RouterLink>
      <RouterLink to="/home">홈</RouterLink>
      <RouterLink to="/about">소개</RouterLink>
    </nav>
  </header>
  <RouterView class="app-content" />
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(100%, 1120px);
  margin: 0 auto;
  padding: 1rem 0;
}

.brand {
  color: #163c2f;
  font-size: 1.2rem;
  font-weight: 800;
}

nav a {
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
}

nav a.router-link-active {
  background: #e4f1ec;
  color: #185b43;
}

.app-content {
  padding: 2rem 0 4rem;
}
</style>
