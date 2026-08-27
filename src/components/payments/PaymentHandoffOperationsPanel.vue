<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/http'
import {
  cancelPaymentHandoff,
  reassignPaymentHandoff,
  recoverPaymentHandoffByOrder,
  reissuePaymentHandoff,
  type PaymentHandoff,
} from '@/api/paymentHandoff'
import {
  listActivePaymentKioskCandidatesForStaff,
  type PaymentKioskCandidate,
} from '@/api/paymentKioskCandidates'
import { displayLabel } from '@/ui/displayLabels'

const props = defineProps<{
  orderId: string
  orderDisplayNumber: number
  initialHandoff?: PaymentHandoff | null
}>()

const handoff = ref<PaymentHandoff | null>(props.initialHandoff ?? null)
const candidates = ref<PaymentKioskCandidate[]>([])
const selectedDeviceId = ref('')
const loading = ref(false)
const candidateLoading = ref(false)
const errorMessage = ref('')
const notice = ref('')

const canReissue = computed(() =>
  handoff.value ? ['FAILED', 'EXPIRED', 'CANCELLED'].includes(handoff.value.status) : false,
)
const canReassign = computed(() =>
  handoff.value ? ['QUEUED', 'DISPLAYED'].includes(handoff.value.status) : false,
)
const canCancel = computed(() =>
  handoff.value ? ['QUEUED', 'DISPLAYED'].includes(handoff.value.status) : false,
)

watch(
  () => props.initialHandoff,
  (value) => {
    if (value) handoff.value = value
  },
)

onMounted(async () => {
  await Promise.all([refresh(), loadCandidates()])
})

async function refresh() {
  if (loading.value || !props.orderId) return
  loading.value = true
  errorMessage.value = ''
  try {
    handoff.value = await recoverPaymentHandoffByOrder(props.orderId)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      handoff.value = null
      errorMessage.value = '이 주문에 연결된 결제 요청을 찾을 수 없습니다.'
    } else {
      errorMessage.value = '결제 요청의 최신 상태를 불러오지 못했습니다.'
    }
  } finally {
    loading.value = false
  }
}

async function loadCandidates() {
  if (candidateLoading.value) return
  candidateLoading.value = true
  try {
    candidates.value = await listActivePaymentKioskCandidatesForStaff()
  } catch {
    candidates.value = []
  } finally {
    candidateLoading.value = false
  }
}

async function mutate(operation: 'reissue' | 'reassign' | 'cancel') {
  if (!handoff.value || loading.value) return
  if (operation === 'reassign' && !selectedDeviceId.value) {
    errorMessage.value = '재배정할 결제 Kiosk를 명시적으로 선택해 주세요.'
    return
  }
  loading.value = true
  errorMessage.value = ''
  notice.value = ''
  const current = handoff.value
  try {
    handoff.value =
      operation === 'reissue'
        ? await reissuePaymentHandoff(current.id)
        : operation === 'reassign'
          ? await reassignPaymentHandoff(current.id, selectedDeviceId.value)
          : await cancelPaymentHandoff(current.id)
    selectedDeviceId.value = ''
    notice.value =
      operation === 'reissue'
        ? '결제 요청을 재발급했습니다.'
        : operation === 'reassign'
          ? '결제 Kiosk를 재배정했습니다.'
          : '결제 요청을 취소했습니다.'
  } catch (error) {
    if (error instanceof ApiError && [0, 409, 503].includes(error.status)) {
      try {
        handoff.value = await recoverPaymentHandoffByOrder(props.orderId)
      } catch {
        // Keep the last known safe projection and the original operation guidance.
      }
    }
    errorMessage.value = operationMessage(error)
  } finally {
    loading.value = false
  }
}

function operationMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 409)
    return '다른 직원이나 결제 화면에서 상태가 변경되었습니다. 최신 상태를 확인해 주세요.'
  if (error instanceof ApiError && (error.status === 0 || error.status === 503))
    return '요청 결과가 불명확해 서버 상태를 다시 확인했습니다. 새 결제를 만들지 마세요.'
  if (error instanceof ApiError && error.status === 403) return '결제 요청을 관리할 권한이 없습니다.'
  return '결제 요청을 변경하지 못했습니다.'
}

function formatExpiresAt(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('ko-KR')
}
</script>

<template>
  <section class="handoff-panel" aria-labelledby="handoff-operations-title" :aria-busy="loading">
    <div class="heading">
      <div>
        <p>결제 인계 운영</p>
        <h2 id="handoff-operations-title">주문 #{{ orderDisplayNumber }}</h2>
      </div>
      <button type="button" :disabled="loading" @click="refresh">최신 상태 조회</button>
    </div>
    <p v-if="loading && !handoff" role="status">결제 요청을 복구하고 있습니다…</p>
    <template v-else-if="handoff">
      <dl>
        <div><dt>상태</dt><dd>{{ displayLabel(handoff.status) }}</dd></div>
        <div><dt>표시 기기</dt><dd>{{ handoff.targetPaymentDeviceName }}</dd></div>
        <div><dt>결제코드</dt><dd>{{ handoff.displayCode }}</dd></div>
        <div><dt>만료</dt><dd>{{ formatExpiresAt(handoff.expiresAt) }}</dd></div>
        <div><dt>버전</dt><dd>{{ handoff.version }}</dd></div>
      </dl>
      <div class="actions">
        <button type="button" :disabled="loading || !canReissue" @click="mutate('reissue')">
          재발급
        </button>
        <label>
          재배정 기기
          <select v-model="selectedDeviceId" :disabled="loading || !canReassign || candidateLoading">
            <option value="">결제 Kiosk 선택</option>
            <option
              v-for="candidate in candidates"
              :key="candidate.deviceId"
              :value="candidate.deviceId"
            >
              {{ candidate.displayName }}
            </option>
          </select>
        </label>
        <button
          type="button"
          :disabled="loading || !canReassign || !selectedDeviceId"
          @click="mutate('reassign')"
        >
          재배정
        </button>
        <button type="button" :disabled="loading || !canCancel" @click="mutate('cancel')">
          취소
        </button>
      </div>
    </template>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
  </section>
</template>

<style scoped>
.handoff-panel { display:grid; gap:.9rem; border:1px solid var(--color-border); background:#fff; padding:1rem; }
.heading,.heading>div,.actions,dl,dl div { display:flex; align-items:center; gap:.75rem; }.heading{justify-content:space-between}.heading p,.heading h2,dl,dd{margin:0}.heading p{color:var(--color-primary);font-size:.78rem;font-weight:700}.heading h2{font-size:1.05rem}dl{flex-wrap:wrap}dl div{gap:.3rem}dt{color:var(--color-muted)}dd{font-weight:700}.actions{flex-wrap:wrap}.actions label{display:grid;gap:.25rem;font-weight:700}button,select{border:1px solid var(--color-border);border-radius:3px;background:var(--color-background);padding:.55rem}.notice{margin:0;color:#17633b}.error{margin:0;color:#a32d2d}
</style>
