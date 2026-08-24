<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="kiosk-shell">
    <header class="kiosk-header">
      <RouterLink class="brand" to="/kiosk" aria-label="Doro 메뉴로 이동"><b>D</b><strong>Doro</strong></RouterLink>
    </header>
    <main><RouterView /></main>
  </div>
</template>

<style scoped>
.kiosk-shell { min-height: 100dvh; background: #f4f5f4; color: #171918; }
.kiosk-header { display: flex; min-height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #d8dcda; background: #fff; padding: 10px clamp(20px, 3vw, 44px); }
.brand { display: inline-flex; align-items: center; gap: 10px; color: #171918; }
.brand b { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 4px; background: #087f5b; color: #fff; font-size: 17px; }
.brand strong { font-size: 20px; letter-spacing: -.02em; }
main { width: min(100%, 1600px); margin: auto; padding: 20px clamp(20px, 2.8vw, 44px) 28px; }
@media (max-width: 640px) { .kiosk-header { min-height: 58px; padding: 8px 16px; }.brand b { width: 30px; height: 30px; }.brand strong { font-size: 18px; }main { padding: 14px 14px 20px; } }
</style>
