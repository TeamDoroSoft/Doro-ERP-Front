<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  changeEmployeeRole,
  changeEmployeeStatus,
  changeStoreStatus,
  createEmployee,
  getEmployees,
  getStore,
  reauthenticate,
  registerKiosk,
  resetEmployeePassword,
  revokeKiosk,
  rotateKiosk,
  updateStore,
  type EmployeeView,
  type KioskCredentialView,
  type Role,
  type StoreView,
} from '@/api/administration'
import { ApiError } from '@/api/http'
import ApiErrorNotice from '@/components/ui/ApiErrorNotice.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'
const session = useOperatorSessionStore(),
  tab = ref<'store' | 'employees' | 'kiosk'>('store'),
  store = ref<StoreView | null>(null),
  employees = ref<EmployeeView[]>([]),
  loading = ref(false),
  busy = ref(false),
  error = ref<ApiError | null>(null),
  notice = ref(''),
  reauthPassword = ref(''),
  deviceCode = ref(''),
  issued = ref<KioskCredentialView | null>(null)
const storeForm = reactive({ name: '', timezone: '' }),
  employeeForm = reactive({ loginId: '', temporaryPassword: '', role: 'STAFF' as Role }),
  resetForm = reactive({ employeeId: '', password: '' }),
  createKey = ref(crypto.randomUUID()),
  resetKey = ref(crypto.randomUUID())
const activeOwnerCount = computed(
  () => employees.value.filter((e) => e.role === 'OWNER' && e.status === 'ACTIVE').length,
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
async function run(action: () => Promise<unknown>, message: string, needsReauth = false) {
  busy.value = true
  error.value = null
  notice.value = ''
  try {
    if (needsReauth) {
      if (!reauthPassword.value)
        throw new ApiError(400, {
          code: 'REAUTH_PASSWORD_REQUIRED',
          detail: '현재 비밀번호를 입력해 주세요.',
        })
      await reauthenticate(reauthPassword.value)
    }
    await action()
    notice.value = message
    await loadAll()
  } catch (e) {
    error.value = asError(e)
  } finally {
    reauthPassword.value = ''
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
  const key = createKey.value
  return run(
    async () => {
      await createEmployee({ ...employeeForm }, key)
      employeeForm.loginId = ''
      employeeForm.temporaryPassword = ''
      employeeForm.role = 'STAFF'
      createKey.value = crypto.randomUUID()
    },
    '직원이 등록되었습니다.',
    true,
  )
}
function canManage(e: EmployeeView) {
  if (e.id === session.employeeId) return false
  if (session.role === 'MANAGER') return e.role === 'STAFF'
  return true
}
function protectedOwner(e: EmployeeView) {
  return e.role === 'OWNER' && e.status === 'ACTIVE' && activeOwnerCount.value === 1
}
function setRole(e: EmployeeView, role: Role) {
  return run(() => changeEmployeeRole(e.id, role), '직원 권한이 변경되었습니다.', true)
}
function toggleEmployee(e: EmployeeView) {
  return run(
    () => changeEmployeeStatus(e.id, e.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    '직원 상태가 변경되었습니다.',
    true,
  )
}
function resetPassword() {
  const key = resetKey.value,
    id = resetForm.employeeId,
    password = resetForm.password
  return run(
    async () => {
      await resetEmployeePassword(id, password, key)
      resetForm.employeeId = ''
      resetForm.password = ''
      resetKey.value = crypto.randomUUID()
    },
    '임시 비밀번호가 설정되었습니다.',
    true,
  )
}
function addKiosk() {
  return run(
    async () => {
      issued.value = await registerKiosk(deviceCode.value)
      deviceCode.value = ''
    },
    '키오스크 장치가 등록되었습니다.',
    true,
  )
}
function rotate() {
  if (!issued.value) return
  return run(
    async () => {
      issued.value = await rotateKiosk(issued.value!.kioskDeviceId)
    },
    '자격 증명이 교체되었습니다.',
    true,
  )
}
function revoke() {
  if (!issued.value) return
  return run(
    async () => {
      await revokeKiosk(issued.value!.kioskDeviceId)
      issued.value = null
    },
    '키오스크 장치가 폐기되었습니다.',
    true,
  )
}
function asError(e: unknown) {
  return e instanceof ApiError
    ? e
    : new ApiError(0, { code: 'NETWORK_ERROR', detail: '서버에 연결할 수 없습니다.' })
}
</script>
<template>
  <section class="page">
    <PageHeader
      title="매장·직원 설정"
      description="매장 정보, 직원 계정, 키오스크 장치를 관리합니다."
      eyebrow="운영 설정"
    />
    <nav class="tabs">
      <button
        v-for="item in [
          ['store', '매장'],
          ['employees', '직원'],
          ['kiosk', '키오스크 장치'],
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
      :message="error.message"
      :request-id="error.requestId"
      retryable
      @retry="loadAll"
    /><template v-if="!loading">
      <section v-if="tab === 'store' && store" class="panel">
        <div class="panel-title">
          <div>
            <h2>매장 정보</h2>
            <p>ID {{ store.id }} · 통화 {{ store.currency }}</p>
          </div>
          <StatusBadge
            :label="store.status === 'ACTIVE' ? '운영 중' : '비활성'"
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
              {{ store.status === 'ACTIVE' ? '매장 비활성화' : '매장 활성화' }}
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
            <label>로그인 ID<input v-model.trim="employeeForm.loginId" required /></label
            ><label
              >임시 비밀번호<input
                v-model="employeeForm.temporaryPassword"
                type="password"
                required /></label
            ><label
              >역할<select v-model="employeeForm.role">
                <option v-if="session.role === 'OWNER'" value="OWNER">OWNER</option>
                <option v-if="session.role === 'OWNER'" value="MANAGER">MANAGER</option>
                <option value="STAFF">STAFF</option>
              </select></label
            ><label
              >현재 비밀번호<input
                v-model="reauthPassword"
                type="password"
                autocomplete="current-password"
                required /></label
            ><button :disabled="busy">직원 등록</button>
          </form>
        </section>
        <section class="panel">
          <h2>직원 목록</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>로그인 ID</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>비밀번호 변경</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in employees" :key="e.id">
                  <td>{{ e.loginId }}<small v-if="e.id === session.employeeId">내 계정</small></td>
                  <td>{{ e.role }}</td>
                  <td>{{ e.status }}</td>
                  <td>{{ e.passwordChangeRequired ? '필요' : '완료' }}</td>
                  <td>
                    <template v-if="canManage(e)"
                      ><select
                        :value="e.role"
                        :disabled="busy || protectedOwner(e)"
                        @change="setRole(e, ($event.target as HTMLSelectElement).value as Role)"
                      >
                        <option v-if="session.role === 'OWNER'" value="OWNER">OWNER</option>
                        <option v-if="session.role === 'OWNER'" value="MANAGER">MANAGER</option>
                        <option value="STAFF">STAFF</option></select
                      ><button
                        class="secondary"
                        :disabled="busy || protectedOwner(e)"
                        @click="toggleEmployee(e)"
                      >
                        {{ e.status === 'ACTIVE' ? '비활성화' : '활성화' }}</button
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
                required /></label
            ><label>현재 비밀번호<input v-model="reauthPassword" type="password" required /></label
            ><button :disabled="busy">재설정</button>
          </form>
        </section></template
      >
      <template v-if="tab === 'kiosk'"
        ><section class="panel">
          <h2>키오스크 장치 등록</h2>
          <p class="help">
            서버는 장치 목록을 제공하지 않습니다. 이 화면에서는 지금 발급한 장치만 관리할 수
            있습니다.
          </p>
          <form class="form grid" @submit.prevent="addKiosk">
            <label>장치 코드<input v-model.trim="deviceCode" required /></label
            ><label>현재 비밀번호<input v-model="reauthPassword" type="password" required /></label
            ><button :disabled="busy">장치 등록</button>
          </form>
        </section>
        <section v-if="issued" class="panel credential">
          <h2>일회성 자격 증명</h2>
          <p>이 창을 닫으면 다시 확인할 수 없습니다. 안전한 위치에 즉시 전달하세요.</p>
          <code>{{ issued.credential }}</code
          ><small>장치 ID {{ issued.kioskDeviceId }}</small>
          <div class="actions">
            <button @click="issued = null">확인 후 닫기</button
            ><button class="secondary" :disabled="busy" @click="rotate">교체</button
            ><button class="danger" :disabled="busy" @click="revoke">폐기</button>
          </div>
        </section>
        <section v-else class="panel">
          <p class="help">현재 화면에서 관리 중인 발급 장치가 없습니다.</p>
        </section></template
      >
    </template>
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
.credential small {
  display: block;
  margin-bottom: 15px;
}
button:disabled {
  opacity: 0.5;
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
</style>
