<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/http'
import { useStoreSettingsStore } from '@/stores/storeSettings'
import type { UpdateStoreProfileRequest } from '@/types/storeSettings'

type ProfileField = keyof UpdateStoreProfileRequest
type FieldErrors = Partial<Record<ProfileField, string>>

const store = useStoreSettingsStore()
const form = ref<UpdateStoreProfileRequest>({
  name: '',
  address: '',
  contact: '',
  timeZone: '',
})
const fieldErrors = ref<FieldErrors>({})
const submitError = ref('')
const hasVersionConflict = ref(false)
const successMessage = ref('')
let successTimer: ReturnType<typeof setTimeout> | undefined

const isInitialLoading = computed(() => store.loading && !store.settings)
const isSaving = computed(() => store.loading && Boolean(store.settings))

watch(
  () => store.settings?.profile,
  (profile) => {
    if (!profile) return
    form.value = { ...profile }
  },
  { immediate: true },
)

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

function validate(payload: UpdateStoreProfileRequest): boolean {
  const errors: FieldErrors = {}
  if (!payload.name || payload.name.length > 100) {
    errors.name = '매장명은 1~100자로 입력해 주세요.'
  }
  if (!payload.address || payload.address.length > 255) {
    errors.address = '주소는 1~255자로 입력해 주세요.'
  }
  if (!payload.contact || payload.contact.length > 50) {
    errors.contact = '연락처는 1~50자로 입력해 주세요.'
  }
  if (!payload.timeZone || !isValidTimeZone(payload.timeZone)) {
    errors.timeZone = '유효한 IANA Time Zone ID를 입력해 주세요.'
  }
  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

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
  const payload: UpdateStoreProfileRequest = {
    name: form.value.name.trim(),
    address: form.value.address.trim(),
    contact: form.value.contact.trim(),
    timeZone: form.value.timeZone.trim(),
  }

  submitError.value = ''
  hasVersionConflict.value = false
  successMessage.value = ''
  if (!validate(payload)) return

  try {
    await store.saveProfile(payload)
    form.value = { ...payload }
    showSuccess()
  } catch (caught) {
    if (!(caught instanceof ApiError)) {
      submitError.value = '알 수 없는 오류가 발생했습니다.'
      return
    }

    const serverFieldErrors: FieldErrors = {}
    for (const error of caught.fieldErrors) {
      if (['name', 'address', 'contact', 'timeZone'].includes(error.field)) {
        serverFieldErrors[error.field as ProfileField] = error.code
      }
    }
    fieldErrors.value = serverFieldErrors

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
  <main class="store-profile">
    <header>
      <h1>매장 기본 정보</h1>
      <p>고객에게 안내할 매장 정보를 관리합니다.</p>
    </header>

    <p v-if="isInitialLoading" class="status" role="status">매장 정보를 불러오는 중입니다.</p>

    <section v-else-if="!store.settings" class="error-panel" role="alert">
      <p>{{ store.error?.detail ?? '매장 정보를 불러오지 못했습니다.' }}</p>
      <button type="button" :disabled="store.loading" @click="loadSettings">다시 시도</button>
    </section>

    <form v-else novalidate @submit.prevent="submit">
      <div class="field">
        <label for="store-name">매장명</label>
        <input
          id="store-name"
          v-model="form.name"
          type="text"
          maxlength="100"
          required
          :aria-invalid="Boolean(fieldErrors.name)"
          :aria-describedby="fieldErrors.name ? 'store-name-error' : undefined"
        />
        <p v-if="fieldErrors.name" id="store-name-error" class="field-error">
          {{ fieldErrors.name }}
        </p>
      </div>

      <div class="field">
        <label for="store-address">주소</label>
        <input
          id="store-address"
          v-model="form.address"
          type="text"
          maxlength="255"
          required
          :aria-invalid="Boolean(fieldErrors.address)"
          :aria-describedby="fieldErrors.address ? 'store-address-error' : undefined"
        />
        <p v-if="fieldErrors.address" id="store-address-error" class="field-error">
          {{ fieldErrors.address }}
        </p>
      </div>

      <div class="field">
        <label for="store-contact">연락처</label>
        <input
          id="store-contact"
          v-model="form.contact"
          type="tel"
          maxlength="50"
          required
          :aria-invalid="Boolean(fieldErrors.contact)"
          :aria-describedby="fieldErrors.contact ? 'store-contact-error' : undefined"
        />
        <p v-if="fieldErrors.contact" id="store-contact-error" class="field-error">
          {{ fieldErrors.contact }}
        </p>
      </div>

      <div class="field">
        <label for="store-time-zone">시간대</label>
        <input
          id="store-time-zone"
          v-model="form.timeZone"
          type="text"
          placeholder="Asia/Seoul"
          required
          :aria-invalid="Boolean(fieldErrors.timeZone)"
          :aria-describedby="fieldErrors.timeZone ? 'store-time-zone-error' : 'time-zone-help'"
        />
        <p id="time-zone-help" class="help">IANA Time Zone ID를 입력해 주세요. 예: Asia/Seoul</p>
        <p v-if="fieldErrors.timeZone" id="store-time-zone-error" class="field-error">
          {{ fieldErrors.timeZone }}
        </p>
      </div>

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
.store-profile {
  width: min(100%, 680px);
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

header p,
.help {
  color: #5f6368;
}

.field {
  margin-bottom: 1.25rem;
}

label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 600;
}

input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 1px solid #b7bcc3;
  border-radius: 0.35rem;
  font: inherit;
}

input[aria-invalid='true'] {
  border-color: #b42318;
}

.help,
.field-error {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
}

.field-error,
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
</style>
