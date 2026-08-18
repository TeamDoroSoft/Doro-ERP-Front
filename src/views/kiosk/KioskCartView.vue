<script setup lang="ts">
import KioskStatePanel from '@/components/kiosk/KioskStatePanel.vue'
import { useKioskCartStore } from '@/stores/kioskCart'
const cart = useKioskCartStore(),
  money = (n: number) => `${n.toLocaleString('ko-KR')}원`
</script>
<template>
  <section>
    <header>
      <p>장바구니</p>
      <h1>주문할 메뉴를 확인해주세요</h1>
    </header>
    <div v-if="cart.lines.length" class="content">
      <div class="lines">
        <article v-for="line in cart.lines" :key="line.productId">
          <div>
            <h2>{{ line.name }}</h2>
            <strong>{{ money(line.unitPrice * line.quantity) }}</strong>
          </div>
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
            ><button class="remove" @click="cart.removeItem(line.productId)">삭제</button>
          </div>
        </article>
      </div>
      <aside>
        <p>총 {{ cart.itemCount }}개</p>
        <strong>{{ money(cart.estimatedTotal) }}</strong
        ><small>최종 금액은 주문 확인 시 확정됩니다.</small
        ><RouterLink to="/kiosk/checkout">주문하기</RouterLink
        ><RouterLink class="secondary" to="/kiosk">계속 주문</RouterLink
        ><button @click="cart.clear">장바구니 비우기</button>
      </aside>
    </div>
    <KioskStatePanel v-else title="장바구니가 비어 있어요" message="메뉴를 골라 담아주세요."
      ><RouterLink class="empty-link" to="/kiosk">메뉴 보러 가기</RouterLink></KioskStatePanel
    >
  </section>
</template>
<style scoped>
header {
  margin-bottom: 26px;
}
header p {
  color: #126a5a;
  font-weight: 900;
}
header h1 {
  font-size: 40px;
}
.content {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 22px;
}
.lines {
  display: grid;
  gap: 12px;
}
.lines article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 22px;
  background: #fff;
  padding: 22px;
}
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.controls button {
  min-width: 48px;
  height: 48px;
  border: 0;
  border-radius: 14px;
  background: #e8eee9;
  font-size: 20px;
}
.controls .remove {
  font-size: 14px;
  color: #b42318;
}
aside {
  display: grid;
  align-content: start;
  gap: 12px;
  border-radius: 24px;
  background: #17211d;
  padding: 24px;
  color: #fff;
}
aside > strong {
  font-size: 32px;
}
aside small {
  color: #bac4bf;
}
aside a,
aside button,
.empty-link {
  display: grid;
  min-height: 56px;
  place-items: center;
  border: 0;
  border-radius: 17px;
  background: #f5bd43;
  color: #17211d;
  font-weight: 900;
}
.secondary,
aside button {
  background: #fff !important;
}
@media (max-width: 800px) {
  .content {
    grid-template-columns: 1fr;
  }
  .lines article {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
}
</style>
