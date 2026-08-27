<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKioskCartStore } from '@/stores/kioskCart'

const route = useRoute()
const router = useRouter()
const cart = useKioskCartStore()

onMounted(async () => {
  if (Object.keys(route.query).length) await router.replace({ path: route.path })
  await router.replace(cart.lines.length ? '/kiosk/checkout' : '/kiosk/order')
})
</script>

<template>
  <section class="retired-payment" aria-live="polite">
    <h1>결제 Kiosk 안내 화면으로 이동하고 있어요</h1>
    <p>잠시만 기다려 주세요.</p>
  </section>
</template>

<style scoped>
.retired-payment { display: grid; min-height: calc(100dvh - 190px); place-content: center; gap: 12px; text-align: center; }
.retired-payment h1, .retired-payment p { margin: 0; }
.retired-payment p { color: #687078; }
</style>
