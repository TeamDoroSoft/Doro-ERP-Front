<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCurrencyInt64, type Int64String } from '@/api/int64'
import type { OrderResponse } from '@/api/order'
import { createPaymentIdempotencyKey } from '@/api/payment'
import { useOrderPayment } from '@/composables/useOrderPayment'
import { savePendingPayment, saveRecentPaymentId } from '@/payments/pendingPayment'
import { requestTossPayment, tossPaymentErrorMessage } from '@/payments/tossPayment'
import { displayLabel } from '@/ui/displayLabels'

const props = withDefaults(
  defineProps<{
    order: OrderResponse
    recentPaymentId?: string | null
    pollIntervalMs?: number
    maxPollAttempts?: number
  }>(),
  { recentPaymentId: null, pollIntervalMs: 3_000, maxPollAttempts: 5 },
)
const emit = defineEmits<{
  'payment-updated': [paymentId: string, status: string, previousStatus: string]
}>()

const model = useOrderPayment(() => props.order, {
  recentPaymentId: () => props.recentPaymentId,
  pollIntervalMs: props.pollIntervalMs,
  maxPollAttempts: props.maxPollAttempts,
})
const tossError = computed(() => model.errorMessage.value)
const orderName = computed(() => `주문 ${props.order.displayNumber}`.slice(0, 100))
const openingToss = ref(false)

watch(model.payment, (payment, previousPayment) => {
  if (payment) {
    saveRecentPaymentId(props.order.orderId, payment.id)
  }
  if (
    payment &&
    previousPayment &&
    payment.id === previousPayment.id &&
    payment.status !== previousPayment.status
  ) {
    emit('payment-updated', payment.id, payment.status, previousPayment.status)
  }
})
async function startTossPayment() {
  if (openingToss.value) return
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY?.trim()
  if (!clientKey) {
    model.errorMessage.value = '결제를 시작할 수 없습니다. 결제 설정을 확인해 주세요.'
    return
  }
  openingToss.value = true
  try {
    const checkoutPayment = model.canResume.value ? model.payment.value : await model.create()
    if (!checkoutPayment || checkoutPayment.status !== 'PENDING') return

    const flowId = createPaymentIdempotencyKey()
    saveRecentPaymentId(props.order.orderId, checkoutPayment.id)
    savePendingPayment(flowId, {
      payment: checkoutPayment,
      confirmIdempotencyKey: createPaymentIdempotencyKey(),
    })
    try {
      await requestTossPayment({
        clientKey,
        amount: checkoutPayment.amount,
        currency: 'KRW',
        providerOrderId: checkoutPayment.providerOrderId,
        orderName: orderName.value,
        successUrl: redirectUrl('success', flowId),
        failUrl: redirectUrl('fail', flowId),
      })
    } catch (error) {
      model.errorMessage.value = tossPaymentErrorMessage(error)
    }
  } finally {
    openingToss.value = false
  }
}

function redirectUrl(outcome: 'success' | 'fail', flowId: string): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  const url = new URL(`${basePath}/payments/toss/${outcome}`, window.location.origin)
  url.searchParams.set('flow', flowId)
  return url.toString()
}

function formatAmount(amount: Int64String, currency: string) {
  return formatCurrencyInt64(amount, currency)
}
</script>

<template>
  <section class="payment-panel" aria-labelledby="order-payment-title">
    <div class="payment-panel__heading">
      <div>
        <p class="payment-panel__eyebrow">결제</p>
        <h2 id="order-payment-title">주문 결제</h2>
      </div>
      <button
        v-if="model.payment.value"
        type="button"
        :disabled="model.isBusy.value || openingToss"
        @click="model.refresh()"
      >
        새로고침
      </button>
    </div>

    <p v-if="props.order.status !== 'CREATED' && !model.payment.value" class="payment-panel__note">
      현재 주문 상태에서는 새 결제를 시작할 수 없습니다.
    </p>
    <p v-else-if="!model.payment.value" class="payment-panel__amount">
      {{ formatAmount(props.order.totalAmount, props.order.currency) }}
    </p>

    <dl v-if="model.payment.value" class="payment-panel__facts">
      <div>
        <dt>결제 금액</dt>
        <dd>{{ formatAmount(model.payment.value.amount, model.payment.value.currency) }}</dd>
      </div>
      <div>
        <dt>결제 상태</dt>
        <dd>{{ displayLabel(model.payment.value.status) }}</dd>
      </div>
    </dl>

    <p v-if="model.payment.value?.status === 'REVIEW_REQUIRED'" class="payment-panel__notice">
      결제 결과를 바로 확인할 수 없습니다. 결제 상태를 다시 확인해 주세요.
    </p>
    <p v-if="model.cancellationNotice.value" class="payment-panel__notice">
      {{ model.cancellationNotice.value }}
    </p>
    <p v-if="tossError" class="payment-panel__error" role="alert">{{ tossError }}</p>

    <div class="payment-panel__actions">
      <button
        v-if="model.canCreate.value || model.canResume.value"
        type="button"
        class="payment-panel__primary"
        :disabled="model.isBusy.value || openingToss"
        @click="startTossPayment"
      >
        {{
          model.loading.value || openingToss
            ? '결제 화면 여는 중…'
            : model.canResume.value
              ? '결제 계속하기'
              : '결제하기'
        }}
      </button>
      <button
        v-if="model.canCancel.value"
        type="button"
        :disabled="model.isBusy.value || openingToss"
        @click="model.cancel()"
      >
        {{ model.cancelling.value ? '전액 취소 중…' : '전액 취소' }}
      </button>
      <button
        v-if="
          model.payment.value &&
          (model.payment.value.status === 'PENDING' ||
            model.payment.value.status === 'REVIEW_REQUIRED')
        "
        type="button"
        :disabled="model.isBusy.value || openingToss"
        @click="model.startPolling()"
      >
        {{ model.polling.value ? '상태 확인 중' : '결제 상태 확인' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.payment-panel {
  display: grid;
  gap: 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem;
  background: var(--color-background-soft);
}
.payment-panel__heading,
.payment-panel__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.payment-panel__heading h2,
.payment-panel__eyebrow,
.payment-panel__amount,
.payment-panel__note,
.payment-panel__notice,
.payment-panel__error {
  margin: 0;
}
.payment-panel__eyebrow {
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 750;
}
.payment-panel__facts {
  display: grid;
  gap: 0.4rem;
  margin: 0;
}
.payment-panel__facts div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.payment-panel__facts dd {
  margin: 0;
  font-weight: 700;
}
.payment-panel__notice {
  color: #854d0e;
}
.payment-panel__error {
  color: #b91c1c;
}
.payment-panel__primary {
  background: var(--color-primary);
  color: white;
}
</style>
