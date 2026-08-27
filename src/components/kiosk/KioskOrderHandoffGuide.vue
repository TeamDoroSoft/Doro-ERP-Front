<script setup lang="ts">
defineProps<{
  orderDisplayNumber: string | number
  paymentDeviceName: string
  displayCode: string
}>()
</script>

<template>
  <section class="handoff-guide" aria-labelledby="handoff-title">
    <p>주문번호 {{ orderDisplayNumber }}</p>
    <h1 id="handoff-title">{{ paymentDeviceName }}로 이동해 주세요</h1>
    <div>
      <span>결제코드</span>
      <strong>{{ displayCode }}</strong>
    </div>
    <small>결제 Kiosk 화면의 코드와 같은지 확인해 주세요.</small>
  </section>
</template>

<style scoped>
.handoff-guide {
  display: grid;
  width: min(620px, 100%);
  gap: 20px;
  margin: 7vh auto 0;
  border: 1px solid #cfd6d1;
  border-radius: 8px;
  background: #fff;
  padding: clamp(30px, 6vw, 56px);
  text-align: center;
}
.handoff-guide p { margin: 0; color: #087f5b; font-size: 18px; font-weight: 800; }
.handoff-guide h1 { margin: 0; font-size: clamp(28px, 5vw, 42px); letter-spacing: -0.04em; }
.handoff-guide div { display: grid; gap: 5px; border-block: 1px solid #e3e7e4; padding: 22px; }
.handoff-guide span, .handoff-guide small { color: #626c66; }
.handoff-guide strong { font-size: clamp(42px, 9vw, 72px); letter-spacing: 0.12em; }
</style>
