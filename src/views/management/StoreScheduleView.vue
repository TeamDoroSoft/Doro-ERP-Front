<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/http'
import { useStoreSettingsStore } from '@/stores/storeSettings'
import type {
  DayOfWeek,
  ServiceType,
  StoreSchedule,
  TemporaryClosure,
  TimePeriod,
  UpdateStoreScheduleRequest,
} from '@/types/storeSettings'

type PeriodsByDay = Record<DayOfWeek, TimePeriod[]>
type ScheduleFieldError = { field: string; message: string }

const DAYS: { code: DayOfWeek; label: string }[] = [
  { code: 'MONDAY', label: '월요일' },
  { code: 'TUESDAY', label: '화요일' },
  { code: 'WEDNESDAY', label: '수요일' },
  { code: 'THURSDAY', label: '목요일' },
  { code: 'FRIDAY', label: '금요일' },
  { code: 'SATURDAY', label: '토요일' },
  { code: 'SUNDAY', label: '일요일' },
]
const SERVICES: { code: ServiceType; label: string; slug: string }[] = [
  { code: 'ORDER', label: '주문 가능 시간', slug: 'order' },
  { code: 'RESERVATION', label: '예약 가능 시간', slug: 'reservation' },
]

const store = useStoreSettingsStore()
const businessHours = ref<PeriodsByDay>(emptyPeriodsByDay())
const regularClosedDays = ref<DayOfWeek[]>([])
const temporaryClosures = ref<TemporaryClosure[]>([])
const serviceWindows = ref<Record<ServiceType, PeriodsByDay>>({
  ORDER: emptyPeriodsByDay(),
  RESERVATION: emptyPeriodsByDay(),
})
const fieldErrors = ref<ScheduleFieldError[]>([])
const submitError = ref('')
const hasVersionConflict = ref(false)
const successMessage = ref('')
let successTimer: ReturnType<typeof setTimeout> | undefined

const isInitialLoading = computed(() => store.loading && !store.settings)
const isSaving = computed(() => store.loading && Boolean(store.settings))

function emptyPeriodsByDay(): PeriodsByDay {
  return {
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
    SUNDAY: [],
  }
}

function copyPeriods(source: StoreSchedule['businessHours'] | undefined): PeriodsByDay {
  const result = emptyPeriodsByDay()
  for (const { code } of DAYS) {
    result[code] = (source?.[code] ?? []).map((period) => ({ ...period }))
  }
  return result
}

function applySchedule(schedule: StoreSchedule): void {
  businessHours.value = copyPeriods(schedule.businessHours)
  regularClosedDays.value = [...schedule.regularClosedDays]
  temporaryClosures.value = schedule.temporaryClosures.map((closure) => ({ ...closure }))
  serviceWindows.value = {
    ORDER: copyPeriods(schedule.serviceWindows.ORDER),
    RESERVATION: copyPeriods(schedule.serviceWindows.RESERVATION),
  }
}

watch(
  () => store.settings?.schedule,
  (schedule) => {
    if (schedule) applySchedule(schedule)
  },
  { immediate: true },
)

function addPeriod(periods: PeriodsByDay, day: DayOfWeek): void {
  periods[day].push({ start: '', end: '' })
}

function removePeriod(periods: PeriodsByDay, day: DayOfWeek, index: number): void {
  periods[day].splice(index, 1)
}

function addTemporaryClosure(): void {
  temporaryClosures.value.push({ date: '', reason: '' })
}

function removeTemporaryClosure(index: number): void {
  temporaryClosures.value.splice(index, 1)
}

function compactPeriods(periods: PeriodsByDay): StoreSchedule['businessHours'] {
  const result: StoreSchedule['businessHours'] = {}
  for (const { code } of DAYS) {
    if (periods[code].length > 0) {
      result[code] = periods[code].map((period) => ({ ...period }))
    }
  }
  return result
}

function dayLabel(code: string): string {
  return DAYS.find((day) => day.code === code)?.label ?? code
}

function readableField(field: string): string {
  const parts = field.split('.')
  if (parts[0] === 'businessHours' && parts[1]) {
    return `${dayLabel(parts[1])} 영업시간`
  }
  if (parts[0] === 'serviceWindows' && parts[1] && parts[2]) {
    const service = parts[1] === 'ORDER' ? '주문 가능 시간' : '예약 가능 시간'
    return `${service}(${dayLabel(parts[2])})`
  }
  if (parts[0] === 'regularClosedDays') return '정기 휴무 요일'
  if (parts[0] === 'temporaryClosures') return '임시 휴무'
  return field
}

function validatePeriods(periods: PeriodsByDay, fieldPrefix: string): ScheduleFieldError[] {
  const errors: ScheduleFieldError[] = []
  for (const { code } of DAYS) {
    periods[code].forEach((period, index) => {
      const field = `${fieldPrefix}.${code}`
      if (!period.start || !period.end) {
        errors.push({ field, message: `${index + 1}번째 구간의 시작과 종료 시각을 입력해 주세요.` })
      } else if (period.start === period.end) {
        errors.push({ field, message: `${index + 1}번째 구간의 시작과 종료 시각은 달라야 합니다.` })
      }
    })
  }
  return errors
}

function validate(): boolean {
  const errors = validatePeriods(businessHours.value, 'businessHours')
  errors.push(...validatePeriods(serviceWindows.value.ORDER, 'serviceWindows.ORDER'))
  errors.push(...validatePeriods(serviceWindows.value.RESERVATION, 'serviceWindows.RESERVATION'))
  temporaryClosures.value.forEach((closure, index) => {
    if (!closure.date) {
      errors.push({ field: 'temporaryClosures', message: `${index + 1}번째 휴무 날짜를 입력해 주세요.` })
    }
  })
  fieldErrors.value = errors
  return errors.length === 0
}

function createPayload(): UpdateStoreScheduleRequest {
  return {
    businessHours: compactPeriods(businessHours.value),
    regularClosedDays: [...regularClosedDays.value],
    temporaryClosures: temporaryClosures.value.map((closure) => ({
      date: closure.date,
      reason: closure.reason.trim(),
    })),
    serviceWindows: {
      ORDER: compactPeriods(serviceWindows.value.ORDER),
      RESERVATION: compactPeriods(serviceWindows.value.RESERVATION),
    },
  }
}

async function loadSettings(): Promise<void> {
  submitError.value = ''
  fieldErrors.value = []
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
  submitError.value = ''
  fieldErrors.value = []
  hasVersionConflict.value = false
  successMessage.value = ''
  if (!validate()) return

  try {
    await store.saveSchedule(createPayload())
    if (store.settings) applySchedule(store.settings.schedule)
    showSuccess()
  } catch (caught) {
    if (!(caught instanceof ApiError)) {
      submitError.value = '알 수 없는 오류가 발생했습니다.'
      return
    }
    fieldErrors.value = caught.fieldErrors.map((error) => ({
      field: error.field,
      message: error.code,
    }))
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
  <main class="store-schedule">
    <header>
      <h1>영업·휴무·서비스 시간</h1>
      <p>요일별 영업시간과 휴무일, 주문·예약 가능 시간을 관리합니다.</p>
    </header>

    <p v-if="isInitialLoading" class="status" role="status">운영 일정을 불러오는 중입니다.</p>

    <section v-else-if="!store.settings" class="error-panel" role="alert">
      <p>{{ store.error?.detail ?? '운영 일정을 불러오지 못했습니다.' }}</p>
      <button type="button" :disabled="store.loading" @click="loadSettings">다시 시도</button>
    </section>

    <form v-else novalidate @submit.prevent="submit">
      <section class="schedule-section" aria-labelledby="business-hours-heading">
        <h2 id="business-hours-heading">영업시간</h2>
        <p class="help">종료 시각이 시작보다 이르면 다음날 새벽까지 이어지는 영업으로 처리됩니다.</p>

        <div v-for="day in DAYS" :key="day.code" class="day-section">
          <h3>{{ day.label }}</h3>
          <div
            v-for="(period, index) in businessHours[day.code]"
            :key="index"
            class="period-row"
          >
            <div class="time-field">
              <label :for="`business-${day.code}-${index}-start`">시작 시각</label>
              <input
                :id="`business-${day.code}-${index}-start`"
                v-model="period.start"
                type="time"
                required
              />
            </div>
            <span aria-hidden="true">~</span>
            <div class="time-field">
              <label :for="`business-${day.code}-${index}-end`">종료 시각</label>
              <input
                :id="`business-${day.code}-${index}-end`"
                v-model="period.end"
                type="time"
                required
              />
            </div>
            <button
              type="button"
              class="remove-button"
              :aria-label="`${day.label} 영업시간 ${index + 1}번째 구간 삭제`"
              @click="removePeriod(businessHours, day.code, index)"
            >
              삭제
            </button>
          </div>
          <p v-if="businessHours[day.code].length === 0" class="empty">설정된 구간 없음</p>
          <button
            type="button"
            :aria-label="`${day.label} 영업시간 구간 추가`"
            @click="addPeriod(businessHours, day.code)"
          >
            구간 추가
          </button>
        </div>
      </section>

      <fieldset class="schedule-section closed-days">
        <legend>정기 휴무 요일</legend>
        <label v-for="day in DAYS" :key="day.code">
          <input v-model="regularClosedDays" type="checkbox" :value="day.code" />
          {{ day.label }}
        </label>
      </fieldset>

      <section class="schedule-section" aria-labelledby="temporary-closures-heading">
        <h2 id="temporary-closures-heading">임시 휴무</h2>
        <div
          v-for="(closure, index) in temporaryClosures"
          :key="index"
          class="closure-row"
        >
          <div class="date-field">
            <label :for="`closure-${index}-date`">휴무 날짜</label>
            <input :id="`closure-${index}-date`" v-model="closure.date" type="date" required />
          </div>
          <div class="reason-field">
            <label :for="`closure-${index}-reason`">사유 (선택)</label>
            <input :id="`closure-${index}-reason`" v-model="closure.reason" type="text" />
          </div>
          <button
            type="button"
            class="remove-button"
            :aria-label="`${index + 1}번째 임시 휴무 삭제`"
            @click="removeTemporaryClosure(index)"
          >
            삭제
          </button>
        </div>
        <p v-if="temporaryClosures.length === 0" class="empty">등록된 임시 휴무 없음</p>
        <button type="button" aria-label="임시 휴무 추가" @click="addTemporaryClosure">
          임시 휴무 추가
        </button>
      </section>

      <section
        v-for="service in SERVICES"
        :key="service.code"
        class="schedule-section"
        :aria-labelledby="`${service.slug}-heading`"
      >
        <h2 :id="`${service.slug}-heading`">{{ service.label }}</h2>
        <p class="help">영업시간 안에서 설정해 주세요. 자정을 넘기는 구간도 입력할 수 있습니다.</p>
        <div v-for="day in DAYS" :key="day.code" class="day-section">
          <h3>{{ day.label }}</h3>
          <div
            v-for="(period, index) in serviceWindows[service.code][day.code]"
            :key="index"
            class="period-row"
          >
            <div class="time-field">
              <label :for="`${service.slug}-${day.code}-${index}-start`">시작 시각</label>
              <input
                :id="`${service.slug}-${day.code}-${index}-start`"
                v-model="period.start"
                type="time"
                required
              />
            </div>
            <span aria-hidden="true">~</span>
            <div class="time-field">
              <label :for="`${service.slug}-${day.code}-${index}-end`">종료 시각</label>
              <input
                :id="`${service.slug}-${day.code}-${index}-end`"
                v-model="period.end"
                type="time"
                required
              />
            </div>
            <button
              type="button"
              class="remove-button"
              :aria-label="`${day.label} ${service.label} ${index + 1}번째 구간 삭제`"
              @click="removePeriod(serviceWindows[service.code], day.code, index)"
            >
              삭제
            </button>
          </div>
          <p v-if="serviceWindows[service.code][day.code].length === 0" class="empty">
            설정된 구간 없음
          </p>
          <button
            type="button"
            :aria-label="`${day.label} ${service.label} 구간 추가`"
            @click="addPeriod(serviceWindows[service.code], day.code)"
          >
            구간 추가
          </button>
        </div>
      </section>

      <div v-if="hasVersionConflict" class="error-panel" role="alert">
        <p>다른 곳에서 먼저 수정됐습니다. 최신 값을 다시 불러온 뒤 다시 시도해 주세요.</p>
        <button type="button" :disabled="store.loading" @click="loadSettings">다시 불러오기</button>
      </div>
      <div v-else-if="submitError || fieldErrors.length" class="error-panel" role="alert">
        <p v-if="submitError">{{ submitError }}</p>
        <ul v-if="fieldErrors.length">
          <li v-for="(error, index) in fieldErrors" :key="`${error.field}-${index}`">
            <strong>{{ readableField(error.field) }}:</strong> {{ error.message }}
          </li>
        </ul>
      </div>
      <p v-if="successMessage" class="success" role="status">{{ successMessage }}</p>

      <button class="save-button" type="submit" :disabled="isSaving">
        {{ isSaving ? '저장 중…' : '저장' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.store-schedule {
  width: min(100%, 960px);
  margin: 0 auto;
  padding: 2rem 1rem;
}

header,
.schedule-section {
  margin-bottom: 2rem;
}

h1,
h2,
h3 {
  margin-top: 0;
}

h1 {
  margin-bottom: 0.5rem;
  font-size: 1.75rem;
}

h2,
legend {
  font-size: 1.35rem;
  font-weight: 700;
}

h3 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

header p,
.help,
.empty {
  color: #5f6368;
}

.help {
  margin-top: -0.5rem;
  font-size: 0.875rem;
}

.day-section {
  padding: 1rem 0;
  border-bottom: 1px solid #e1e4e8;
}

.period-row,
.closure-row {
  display: flex;
  align-items: end;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.time-field,
.date-field {
  flex: 0 1 11rem;
}

.reason-field {
  flex: 1 1 15rem;
}

label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 600;
}

input[type='time'],
input[type='date'],
input[type='text'] {
  box-sizing: border-box;
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid #b7bcc3;
  border-radius: 0.35rem;
  font: inherit;
}

.closed-days {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #b7bcc3;
  border-radius: 0.35rem;
}

.closed-days legend {
  padding: 0 0.35rem;
}

.closed-days label {
  margin: 0;
}

.empty {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}

button {
  padding: 0.6rem 0.9rem;
  border: 1px solid #777;
  border-radius: 0.35rem;
  background: white;
  font: inherit;
  cursor: pointer;
}

.remove-button {
  color: #b42318;
}

.error-panel {
  margin-bottom: 1rem;
  padding: 0.9rem;
  color: #b42318;
  border: 1px solid #f0aaa4;
  border-radius: 0.35rem;
  background: #fff5f4;
}

.error-panel p {
  margin-top: 0;
}

.error-panel ul {
  margin-bottom: 0;
}

.success {
  color: #18794e;
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

@media (max-width: 640px) {
  .period-row,
  .closure-row {
    align-items: stretch;
    flex-direction: column;
  }

  .time-field,
  .date-field,
  .reason-field {
    width: 100%;
    flex-basis: auto;
  }
}
</style>
