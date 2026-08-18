<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useKioskCartStore } from '@/stores/kioskCart'
const route = useRoute(),
  cart = useKioskCartStore(),
  showCart = computed(() => route.name === 'kiosk-menu' && cart.itemCount > 0)
</script>
<template>
  <div class="layout">
    <header>
      <RouterLink to="/kiosk"><b>D</b><span>Doro 주문하기</span></RouterLink
      ><RouterLink v-if="showCart" class="cart" to="/kiosk/cart"
        >장바구니 {{ cart.itemCount }}</RouterLink
      >
    </header>
    <main><RouterView /></main>
  </div>
</template>
<style scoped>
.layout {
  min-height: 100dvh;
  background: #f7f5f0;
  color: #17211d;
}
.layout > header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  min-height: 80px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e7e1d7;
  background: #fffdf9;
  padding: 12px clamp(18px, 4vw, 56px);
}
header a {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 900;
}
header b {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 15px;
  background: #126a5a;
  color: #fff;
}
.cart {
  border-radius: 16px;
  background: #17211d;
  padding: 14px 18px;
  color: #fff;
}
main {
  width: min(100%, 1400px);
  margin: auto;
  padding: clamp(20px, 4vw, 52px);
}
</style>
