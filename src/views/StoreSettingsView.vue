<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  changeEmployeeRole,
  changeEmployeeStatus,
  changeKioskMode,
  changeStoreStatus,
  createEmployee,
  getEmployees,
  getKiosks,
  getStore,
  reauthenticate,
  registerKiosk,
  resetEmployeePassword,
  revokeKiosk,
  rotateKiosk,
  updateStore,
  type EmployeeView,
  type KioskCredentialView,
  type KioskDeviceView,
  type KioskMode,
  type Role,
  type StoreView,
} from '@/api/administration'
import { ApiError, safeApiErrorMessage } from '@/api/http'
import { loginIdError, temporaryPasswordError } from '@/validation/credentials'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import { displayLabel } from '@/ui/displayLabels'
import { issuedActivationSecret } from '@/security/kioskCredential'
const session = useOperatorSessionStore(),
  tab = ref<'store' | 'employees' | 'kiosk'>('store'),
  store = ref<StoreView | null>(null),
  employees = ref<EmployeeView[]>([]),
  kiosks = ref<KioskDeviceView[]>([]),
  kioskLoading = ref(false),
  kioskLoaded = ref(false),
  kioskError = ref<ApiError | null>(null),
  loading = ref(false),
  busy = ref(false),
  error = ref<ApiError | null>(null),
  notice = ref(''),
  reauthPassword = ref(''),
  pendingAction = ref<{ execute: () => Promise<unknown>; message: string } | null>(null),
  deviceCode = ref(''),
  kioskDisplayName = ref(''),
  issued = ref<KioskCredentialView | null>(null),
  issuedDeviceCode = ref(''),
  copyFeedback = ref('')
const storeForm = reactive({ name: '', timezone: '' }),
  employeeForm = reactive({ loginId: '', temporaryPassword: '', role: 'STAFF' as Role }),
  resetForm = reactive({ employeeId: '', password: '' }),
  createKey = ref(crypto.randomUUID()),
  resetKey = ref(crypto.randomUUID())
const kioskModeDrafts = reactive<Record<string, { mode: KioskMode; pairedPaymentDeviceId: string }>>(
  {},
)
const activeOwnerCount = computed(
  () => employees.value.filter((e) => e.role === 'OWNER' && e.status === 'ACTIVE').length,
)
const employeeLoginIdError = computed(() =>
  employeeForm.loginId ? loginIdError(employeeForm.loginId) : '',
)
const employeePasswordError = computed(() =>
  employeeForm.temporaryPassword
    ? temporaryPasswordError(employeeForm.temporaryPassword, employeeForm.loginId)
    : '',
)
const resetPasswordError = computed(() => {
  const loginId =
    employees.value.find((employee) => employee.id === resetForm.employeeId)?.loginId ?? ''
  return resetForm.password ? temporaryPasswordError(resetForm.password, loginId) : ''
})
const settingsErrorMessage = computed(() =>
  error.value?.code === 'AUTHENTICATION_FAILED'
    ? '현재 비밀번호가 올바르지 않습니다. 다시 입력해 주세요.'
    : safeApiErrorMessage(error.value),
)
const issuedSecret = computed(() =>
  issued.value ? issuedActivationSecret(issued.value.credential) : null,
)
watch(
  () => [employeeForm.loginId, employeeForm.temporaryPassword, employeeForm.role],
  () => {
    createKey.value = crypto.randomUUID()
  },
)
watch(
  () => [resetForm.employeeId, resetForm.password],
  () => {
    resetKey.value = crypto.randomUUID()
  },
)
watch(tab, (current) => {
  if (current === 'kiosk' && !kioskLoaded.value) void loadKiosks()
})
onMounted(loadAll)
async function loadAll() {
  loading.value = true
  error.value = null
  try {
    const [s, e] = await Promise.all([getStore(), getEmployees()])
    store.value = s
    Object.assign(storeForm, { name: s.name, timezone: s.timezone })
    employees.value = e
  } catch (e) {
    error.value = asError(e)
  } finally {
    loading.value = false
  }
}
async function loadKiosks() {
  kioskLoading.value = true
  kioskError.value = null
  try {
    kiosks.value = await getKiosks()
    for (const kiosk of kiosks.value) {
      kioskModeDrafts[kiosk.id] = {
        mode: kiosk.mode ?? 'ORDER',
        pairedPaymentDeviceId: kiosk.pairedPaymentDeviceId ?? '',
      }
    }
    kioskLoaded.value = true
  } catch (e) {
    kioskError.value = asError(e)
  } finally {
    kioskLoading.value = false
  }
}
async function run(action: () => Promise<unknown>, message: string) {
  busy.value = true
  error.value = null
  notice.value = ''
  try {
    await action()
    notice.value = message
    await loadAll()
  } catch (e) {
    error.value = asError(e)
  } finally {
    busy.value = false
  }
}
function requireReauth(action: () => Promise<unknown>, message: string) {
  error.value = null
  notice.value = ''
  reauthPassword.value = ''
  pendingAction.value = { execute: action, message }
}
function cancelReauth() {
  pendingAction.value = null
  reauthPassword.value = ''
}
async function confirmReauth() {
  if (!pendingAction.value || !reauthPassword.value) return
  const pending = pendingAction.value
  busy.value = true
  error.value = null
  try {
    await reauthenticate(reauthPassword.value)
    pendingAction.value = null
  } catch (e) {
    error.value = asError(e)
    reauthPassword.value = ''
    busy.value = false
    return
  }
  reauthPassword.value = ''
  try {
    await pending.execute()
    notice.value = pending.message
    await loadAll()
  } catch (e) {
    const actionError = asError(e)
    await loadAll().catch(() => undefined)
    error.value = actionError
  } finally {
    busy.value = false
  }
}
function saveStore() {
  return run(async () => {
    store.value = await updateStore(storeForm.name, storeForm.timezone)
  }, '매장 정보가 저장되었습니다.')
}
function toggleStore() {
  if (!store.value) return
  return run(async () => {
    store.value = await changeStoreStatus(store.value!.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
  }, '매장 상태가 변경되었습니다.')
}
function addEmployee() {
  if (employeeLoginIdError.value || employeePasswordError.value) return
  const key = createKey.value
  return requireReauth(async () => {
    await createEmployee({ ...employeeForm }, key)
    employeeForm.loginId = ''
    employeeForm.temporaryPassword = ''
    employeeForm.role = 'STAFF'
    createKey.value = crypto.randomUUID()
  }, '직원이 등록되었습니다.')
}
function canManage(e: EmployeeView) {
  if (e.id === session.employeeId) return false
  if (session.role === 'MANAGER') return e.role === 'STAFF'
  return true
}
function protectedOwner(e: EmployeeView) {
  return e.role === 'OWNER' && e.status === 'ACTIVE' && activeOwnerCount.value === 1
}
function setRole(e: EmployeeView, role: Role, select: HTMLSelectElement) {
  select.value = e.role
  return requireReauth(() => changeEmployeeRole(e.id, role), '직원 권한이 변경되었습니다.')
}
function toggleEmployee(e: EmployeeView) {
  return requireReauth(
    () => changeEmployeeStatus(e.id, e.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    '직원 상태가 변경되었습니다.',
  )
}
function resetPassword() {
  if (resetPasswordError.value) return
  const key = resetKey.value,
    id = resetForm.employeeId,
    password = resetForm.password
  return requireReauth(async () => {
    await resetEmployeePassword(id, password, key)
    resetForm.employeeId = ''
    resetForm.password = ''
    resetKey.value = crypto.randomUUID()
  }, '임시 비밀번호가 설정되었습니다.')
}
function addKiosk() {
  const registeredDeviceCode = deviceCode.value.trim()
  const registeredDisplayName = kioskDisplayName.value.trim()
  copyFeedback.value = ''
  return requireReauth(async () => {
    issued.value = await registerKiosk(registeredDeviceCode, registeredDisplayName)
    issuedDeviceCode.value = registeredDeviceCode
    copyFeedback.value = ''
    deviceCode.value = ''
    kioskDisplayName.value = ''
    await loadKiosks()
  }, '키오스크 기기가 등록되었습니다.')
}
function rotate(kiosk?: KioskDeviceView) {
  const kioskDeviceId = kiosk?.id ?? issued.value?.kioskDeviceId
  if (!kioskDeviceId) return
  copyFeedback.value = ''
  return requireReauth(async () => {
    issued.value = await rotateKiosk(kioskDeviceId)
    if (kiosk) issuedDeviceCode.value = kiosk.deviceCode
    copyFeedback.value = ''
    await loadKiosks()
  }, '기기 활성화 정보를 새로 발급했습니다.')
}
function revoke(kiosk?: KioskDeviceView) {
  const kioskDeviceId = kiosk?.id ?? issued.value?.kioskDeviceId
  if (!kioskDeviceId) return
  return requireReauth(async () => {
    await revokeKiosk(kioskDeviceId)
    if (issued.value?.kioskDeviceId === kioskDeviceId) clearIssued()
    await loadKiosks()
  }, '키오스크 기기 이용을 중지했습니다.')
}
function saveKioskMode(kiosk: KioskDeviceView) {
  const draft = kioskModeDrafts[kiosk.id]
  if (!draft) return
  return requireReauth(async () => {
    try {
      await changeKioskMode(kiosk.id, draft.mode, draft.pairedPaymentDeviceId || null)
    } catch (caught) {
      // A mode/pair conflict usually means an active handoff or a concurrently changed device.
      // Refresh the server projection before asking the operator to retry.
      if (caught instanceof ApiError && caught.status === 409) await loadKiosks()
      throw caught
    }
    await loadKiosks()
  }, '키오스크 모드가 변경되었습니다.')
}
function kioskModeLabel(mode: KioskMode | undefined) {
  if (mode === 'ENTRY_QUEUE') return '입장 대기열'
  if (mode === 'PAYMENT') return '결제'
  return '상품 주문'
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : '접속 기록 없음'
}
function clearIssued() {
  issued.value = null
  issuedDeviceCode.value = ''
  copyFeedback.value = ''
}
async function copyIssuedValue(value: string, label: string) {
  copyFeedback.value = ''
  try {
    const clipboard = navigator.clipboard
    if (!clipboard?.writeText) throw new Error('Clipboard API is unavailable')
    await clipboard.writeText(value)
    copyFeedback.value = `${label}를 복사했습니다.`
  } catch {
    copyFeedback.value = '복사하지 못했습니다. 브라우저 권한을 확인하고 직접 선택해 주세요.'
  }
}
function asError(e: unknown) {
  return e instanceof ApiError
    ? e
    : new ApiError(0, { code: 'NETWORK_ERROR', detail: '연결 상태를 확인해 주세요.' })
}
</script>
<template>
  <section class="page">
    <PageHeader
      title="매장·직원 설정"
      description="매장 정보, 직원 계정, 키오스크 기기를 관리합니다."
      eyebrow="운영 설정"
    />
    <nav class="tabs">
      <button
        v-for="item in [
          ['store', '매장'],
          ['employees', '직원'],
          ['kiosk', '키오스크 기기'],
        ]"
        :key="item[0]"
        :class="{ active: tab === item[0] }"
        @click="tab = item[0] as typeof tab"
      >
        {{ item[1] }}
      </button>
    </nav>
    <p v-if="notice" class="notice">{{ notice }}</p>
    <LoadingState v-if="loading" /><ApiErrorNotice
      v-else-if="error"
      :message="settingsErrorMessage"
      :code="error.code"
      :request-id="error.requestId"
      retryable
      @retry="loadAll"
    /><template v-if="!loading">
      <section v-if="tab === 'store' && store" class="panel">
        <div class="panel-title">
          <div>
            <h2>매장 정보</h2>
            <p>결제 통화 {{ store.currency }}</p>
          </div>
          <StatusBadge
            :label="store.status === 'ACTIVE' ? '운영 중' : '이용 중지'"
            :tone="store.status === 'ACTIVE' ? 'success' : 'neutral'"
          />
        </div>
        <form class="form" @submit.prevent="saveStore">
          <label>매장명<input v-model.trim="storeForm.name" required /></label
          ><label
            >시간대<input v-model.trim="storeForm.timezone" placeholder="Asia/Seoul" required
          /></label>
          <div class="actions">
            <button :disabled="busy">정보 저장</button
            ><button type="button" class="secondary" :disabled="busy" @click="toggleStore">
              {{ store.status === 'ACTIVE' ? '매장 이용 중지' : '매장 이용 재개' }}
            </button>
          </div>
        </form>
      </section>
      <template v-if="tab === 'employees'"
        ><section class="panel">
          <h2>직원 등록</h2>
          <p class="help">
            관리 작업 직전에 현재 비밀번호로 재인증합니다. 비밀번호는 저장하지 않습니다.
          </p>
          <form class="form grid" @submit.prevent="addEmployee">
            <label class="credential-field"
              >로그인 아이디<input
                v-model.trim="employeeForm.loginId"
                name="employeeLoginId"
                autocomplete="username"
                required
                minlength="4"
                maxlength="50"
                pattern="[a-z0-9](?:[a-z0-9._-]{2,48}[a-z0-9])"
                aria-describedby="employee-login-hint"
                :aria-invalid="!!employeeLoginIdError"
              /><small id="employee-login-hint" aria-live="polite" :class="{ invalid: employeeLoginIdError }">{{
                employeeLoginIdError ||
                '4~50자 영문 소문자·숫자·점·밑줄·하이픈, 시작과 끝은 영문 또는 숫자'
              }}</small></label
            ><label class="credential-field"
              >임시 비밀번호<input
                v-model="employeeForm.temporaryPassword"
                name="employeeTemporaryPassword"
                type="password"
                autocomplete="new-password"
                minlength="15"
                maxlength="128"
                required
                aria-describedby="employee-password-hint"
                :aria-invalid="!!employeePasswordError"
              /><small id="employee-password-hint" aria-live="polite" :class="{ invalid: employeePasswordError }">{{
                employeePasswordError || '15~128자, 로그인 ID 및 doro, storeaccess, doroerp는 포함할 수 없습니다.'
              }}</small></label
            ><label
              >역할<select v-model="employeeForm.role">
                <option v-if="session.role === 'OWNER'" value="OWNER">점주</option>
                <option v-if="session.role === 'OWNER'" value="MANAGER">매니저</option>
                <option value="STAFF">직원</option>
              </select></label
            >
            <button :disabled="busy || !!employeeLoginIdError || !!employeePasswordError">
              직원 등록
            </button>
          </form>
        </section>
        <section class="panel">
          <h2>직원 목록</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>로그인 아이디</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>비밀번호 변경</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in employees" :key="e.id">
                  <td>{{ e.loginId }}<small v-if="e.id === session.employeeId">내 계정</small></td>
                  <td>{{ displayLabel(e.role) }}</td>
                  <td>{{ displayLabel(e.status) }}</td>
                  <td>{{ e.passwordChangeRequired ? '변경 필요' : '변경 완료' }}</td>
                  <td>
                    <template v-if="canManage(e)"
                      ><select
                        :value="e.role"
                        :disabled="busy || protectedOwner(e)"
                        @change="
                          setRole(
                            e,
                            ($event.target as HTMLSelectElement).value as Role,
                            $event.target as HTMLSelectElement,
                          )
                        "
                      >
                        <option v-if="session.role === 'OWNER'" value="OWNER">점주</option>
                        <option v-if="session.role === 'OWNER'" value="MANAGER">매니저</option>
                        <option value="STAFF">직원</option></select
                      ><button
                        class="secondary"
                        :disabled="busy || protectedOwner(e)"
                        @click="toggleEmployee(e)"
                      >
                        {{ e.status === 'ACTIVE' ? '이용 중지' : '이용 재개' }}</button
                      ><button class="secondary" @click="resetForm.employeeId = e.id">
                        비밀번호 재설정
                      </button></template
                    ><span v-else>관리 불가</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section v-if="resetForm.employeeId" class="panel">
          <h2>임시 비밀번호 재설정</h2>
          <form class="form grid" @submit.prevent="resetPassword">
            <label
              >새 임시 비밀번호<input
                v-model="resetForm.password"
                type="password"
                minlength="15"
                maxlength="128"
                required
            /></label>
            <p v-if="resetPasswordError" class="invalid">{{ resetPasswordError }}</p>
            <button :disabled="busy || !!resetPasswordError">재설정</button>
          </form>
        </section></template
      >
      <template v-if="tab === 'kiosk'"
        ><section class="panel">
          <h2>키오스크 기기 등록</h2>
          <p class="help">이 화면에서는 새로 등록한 기기의 활성화 정보를 확인할 수 있습니다.</p>
          <form class="form grid" @submit.prevent="addKiosk">
            <label>표시 이름<input v-model.trim="kioskDisplayName" data-test="kiosk-display-name" required maxlength="100" /></label>
            <label>기기 코드<input v-model.trim="deviceCode" data-test="kiosk-device-code" required /></label
            ><button :disabled="busy">기기 등록</button>
          </form>
        </section>
        <section v-if="issued" class="panel credential">
          <h2>기기 활성화 정보</h2>
          <p>이 창을 닫으면 다시 확인할 수 없습니다. 사용할 키오스크에 바로 입력해 주세요.</p>
          <template v-if="issuedSecret">
            <div class="credential-value">
              <small>기기 코드</small
              ><code data-test="issued-device-code">{{ issuedDeviceCode }}</code>
              <button
                type="button"
                class="secondary"
                aria-label="기기 코드 복사"
                data-test="copy-device-code"
                @click="copyIssuedValue(issuedDeviceCode, '기기 코드')"
              >
                기기 코드 복사
              </button>
            </div>
            <div class="credential-value">
              <small>활성화 코드</small><code data-test="issued-secret">{{ issuedSecret }}</code>
              <button
                type="button"
                class="secondary"
                aria-label="활성화 코드 복사"
                data-test="copy-activation-secret"
                @click="copyIssuedValue(issuedSecret, '활성화 코드')"
              >
                활성화 코드 복사
              </button>
            </div>
            <p v-if="copyFeedback" class="copy-feedback" role="status" aria-live="polite">
              {{ copyFeedback }}
            </p>
          </template>
          <p v-else class="invalid" role="alert">
            활성화 정보를 안전하게 표시할 수 없습니다. 새로 발급해 주세요.
          </p>
          <small>기기 번호 {{ issued.kioskDeviceId }}</small>
          <div class="actions">
            <button @click="clearIssued">확인 후 닫기</button
            ><button class="secondary" :disabled="busy" @click="rotate()">새로 발급</button
            ><button class="danger" :disabled="busy" @click="revoke()">이용 중지</button>
          </div>
        </section>
        <section v-else class="panel">
          <p class="help">현재 확인할 수 있는 기기 활성화 정보가 없습니다.</p>
        </section>
        <section class="panel" data-test="kiosk-device-list">
          <div class="panel-title">
            <div>
              <h2>등록된 키오스크 기기</h2>
              <p>활성화 코드는 보안을 위해 목록에 표시하지 않습니다.</p>
            </div>
            <button
              type="button"
              class="secondary refresh-button"
              :disabled="busy || kioskLoading"
              @click="loadKiosks"
            >
              새로고침
            </button>
          </div>
          <LoadingState v-if="kioskLoading" />
          <ApiErrorNotice
            v-else-if="kioskError"
            :message="safeApiErrorMessage(kioskError)"
            :code="kioskError.code"
            :request-id="kioskError.requestId"
            retryable
            @retry="loadKiosks"
          />
          <p v-else-if="!kiosks.length" class="help" data-test="kiosk-empty">
            등록된 키오스크 기기가 없습니다.
          </p>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>표시 이름</th>
                  <th>기기 코드</th>
                  <th>기기 ID</th>
                  <th>모드·연결</th>
                  <th>상태</th>
                  <th>인증 버전</th>
                  <th>등록 일시</th>
                  <th>마지막 접속</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="kiosk in kiosks" :key="kiosk.id" data-test="kiosk-device-row">
                  <td><strong>{{ kiosk.displayName }}</strong></td>
                  <td><strong>{{ kiosk.deviceCode }}</strong></td>
                  <td><small>{{ kiosk.id }}</small></td>
                  <td>
                    <div v-if="kioskModeDrafts[kiosk.id]" class="kiosk-mode-editor">
                      <select
                        v-model="kioskModeDrafts[kiosk.id]!.mode"
                        :aria-label="`${kiosk.displayName} 모드`"
                        :disabled="busy || kiosk.status !== 'ACTIVE'"
                      >
                        <option value="ORDER">상품 주문</option>
                        <option value="ENTRY_QUEUE">입장 대기열</option>
                        <option value="PAYMENT">결제</option>
                      </select>
                      <select
                        v-if="kioskModeDrafts[kiosk.id]!.mode === 'ORDER'"
                        v-model="kioskModeDrafts[kiosk.id]!.pairedPaymentDeviceId"
                        :aria-label="`${kiosk.displayName} 결제 Kiosk 연결`"
                        :disabled="busy || kiosk.status !== 'ACTIVE'"
                      >
                        <option value="">결제 Kiosk 선택 필요</option>
                        <option
                          v-for="candidate in kiosks.filter((item) => item.id !== kiosk.id && item.status === 'ACTIVE' && item.mode === 'PAYMENT')"
                          :key="candidate.id"
                          :value="candidate.id"
                        >
                          {{ candidate.displayName }} ({{ candidate.deviceCode }})
                        </option>
                      </select>
                      <span v-else>{{ kioskModeLabel(kioskModeDrafts[kiosk.id]!.mode) }}</span>
                      <button
                        type="button"
                        class="secondary"
                        :disabled="busy || kiosk.status !== 'ACTIVE'"
                        @click="saveKioskMode(kiosk)"
                      >
                        모드 저장
                      </button>
                    </div>
                  </td>
                  <td>
                    <StatusBadge
                      :label="kiosk.status === 'ACTIVE' ? '사용 중' : '해제됨'"
                      :tone="kiosk.status === 'ACTIVE' ? 'success' : 'neutral'"
                    />
                  </td>
                  <td>{{ kiosk.credentialVersion }}</td>
                  <td>
                    <time :datetime="kiosk.createdAt">{{ formatDate(kiosk.createdAt) }}</time>
                  </td>
                  <td>
                    <time v-if="kiosk.lastSeenAt" :datetime="kiosk.lastSeenAt">{{ formatOptionalDate(kiosk.lastSeenAt) }}</time>
                    <span v-else>{{ formatOptionalDate(null) }}</span>
                  </td>
                  <td>
                    <template v-if="kiosk.status === 'ACTIVE'">
                      <button
                        type="button"
                        class="secondary"
                        data-test="rotate-kiosk"
                        :disabled="busy"
                        @click="rotate(kiosk)"
                      >
                        활성화 코드 재발급
                      </button>
                      <button class="danger" :disabled="busy" @click="revoke(kiosk)">
                        이용 중지
                      </button>
                    </template>
                    <span v-else>관리 불가</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section></template
      >
    </template>
    <div v-if="pendingAction" class="modal-backdrop">
      <section
        class="panel reauth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reauth-title"
      >
        <h2 id="reauth-title">현재 비밀번호 확인</h2>
        <p>보호된 관리 작업을 실행하기 직전에 다시 인증합니다.</p>
        <form class="form" @submit.prevent="confirmReauth">
          <label
            >현재 비밀번호<input
              v-model="reauthPassword"
              data-test="reauth-password"
              type="password"
              autocomplete="current-password"
              required
              autofocus
          /></label>
          <div class="actions">
            <button :disabled="busy || !reauthPassword">확인</button
            ><button type="button" class="secondary" :disabled="busy" @click="cancelReauth">
              취소
            </button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>
<style scoped>
.page {
  display: grid;
  gap: 18px;
}
.tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--color-border);
}
.tabs button {
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  padding: 12px 16px;
}
.tabs .active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 750;
}
.panel {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #fff;
  padding: 22px;
}
.panel h2 {
  margin: 0 0 12px;
  font-size: 17px;
}
.panel-title {
  display: flex;
  justify-content: space-between;
}
.refresh-button {
  align-self: flex-start;
  min-height: 32px;
  border-radius: 3px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
}
.panel-title p,
.help {
  color: var(--color-muted);
  font-size: 12px;
}
.form {
  display: grid;
  gap: 14px;
  max-width: 680px;
}
.grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: end;
}
.form label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}
.credential-field {
  align-self: stretch;
  grid-template-rows: auto 40px minmax(3em, auto);
  align-content: start;
}
.form input,
.form select,
td select {
  min-height: 40px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
}
.form button,
.actions button,
td button {
  min-height: 40px;
  border: 0;
  border-radius: 8px;
  background: var(--color-primary);
  padding: 0 14px;
  color: #fff;
  font-weight: 700;
}
.actions {
  display: flex;
  gap: 8px;
}
.secondary {
  border: 1px solid var(--color-border) !important;
  background: #fff !important;
  color: var(--color-text) !important;
}
.danger {
  background: var(--color-danger) !important;
}
.notice {
  margin: 0;
  border-radius: 8px;
  background: #ecfdf5;
  padding: 12px;
  color: #047857;
}
.table-wrap {
  overflow: auto;
}
table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}
th,
td {
  border-bottom: 1px solid var(--color-border);
  padding: 11px;
  text-align: left;
  font-size: 12px;
}
td small {
  display: block;
  color: var(--color-primary);
}
td button,
td select {
  margin: 2px;
}
.credential code {
  display: block;
  overflow-wrap: anywhere;
  margin: 15px 0;
  border-radius: 8px;
  background: #f1f5f9;
  padding: 16px;
}
.credential-value {
  margin-bottom: 15px;
}
.credential-value code {
  margin: 8px 0;
}
.credential-value button {
  min-height: 32px;
  border-radius: 3px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
}
.credential small {
  display: block;
}
.copy-feedback {
  color: var(--color-muted);
  font-size: 12px;
}
button:disabled {
  opacity: 0.5;
}
.invalid {
  color: var(--color-danger);
  font-size: 12px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.55);
  padding: 20px;
}
.reauth-modal {
  width: min(440px, 100%);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}
@media (max-width: 650px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .panel-title {
    gap: 10px;
    flex-direction: column;
  }
}
.page {
  gap: 14px;
}
.tabs {
  gap: 20px;
}
.tabs button {
  padding: 10px 0;
  font-size: 12px;
  font-weight: 650;
}
.tabs .active {
  border-width: 2px;
  color: #007f5b;
}
.panel {
  border-radius: 3px;
  padding: 16px;
}
.panel h2 {
  font-size: 15px;
}
.form input,
.form select,
td select {
  min-height: 34px;
  border-radius: 3px;
}
.credential-field {
  grid-template-rows: auto 34px minmax(3em, auto);
}
.form button,
.actions button,
td button {
  min-height: 32px;
  border-radius: 3px;
  background: #009b6b;
  font-size: 12px;
}
.secondary {
  border-radius: 3px !important;
}
.table-wrap {
  margin: 0 -16px -16px;
}
.notice {
  border-radius: 0;
  border-left: 3px solid #00a878;
  background: #fff;
  padding: 10px 12px;
}
</style>
