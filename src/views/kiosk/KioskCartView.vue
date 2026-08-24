<script setup lang="ts">
import KioskStatePanel from '@/components/kiosk/KioskStatePanel.vue'
import { formatKrw, multiplyInt64 } from '@/api/int64'
import { useKioskCartStore } from '@/stores/kioskCart'
const cart = useKioskCartStore()
</script>
<template>
  <section class="cart-page">
    <header class="page-heading">
      <div><p>주문 내역</p><h1>주문 확인</h1></div>
      <RouterLink class="back" to="/kiosk">메뉴로 돌아가기</RouterLink>
    </header>
    <div v-if="cart.lines.length" class="content">
      <div class="lines">
        <article v-for="line in cart.lines" :key="line.productId">
          <div class="line-name"><div><h2>{{ line.name }}</h2><small>{{ formatKrw(line.unitPrice) }} / 1개</small></div></div>
          <div class="controls">
            <button
              aria-label="수량 줄이기"
              @click="cart.setQuantity(line.productId, line.quantity - 1)"
            >
              −</button
            ><output>{{ line.quantity }}</output
            ><button
              aria-label="수량 늘리기"
              @click="cart.setQuantity(line.productId, line.quantity + 1)"
            >
              +</button
            ><strong>{{ formatKrw(multiplyInt64(line.unitPrice, line.quantity)) }}</strong><button class="remove" @click="cart.removeItem(line.productId)">삭제</button>
          </div>
        </article>
      </div>
      <aside class="summary">
        <p>주문 내역 <span>총 {{ cart.itemCount }}개</span></p>
        <div class="total"><span>총 결제금액</span><strong>{{ formatKrw(cart.estimatedTotal) }}</strong></div>
        <small>다음 단계에서 매장에서 먹기 또는 포장하기를 선택합니다.</small>
        <RouterLink to="/kiosk/checkout">이용 방법 선택</RouterLink>
        <button @click="cart.clear">장바구니 비우기</button>
      </aside>
    </div>
    <KioskStatePanel v-else title="선택한 메뉴가 없습니다" message="메뉴 화면에서 주문할 상품을 선택해 주세요."
      ><RouterLink class="empty-link" to="/kiosk">메뉴로 돌아가기</RouterLink></KioskStatePanel
    >
  </section>
</template>
<style scoped>
.cart-page { max-width: 1120px; margin: 0 auto; }.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 26px; }.page-heading p { margin: 0 0 5px; color: #087f5b; font-size: 14px; font-weight: 800; }.page-heading h1 { margin: 0; font-size: 32px; letter-spacing: -1px; }.back { border: 1px solid #d1d7d3; border-radius: 4px; padding: 11px 14px; color: #38424a; font-size: 14px; font-weight: 700; }
.content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
}
.lines {
  border: 1px solid #d9ddda; border-radius: 6px; background: #fff;
}
.lines article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px; border-bottom: 1px solid #e9ecea; padding: 18px;
}
.lines article:last-child { border-bottom: 0; }.line-name { min-width: 0; }.line-name h2 { margin: 0 0 4px; font-size: 17px; }.line-name small { color: #70797f; font-size: 13px; }
.controls {
  display: flex;
  align-items: center;
  gap: 9px; white-space: nowrap;
}
.controls button {
  min-width: 38px; height: 38px; border: 1px solid #d7dcd9; border-radius: 4px; background: #fff; font-size: 19px;
}
.controls .remove {
  min-width: auto; border: 0; color: #a13b32; font-size: 13px;
}
.summary { position: sticky; top: 24px; display: grid; align-content: start; gap: 15px; border: 1px solid #cfd6d1; border-radius: 6px; background: #fff; padding: 20px; }.summary > p { display: flex; justify-content: space-between; margin: 0; font-size: 16px; font-weight: 800; }.summary > p span { color: #087f5b; font-size: 13px; }.total { display: grid; gap: 5px; border-top: 1px solid #e7ebe8; padding-top: 15px; }.total span { color: #687078; font-size: 13px; }.total strong { font-size: 25px; }.summary small { color: #6b7280; line-height: 1.5; }
.summary a, .summary button,
.empty-link {
  display: grid; min-height: 54px; place-items: center; border: 0; border-radius: 4px; background: #087f5b; color: #fff; font-weight: 800;
}
.summary button { min-height: auto; background: transparent; color: #687078; font-size: 13px; }
@media (max-width: 800px) {
  .content { grid-template-columns: 1fr; }.summary { position: static; }.lines article { align-items: flex-start; flex-direction: column; gap: 13px; }.controls { width: 100%; justify-content: flex-end; }
}
@media (max-width: 560px) { .page-heading { align-items: start; flex-direction: column; }.controls strong { margin-right: auto; } }
</style>
