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
        <!-- Temporary links for STORE-06 verification. Replace with the shared ERP admin layout. -->
        <RouterLink to="/management/store-settings/profile">기본 정보</RouterLink>
        <RouterLink to="/management/store-settings/schedule">영업·휴무·서비스 시간</RouterLink>
        <RouterLink to="/management/store-settings/features">기능·알림 설정</RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>
