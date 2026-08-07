<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
const showNavigation = computed(() => route.name !== 'qr-landing')
</script>

<template>
  <div class="app-shell">
    <header v-if="showNavigation" class="app-nav">
      <RouterLink to="/tables" class="app-nav__brand">Doro ERP</RouterLink>
      <nav aria-label="주요 화면">
        <RouterLink to="/tables">테이블 운영</RouterLink>
        <RouterLink to="/pos/catalog">상품·메뉴</RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>
