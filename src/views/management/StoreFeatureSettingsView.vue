<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/http'
import { useStoreSettingsStore } from '@/stores/storeSettings'
import type {
  FeatureCode,
  NotificationEventCode,
  UpdateStoreFeaturesRequest,
} from '@/types/storeSettings'

interface ToggleOption<T extends string> {
  code: T
  label: string
}

interface NotificationGroup {
  title: string
  events: ToggleOption<NotificationEventCode>[]
}

const customerFeatures: ToggleOption<FeatureCode>[] = [
  { code: 'WAITING', label: '웨이팅(대기)' },
  { code: 'RESERVATION', label: '예약' },
  { code: 'QR_ORDER', label: 'QR 주문' },
  { code: 'PICKUP_ORDER', label: '픽업 주문' },
]

const notificationGroups: NotificationGroup[] = [
  {
    title: '웨이팅 알림',
    events: [
      { code: 'WAITING_REGISTERED', label: '웨이팅 등록' },
      { code: 'WAITING_CALLED', label: '웨이팅 호출' },
    ],
  },
  {
    title: '예약 알림',
    events: [
      { code: 'RESERVATION_REQUESTED', label: '예약 신청' },
      { code: 'RESERVATION_APPROVED', label: '예약 승인' },
      { code: 'RESERVATION_REJECTED', label: '예약 거절' },
      { code: 'RESERVATION_CHANGED', label: '예약 변경' },
      { code: 'RESERVATION_CHANGE_REJECTED', label: '예약 변경 거절' },
      { code: 'RESERVATION_CANCELLED', label: '예약 취소' },
      { code: 'RESERVATION_REMINDER', label: '예약 알림(리마인더)' },
    ],
  },
  {
    title: '픽업 알림',
    events: [
      { code: 'PICKUP_ORDER_RECEIVED', label: '픽업 주문 접수' },
      { code: 'PICKUP_READY', label: '픽업 준비 완료' },
    ],
  },
  {
    title: '결제 알림',
    events: [
      { code: 'PAYMENT_COMPLETED', label: '결제 완료' },
      { code: 'PAYMENT_CANCELLED', label: '결제 취소' },
    ],
  },
]

const store = useStoreSettingsStore()
const form = ref<UpdateStoreFeaturesRequest>({
  customerFeatures: {
    WAITING: false,
    RESERVATION: false,
    QR_ORDER: false,
    PICKUP_ORDER: false,
  },
  notificationEvents: {
    WAITING_REGISTERED: false,
    WAITING_CALLED: false,
    RESERVATION_REQUESTED: false,
    RESERVATION_APPROVED: false,
    RESERVATION_REJECTED: false,
    RESERVATION_CHANGED: false,
    RESERVATION_CHANGE_REJECTED: false,
    RESERVATION_CANCELLED: false,
    RESERVATION_REMINDER: false,
    PICKUP_ORDER_RECEIVED: false,
    PICKUP_READY: false,
    PAYMENT_COMPLETED: false,
    PAYMENT_CANCELLED: false,
  },
})
const submitError = ref('')
const hasVersionConflict = ref(false)
const successMessage = ref('')
let successTimer: ReturnType<typeof setTimeout> | undefined

const isInitialLoading = computed(() => store.loading && !store.settings)
const isSaving = computed(() => store.loading && Boolean(store.settings))

watch(
  () => store.settings?.features,
  (features) => {
    if (!features) return
    form.value = {
      customerFeatures: { ...features.customerFeatures },
      notificationEvents: { ...features.notificationEvents },
    }
  },
  { immediate: true },
)

async function loadSettings(): Promise<void> {
  submitError.value = ''
  hasVersionConflict.value = false
  try {
    await store.load()
  } catch {
    // The store exposes the normalized error for the load error state.
  }
}

function showSuccess(): void {
  successMessage.value = '저장됐습니다.'
  if (successTimer) clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    successMessage.value = ''
  }, 3000)
}

async function submit(): Promise<void> {
  const payload: UpdateStoreFeaturesRequest = {
    customerFeatures: { ...form.value.customerFeatures },
    notificationEvents: { ...form.value.notificationEvents },
  }

  submitError.value = ''
  hasVersionConflict.value = false
  successMessage.value = ''

  try {
    await store.saveFeatures(payload)
    form.value = {
      customerFeatures: { ...payload.customerFeatures },
      notificationEvents: { ...payload.notificationEvents },
    }
    showSuccess()
  } catch (caught) {
    if (!(caught instanceof ApiError)) {
      submitError.value = '알 수 없는 오류가 발생했습니다.'
      return
    }
    if (caught.status === 409 && caught.code === 'VERSION_CONFLICT') {
      hasVersionConflict.value = true
      return
    }
    submitError.value = caught.detail
  }
}

onMounted(() => {
  if (!store.settings) void loadSettings()
})

onBeforeUnmount(() => {
  if (successTimer) clearTimeout(successTimer)
})
</script>

<template>
  <main class="store-features">
    <header>
      <h1>기능·알림 이벤트 설정</h1>
      <p>고객이 사용할 기능과 이벤트별 알림 발송 여부를 관리합니다.</p>
    </header>

    <p v-if="isInitialLoading" class="status" role="status">매장 설정을 불러오는 중입니다.</p>

    <section v-else-if="!store.settings" class="error-panel" role="alert">
      <p>{{ store.error?.detail ?? '매장 설정을 불러오지 못했습니다.' }}</p>
      <button type="button" :disabled="store.loading" @click="loadSettings">다시 시도</button>
    </section>

    <form v-else @submit.prevent="submit">
      <section class="settings-section">
        <h2>고객 기능</h2>
        <fieldset>
          <legend>고객 기능 활성화</legend>
          <div class="toggle-grid">
            <label v-for="feature in customerFeatures" :key="feature.code" class="toggle-row">
              <input
                :id="`feature-${feature.code}`"
                v-model="form.customerFeatures[feature.code]"
                type="checkbox"
              />
              <span>{{ feature.label }}</span>
            </label>
          </div>
        </fieldset>
      </section>

      <section class="settings-section">
        <h2>알림 이벤트</h2>
        <div class="notification-groups">
          <fieldset v-for="group in notificationGroups" :key="group.title">
            <legend>{{ group.title }}</legend>
            <div class="toggle-grid">
              <label v-for="event in group.events" :key="event.code" class="toggle-row">
                <input
                  :id="`notification-${event.code}`"
                  v-model="form.notificationEvents[event.code]"
                  type="checkbox"
                />
                <span>{{ event.label }}</span>
              </label>
            </div>
          </fieldset>
        </div>
      </section>

      <div v-if="hasVersionConflict" class="error-panel" role="alert">
        <p>다른 곳에서 먼저 수정됐습니다. 최신 값을 다시 불러온 뒤 다시 시도해 주세요.</p>
        <button type="button" :disabled="store.loading" @click="loadSettings">다시 불러오기</button>
      </div>
      <p v-else-if="submitError" class="submit-error" role="alert">{{ submitError }}</p>
      <p v-if="successMessage" class="success" role="status">{{ successMessage }}</p>

      <button class="save-button" type="submit" :disabled="isSaving">
        {{ isSaving ? '저장 중…' : '저장' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.store-features {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  margin-bottom: 2rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
}

header p {
  color: #5f6368;
}

.settings-section {
  margin-bottom: 2rem;
}

h2 {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 1rem;
  border: 1px solid #d4d7dc;
  border-radius: 0.5rem;
}

legend {
  padding: 0 0.35rem;
  font-weight: 700;
}

.notification-groups {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.toggle-grid {
  display: grid;
  gap: 0.35rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem;
  border-radius: 0.35rem;
  cursor: pointer;
}

.toggle-row:hover {
  background: #f5f7fa;
}

.toggle-row input {
  width: 1.15rem;
  height: 1.15rem;
  margin: 0;
  accent-color: #2457a7;
}

.submit-error,
.error-panel {
  color: #b42318;
}

.error-panel {
  margin-bottom: 1rem;
  padding: 0.9rem;
  border: 1px solid #f0aaa4;
  border-radius: 0.35rem;
  background: #fff5f4;
}

.error-panel p {
  margin-top: 0;
}

.success {
  color: #18794e;
}

button {
  padding: 0.65rem 1rem;
  border: 1px solid #777;
  border-radius: 0.35rem;
  background: white;
  font: inherit;
  cursor: pointer;
}

.save-button {
  min-width: 6rem;
  color: white;
  border-color: #2457a7;
  background: #2457a7;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 600px) {
  .notification-groups {
    grid-template-columns: 1fr;
  }
}
</style>
