<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { PaymentHandoffDisplayStatus } from '@/api/paymentHandoff'
import { usePaymentHandoffDisplay } from '@/composables/usePaymentHandoffDisplay'

const display = usePaymentHandoffDisplay()

const statusCopy: Record<PaymentHandoffDisplayStatus, string> = {
  QUEUED: '결제 요청을 준비하고 있어요',
  DISPLAYED: '휴대전화로 QR을 스캔해 주세요',
  PROCESSING: '휴대전화에서 결제를 진행하고 있어요',
  PAID: '결제가 완료되었습니다',
  FAILED: '결제를 완료하지 못했습니다',
  EXPIRED: '결제 시간이 만료되었습니다',
  CANCELLED: '결제 요청이 취소되었습니다',
}

const message = computed(() => {
  const status = display.current.value?.status
  return status ? statusCopy[status] : '결제 요청을 기다리고 있어요'
})
const terminalHelp = computed(() => {
  const status = display.current.value?.status
  return status === 'EXPIRED' || status === 'FAILED' || status === 'CANCELLED'
    ? '직원에게 결제 요청을 다시 보내 달라고 말씀해 주세요.'
    : ''
})

onMounted(display.start)
</script>

<template>
  <section class="payment-display" aria-live="polite">
    <div v-if="display.loading.value" class="payment-card waiting">
      <div class="spinner" aria-hidden="true"></div>
      <h1>결제 요청을 확인하고 있어요</h1>
    </div>
    <div v-else-if="display.current.value" class="payment-card">
      <header>
        <p>결제코드 {{ display.current.value.displayCode }}</p>
        <h1>{{ message }}</h1>
      </header>
      <div class="content">
        <div class="qr-area">
          <div class="qr-placeholder">
            <strong>{{ display.current.value.displayCode }}</strong>
            <span v-if="terminalHelp">{{ terminalHelp }}</span>
            <span v-else-if="display.canDisplayQr.value">
              QR 표시 계약이 준비되면 이 영역에 안전하게 표시됩니다.
            </span>
            <span v-else>결제 화면을 준비하고 있어요.</span>
          </div>
        </div>
        <dl>
          <div><dt>결제코드</dt><dd>{{ display.current.value.displayCode }}</dd></div>
          <div>
            <dt>남은 시간</dt>
            <dd>
              {{
                display.remainingSeconds.value > 0
                  ? `${display.remainingSeconds.value}초`
                  : '서버에서 확인 중'
              }}
            </dd>
          </div>
        </dl>
      </div>
      <p v-if="display.errorMessage.value" class="notice" role="alert">
        {{ display.errorMessage.value }}
      </p>
    </div>
    <div v-else class="payment-card waiting">
      <h1>결제 요청을 기다리고 있어요</h1>
      <p>주문 Kiosk 또는 직원에게 결제 요청을 보내 달라고 말씀해 주세요.</p>
      <p v-if="display.errorMessage.value" class="notice" role="alert">
        {{ display.errorMessage.value }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.payment-display { display: grid; min-height: calc(100dvh - 150px); place-items: center; }
.payment-card { width: min(960px, 100%); border: 1px solid #cfd6d1; border-radius: 8px; background: #fff; padding: clamp(24px, 4vw, 46px); }
.payment-card header { text-align: center; }.payment-card header p { color: #087f5b; font-size: 18px; font-weight: 900; }.payment-card h1 { font-size: clamp(28px, 4vw, 40px); letter-spacing: -0.04em; }
.content { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: clamp(24px, 5vw, 56px); align-items: center; }
.qr-area { display: grid; aspect-ratio: 1; place-items: center; border: 1px solid #dce2de; border-radius: 6px; padding: 18px; }
.qr-placeholder { display: grid; gap: 12px; text-align: center; }.qr-placeholder strong { font-size: 46px; letter-spacing: .12em; }.qr-placeholder span { color: #657068; line-height: 1.5; }
dl { display: grid; gap: 2px; margin: 0; }dl div { display: grid; gap: 5px; border-bottom: 1px solid #e2e6e3; padding: 15px 0; }dt { color: #68716c; font-size: 14px; }dd { margin: 0; font-size: 22px; font-weight: 850; overflow-wrap: anywhere; }
.waiting { display: grid; min-height: 360px; place-items: center; align-content: center; text-align: center; }.waiting p { color: #657068; }
.spinner { width: 42px; height: 42px; border: 4px solid #d7dfda; border-top-color: #087f5b; border-radius: 50%; animation: spin .8s linear infinite; }
.notice { margin: 22px 0 0; border: 1px solid #f1d4a9; border-radius: 4px; background: #fff9ee; padding: 12px; color: #77510e; text-align: center; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 700px) { .content { grid-template-columns: 1fr; }.qr-area { width: min(340px, 100%); margin: auto; } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
</style>
