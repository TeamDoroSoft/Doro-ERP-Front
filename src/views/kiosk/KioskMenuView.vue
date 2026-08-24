<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { getKioskMenu, type KioskMenu, type KioskMenuItem } from '@/api/kiosk'
import { formatKrw, multiplyInt64 } from '@/api/int64'
import KioskStatePanel from '@/components/kiosk/KioskStatePanel.vue'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskSessionStore } from '@/stores/kioskSession'

const cart = useKioskCartStore(), session = useKioskSessionStore(), menu = ref<KioskMenu | null>(null), loading = ref(true), error = ref(false), categoryId = ref(''), selected = ref<KioskMenuItem | null>(null), quantity = ref(1), dialog = ref<HTMLElement | null>(null), returnFocus = ref<HTMLElement | null>(null)
const categories = computed(() => menu.value?.categories ?? [])
const category = computed(() => categories.value.find((item) => item.categoryId === categoryId.value) ?? categories.value[0])

onMounted(load)
async function load() {
  loading.value = true; error.value = false
  try { menu.value = await getKioskMenu(); session.markAuthenticated(); categoryId.value = menu.value.categories[0]?.categoryId ?? '' }
  catch { error.value = true }
  finally { loading.value = false }
}
async function choose(product: KioskMenuItem, trigger: Event) {
  returnFocus.value = trigger.currentTarget as HTMLElement; selected.value = product; quantity.value = 1
  await nextTick(); dialog.value?.querySelector<HTMLElement>('.close')?.focus()
}
function closeDialog() { selected.value = null; nextTick(() => returnFocus.value?.focus()) }
function dialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled)')]
  if (!focusable.length) return
  const first = focusable[0]!, last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
function add() { if (!selected.value) return; cart.addItem(selected.value, quantity.value); selected.value = null }
const money = formatKrw
</script>

<template>
  <section class="menu-page" :class="{ 'has-cart': cart.lines.length }">
    <div class="menu-workspace">
      <div class="menu-bar"><h1>메뉴</h1><span v-if="category">{{ category.products.length }}개 상품</span></div>
      <KioskStatePanel v-if="loading" kind="loading" title="메뉴를 불러오고 있습니다" message="잠시만 기다려 주세요." />
      <KioskStatePanel v-else-if="error" kind="error" title="메뉴를 불러오지 못했습니다" message="직원에게 문의하거나 다시 시도해 주세요."><button @click="load">다시 시도</button></KioskStatePanel>
      <KioskStatePanel v-else-if="!categories.length" title="판매 중인 메뉴가 없습니다" message="직원에게 문의해 주세요." />
      <template v-else>
        <nav class="tabs" aria-label="메뉴 카테고리"><button v-for="item in categories" :key="item.categoryId" :class="{ active: item.categoryId === category?.categoryId }" @click="categoryId = item.categoryId">{{ item.name }}</button></nav>
        <div v-if="category?.products.length" class="menu-grid"><button v-for="product in category.products" :key="product.productId" class="product" @click="choose(product, $event)"><b>{{ product.name }}</b><small v-if="product.description">{{ product.description }}</small><strong>{{ money(product.price) }}</strong></button></div>
        <KioskStatePanel v-else title="이 분류에는 판매 중인 메뉴가 없습니다" message="다른 메뉴 분류를 선택해 주세요." />
      </template>
    </div>

    <aside class="order-rail" aria-label="주문 내역">
      <div class="rail-heading"><strong>주문 내역</strong><span>총 {{ cart.itemCount }}개</span></div>
      <div v-if="cart.lines.length" class="rail-lines"><article v-for="line in cart.lines" :key="line.productId"><div><b>{{ line.name }}</b><small>{{ line.quantity }}개 × {{ money(line.unitPrice) }}</small></div><strong>{{ money(multiplyInt64(line.unitPrice, line.quantity)) }}</strong></article></div>
      <p v-else class="rail-empty">선택한 메뉴가 없습니다</p>
      <footer><div class="rail-total"><span>총 결제금액</span><b>{{ money(cart.estimatedTotal) }}</b></div><RouterLink :class="{ disabled: !cart.itemCount }" :aria-disabled="!cart.itemCount" to="/kiosk/cart">주문 확인</RouterLink></footer>
    </aside>

    <div v-if="selected" class="backdrop" @click.self="closeDialog">
      <section ref="dialog" class="dialog" role="dialog" aria-modal="true" :aria-labelledby="`kiosk-product-${selected.productId}`" @keydown="dialogKeydown">
        <button class="close" aria-label="상품 선택 닫기" @click="closeDialog">×</button><p>메뉴 선택</p><h2 :id="`kiosk-product-${selected.productId}`">{{ selected.name }}</h2><span v-if="selected.description">{{ selected.description }}</span><strong>{{ money(selected.price) }}</strong>
        <div class="quantity-block"><label>수량</label><div class="quantity"><button aria-label="수량 줄이기" :disabled="quantity === 1" @click="quantity--">−</button><output>{{ quantity }}</output><button aria-label="수량 늘리기" @click="quantity++">+</button></div></div>
        <button class="add" @click="add">{{ money(multiplyInt64(selected.price, quantity)) }} 담기</button>
      </section>
    </div>
  </section>
</template>

<style scoped>
.menu-page { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; align-items: start; }.menu-page.has-cart { grid-template-columns: minmax(0, 1fr) 330px; }.menu-workspace { min-width: 0; }
.menu-bar { display: flex; min-height: 38px; align-items: center; justify-content: space-between; margin-bottom: 10px; }.menu-bar h1 { margin: 0; font-size: 22px; letter-spacing: -.03em; }.menu-bar span { color: #69716d; font-size: 13px; font-weight: 700; }
.tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 14px; padding-bottom: 2px; }.tabs button { min-width: 104px; min-height: 52px; flex: 0 0 auto; border: 1px solid #ccd2ce; border-radius: 4px; background: #fff; padding: 0 18px; color: #343b37; font-size: 16px; font-weight: 800; }.tabs button.active { border-color: #087f5b; background: #087f5b; color: #fff; }
.menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }.product { display: grid; min-height: 132px; align-content: space-between; gap: 7px; border: 1px solid #d2d7d4; border-radius: 5px; background: #fff; padding: 17px; color: #171918; text-align: left; touch-action: manipulation; }.product:active { border-color: #087f5b; background: #f3f8f5; transform: translateY(1px); }.product b { font-size: 17px; line-height: 1.3; }.product small { display: -webkit-box; overflow: hidden; color: #68716c; font-size: 12px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.product strong { align-self: end; margin-top: 7px; font-size: 18px; }
.order-rail { position: sticky; top: 20px; display: grid; min-height: 540px; overflow: hidden; border: 1px solid #cbd1cd; border-radius: 5px; background: #fff; }.rail-heading { display: flex; min-height: 58px; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e6e3; padding: 0 18px; }.rail-heading strong { font-size: 17px; }.rail-heading span { color: #087f5b; font-size: 13px; font-weight: 800; }.rail-lines { overflow-y: auto; max-height: 400px; padding: 0 18px; }.rail-lines article { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e8ebe9; padding: 14px 0; }.rail-lines article div { display: grid; gap: 4px; min-width: 0; }.rail-lines article b { overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }.rail-lines article small { color: #69716d; font-size: 12px; }.rail-lines article > strong { font-size: 13px; white-space: nowrap; }.rail-empty { align-self: center; margin: 0; color: #747c78; text-align: center; }
.order-rail footer { align-self: end; border-top: 1px solid #e2e6e3; padding: 16px 18px 18px; }.rail-total { display: flex; align-items: end; justify-content: space-between; margin-bottom: 14px; }.rail-total span { color: #626b66; font-size: 13px; }.rail-total b { font-size: 22px; }.order-rail footer a { display: grid; min-height: 58px; place-items: center; border-radius: 4px; background: #087f5b; color: #fff; font-size: 17px; font-weight: 900; touch-action: manipulation; }.order-rail footer a.disabled { pointer-events: none; background: #b5bdb8; }
.menu-page:not(.has-cart) { padding-bottom: 82px; }.menu-page:not(.has-cart) .order-rail { position: fixed; right: clamp(20px, 2.8vw, 44px); bottom: 14px; left: clamp(20px, 2.8vw, 44px); top: auto; grid-template-columns: minmax(180px, 1fr) auto; min-height: 0; align-items: center; z-index: 5; box-shadow: 0 3px 14px rgb(20 30 24 / 10%); }.menu-page:not(.has-cart) .rail-heading { border: 0; }.menu-page:not(.has-cart) .rail-empty { display: none; }.menu-page:not(.has-cart) .order-rail footer { display: flex; min-width: 420px; align-items: center; gap: 18px; border: 0; padding: 10px 12px; }.menu-page:not(.has-cart) .rail-total { min-width: 160px; margin: 0; }.menu-page:not(.has-cart) .order-rail footer a { min-width: 150px; min-height: 50px; }
.backdrop { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgb(18 25 21 / 62%); padding: 24px; }.dialog { position: relative; display: grid; width: min(500px, 100%); gap: 14px; border: 1px solid #cbd1cd; border-radius: 7px; background: #fff; padding: 32px; }.dialog > p { margin: 0; color: #087f5b; font-size: 13px; font-weight: 800; }.dialog h2 { margin: 0; font-size: 28px; }.dialog > span { color: #68716c; line-height: 1.5; }.dialog > strong { font-size: 23px; }.close { position: absolute; top: 10px; right: 10px; width: 50px; height: 50px; border: 0; background: transparent; font-size: 30px; }.quantity-block { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e3e7e4; padding-top: 16px; }.quantity-block label { font-weight: 800; }.quantity { display: flex; align-items: center; gap: 15px; }.quantity button { width: 56px; height: 56px; border: 1px solid #cdd3cf; border-radius: 4px; background: #fff; font-size: 26px; }.quantity output { min-width: 32px; font-size: 23px; font-weight: 800; text-align: center; }.add { min-height: 62px; border: 0; border-radius: 4px; background: #087f5b; color: #fff; font-size: 18px; font-weight: 900; }
@media (max-width: 1100px) { .menu-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }.menu-page.has-cart { grid-template-columns: 1fr; }.menu-page.has-cart .order-rail { position: sticky; bottom: 8px; top: auto; min-height: 0; z-index: 5; }.menu-page.has-cart .rail-lines { max-height: 220px; } }
@media (max-width: 700px) { .menu-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.menu-page:not(.has-cart) .order-rail { grid-template-columns: 1fr; }.menu-page:not(.has-cart) .order-rail footer { width: 100%; min-width: 0; }.dialog { padding: 28px 22px 22px; } }
@media (max-width: 460px) { .menu-grid { grid-template-columns: 1fr; } }
</style>
