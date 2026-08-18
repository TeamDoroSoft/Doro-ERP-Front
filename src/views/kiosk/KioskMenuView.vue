<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { getKioskMenu, type KioskMenu, type KioskMenuItem } from '@/api/kiosk'
import { formatKrw, multiplyInt64 } from '@/api/int64'
import KioskStatePanel from '@/components/kiosk/KioskStatePanel.vue'
import { useKioskCartStore } from '@/stores/kioskCart'
import { useKioskSessionStore } from '@/stores/kioskSession'
const cart = useKioskCartStore(),
  session = useKioskSessionStore(),
  menu = ref<KioskMenu | null>(null),
  loading = ref(true),
  error = ref(false),
  categoryId = ref(''),
  selected = ref<KioskMenuItem | null>(null),
  quantity = ref(1),
  dialog = ref<HTMLElement | null>(null),
  returnFocus = ref<HTMLElement | null>(null),
  categories = computed(() => menu.value?.categories ?? []),
  category = computed(
    () => categories.value.find((x) => x.categoryId === categoryId.value) ?? categories.value[0],
  )
onMounted(load)
async function load() {
  loading.value = true
  error.value = false
  try {
    menu.value = await getKioskMenu()
    session.markAuthenticated()
    categoryId.value = menu.value.categories[0]?.categoryId ?? ''
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
async function choose(p: KioskMenuItem, trigger: Event) {
  returnFocus.value = trigger.currentTarget as HTMLElement
  selected.value = p
  quantity.value = 1
  await nextTick()
  dialog.value?.querySelector<HTMLElement>('.close')?.focus()
}
function closeDialog() {
  selected.value = null
  nextTick(() => returnFocus.value?.focus())
}
function dialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDialog()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled)')]
  if (!focusable.length) return
  const first = focusable[0]!,
    last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
function add() {
  if (!selected.value) return
  cart.addItem(selected.value, quantity.value)
  selected.value = null
}
const money = formatKrw
</script>
<template>
  <section>
    <header class="hero">
      <div>
        <p>어서 오세요</p>
        <h1>무엇을 드릴까요?</h1>
      </div>
      <span>원하는 메뉴를 눌러주세요.</span>
    </header>
    <KioskStatePanel
      v-if="loading"
      kind="loading"
      title="메뉴를 준비하고 있어요"
      message="잠시만 기다려주세요."
    /><KioskStatePanel
      v-else-if="error"
      kind="error"
      title="지금은 주문을 시작할 수 없어요"
      message="직원에게 문의하거나 잠시 후 다시 시도해주세요."
      ><button @click="load">다시 시도</button></KioskStatePanel
    ><KioskStatePanel
      v-else-if="!categories.length"
      title="판매 중인 메뉴가 없어요"
      message="메뉴가 준비되면 표시됩니다."
    /><template v-else
      ><nav class="tabs">
        <button
          v-for="c in categories"
          :key="c.categoryId"
          :class="{ active: c.categoryId === category?.categoryId }"
          @click="categoryId = c.categoryId"
        >
          {{ c.name }}
        </button>
      </nav>
      <div v-if="category?.products.length" class="grid">
        <button v-for="p in category.products" :key="p.productId" @click="choose(p, $event)">
          <span>{{ p.name.slice(0, 1) }}</span
          ><b>{{ p.name }}</b
          ><small>{{ p.description }}</small
          ><strong>{{ money(p.price) }}</strong>
        </button>
      </div>
      <KioskStatePanel
        v-else
        title="이 카테고리에 판매 중인 메뉴가 없어요"
        message="다른 카테고리를 선택해주세요."
    /></template>
    <div v-if="selected" class="backdrop" @click.self="closeDialog">
      <section
        ref="dialog"
        class="dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`kiosk-product-${selected.productId}`"
        @keydown="dialogKeydown"
      >
        <button class="close" aria-label="상품 선택 닫기" @click="closeDialog">×</button>
        <h2 :id="`kiosk-product-${selected.productId}`">{{ selected.name }}</h2>
        <p>{{ selected.description }}</p>
        <strong>{{ money(selected.price) }}</strong>
        <div class="quantity">
          <button aria-label="수량 줄이기" :disabled="quantity === 1" @click="quantity--">−</button
          ><output>{{ quantity }}</output
          ><button aria-label="수량 늘리기" @click="quantity++">+</button>
        </div>
        <button class="add" @click="add">
          {{ money(multiplyInt64(selected.price, quantity)) }} · 장바구니 담기
        </button>
      </section>
    </div>
  </section>
</template>
<style scoped>
.hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 28px;
}
.hero p {
  color: #126a5a;
  font-weight: 900;
}
.hero h1 {
  font-size: clamp(34px, 5vw, 58px);
}
.hero span {
  color: #68766f;
}
.tabs {
  display: flex;
  gap: 10px;
  overflow: auto;
  margin-bottom: 22px;
}
.tabs button {
  min-height: 54px;
  border: 2px solid #ddd6ca;
  border-radius: 18px;
  background: #fff;
  padding: 0 24px;
  font-weight: 900;
}
.tabs .active {
  border-color: #126a5a;
  background: #126a5a;
  color: #fff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 18px;
}
.grid > button {
  display: grid;
  gap: 8px;
  border: 0;
  border-radius: 26px;
  background: #fff;
  padding: 18px;
  text-align: left;
}
.grid > button > span {
  display: grid;
  height: 150px;
  place-items: center;
  border-radius: 20px;
  background: #e8f3ef;
  color: #126a5a;
  font-size: 72px;
  font-weight: 900;
}
.grid b {
  font-size: 21px;
}
.grid small {
  min-height: 34px;
  color: #68766f;
}
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background: #0008;
  padding: 20px;
}
.dialog {
  position: relative;
  display: grid;
  width: min(520px, 100%);
  gap: 18px;
  border-radius: 30px;
  background: #fff;
  padding: 42px;
}
.dialog h2 {
  font-size: 34px;
}
.dialog > strong {
  font-size: 24px;
}
.close {
  position: absolute;
  top: 14px;
  right: 14px;
  border: 0;
  background: none;
  font-size: 32px;
}
.quantity {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
}
.quantity button {
  width: 58px;
  height: 58px;
  border: 0;
  border-radius: 18px;
  background: #e8eee9;
  font-size: 28px;
}
.quantity output {
  font-size: 24px;
}
.add {
  min-height: 64px;
  border: 0;
  border-radius: 20px;
  background: #126a5a;
  color: #fff;
  font-size: 18px;
  font-weight: 900;
}
</style>
