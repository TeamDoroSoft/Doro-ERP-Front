<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ApiError,
  blockerMessages,
  closeTableSession,
  createIdempotencyKey,
  createTable,
  fieldErrorMap,
  getCurrentOrders,
  getPastSessionOrders,
  getPastSessions,
  getTables,
  issueQrCredential,
  problemMessage,
  reissueQrCredential,
  startTableSession,
  updateTable,
  updateTableActivation,
  type QrCredentialResponse,
  type RoleCode,
  type SessionSummary,
  type TableFormPayload,
  type TableOrderPageResponse,
  type TableResponse,
} from '@/api/table'
import OrderTable from '@/components/table/OrderTable.vue'
import QrPrintPanel from '@/components/table/QrPrintPanel.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'

type FormMode = 'create' | 'edit'

const operator = useOperatorSessionStore()

const roleOptions: RoleCode[] = ['OWNER', 'MANAGER', 'ADMIN', 'STAFF', 'CUSTOMER']
const orderStatusOptions = ['', 'COMPLETED', 'IN_PROGRESS', 'CANCELLED']

const tables = ref<TableResponse[]>([])
const selectedTableId = ref('')
const directTableId = ref('')
const loadingTables = ref(false)
const tableError = ref('')
const notice = ref('')

const formOpen = ref(false)
const formMode = ref<FormMode>('create')
const savingForm = ref(false)
const formErrors = ref<Record<string, string>>({})
const form = reactive<TableFormPayload>({
  tableNumber: '',
  displayName: '',
  seatCapacity: 4,
  active: true,
})

const qrBusy = ref(false)
const qrMessage = ref('')
const qrResult = ref<QrCredentialResponse | null>(null)

const currentOrders = ref<TableOrderPageResponse>({
  session: null,
  items: [],
  nextCursor: null,
})
const currentStatus = ref('')
const currentSize = ref(10)
const currentLoading = ref(false)
const currentError = ref('')

const sessionBusy = ref(false)
const closeConfirmOpen = ref(false)
const closeBlockers = ref<string[]>([])

const pastSessions = ref<SessionSummary[]>([])
const selectedPastSessionId = ref('')
const pastNextCursor = ref<string | null>(null)
const pastLoading = ref(false)
const pastError = ref('')
const pastFrom = ref('')
const pastTo = ref('')
const pastSize = ref(10)
const pastOrderStatus = ref('')
const pastOrders = ref<TableOrderPageResponse>({
  session: null,
  items: [],
  nextCursor: null,
})

const selectedTable = computed(
  () => tables.value.find((table) => table.tableId === selectedTableId.value) ?? null,
)
const activeTableId = computed(() => selectedTable.value?.tableId ?? directTableId.value.trim())
const currentSession = computed(() => currentOrders.value.session)
const selectedPastSession = computed(
  () => pastSessions.value.find((session) => session.sessionId === selectedPastSessionId.value) ?? null,
)

const canManageTables = computed(() => operator.isTableManager)
const canManageSession = computed(() => operator.canManageSession)
const canReadOrders = computed(() => operator.canReadOrders)

onMounted(() => {
  void loadTables()
})

async function loadTables() {
  loadingTables.value = true
  tableError.value = ''
  try {
    tables.value = await getTables(operator.auth)
    if (!selectedTableId.value && tables.value[0]) {
      selectedTableId.value = tables.value[0].tableId
      await refreshSelectedContext()
    }
  } catch (error) {
    tableError.value = problemMessage(error)
  } finally {
    loadingTables.value = false
  }
}

async function refreshSelectedContext() {
  qrMessage.value = ''
  qrResult.value = null
  closeBlockers.value = []
  if (activeTableId.value && canReadOrders.value) {
    await Promise.all([loadCurrentOrders(false), loadPastSessions(false)])
  }
}

function selectTable(tableId: string) {
  selectedTableId.value = tableId
  directTableId.value = ''
  selectedPastSessionId.value = ''
  void refreshSelectedContext()
}

function openCreateForm() {
  formMode.value = 'create'
  Object.assign(form, {
    tableNumber: '',
    displayName: '',
    seatCapacity: 4,
    active: true,
  })
  formErrors.value = {}
  formOpen.value = true
}

function openEditForm(table: TableResponse) {
  formMode.value = 'edit'
  selectedTableId.value = table.tableId
  Object.assign(form, {
    tableNumber: table.tableNumber,
    displayName: table.displayName,
    seatCapacity: table.seatCapacity,
    active: table.active,
  })
  formErrors.value = {}
  formOpen.value = true
}

function closeForm() {
  if (!savingForm.value) {
    formOpen.value = false
  }
}

async function submitForm() {
  formErrors.value = validateForm()
  if (Object.keys(formErrors.value).length > 0) {
    return
  }
  savingForm.value = true
  notice.value = ''
  try {
    const payload = {
      tableNumber: form.tableNumber.trim(),
      displayName: form.displayName.trim(),
      seatCapacity: Number(form.seatCapacity),
      active: form.active,
    }
    const response =
      formMode.value === 'create'
        ? await createTable(operator.auth, payload, createIdempotencyKey('table-create'))
        : await updateSelectedTable(payload)
    upsertTable(response)
    selectedTableId.value = response.tableId
    notice.value =
      formMode.value === 'create' ? '테이블을 등록했습니다.' : '테이블 정보를 변경했습니다.'
    formOpen.value = false
    await refreshSelectedContext()
  } catch (error) {
    formErrors.value = fieldErrorMap(error)
    if (error instanceof ApiError && error.code === 'PRECONDITION_FAILED') {
      formErrors.value._global = '최신 정보가 변경됐습니다. 새로고침 후 다시 저장하세요.'
    } else if (Object.keys(formErrors.value).length === 0) {
      formErrors.value._global = problemMessage(error)
    }
  } finally {
    savingForm.value = false
  }
}

async function updateSelectedTable(payload: TableFormPayload) {
  if (!selectedTable.value) {
    throw new Error('selected table is required')
  }
  return updateTable(
    operator.auth,
    selectedTable.value.tableId,
    payload,
    selectedTable.value.version,
    createIdempotencyKey('table-update'),
  )
}

async function changeActivation(table: TableResponse, active: boolean) {
  notice.value = ''
  tableError.value = ''
  try {
    const response = await updateTableActivation(
      operator.auth,
      table,
      active,
      createIdempotencyKey(active ? 'table-activate' : 'table-deactivate'),
    )
    upsertTable(response)
    notice.value = active ? '테이블을 활성화했습니다.' : '테이블을 비활성화했습니다.'
  } catch (error) {
    tableError.value = problemMessage(error)
  }
}

async function refreshAfterConflict() {
  await loadTables()
  if (selectedTableId.value) {
    const latest = tables.value.find((table) => table.tableId === selectedTableId.value)
    if (latest) {
      openEditForm(latest)
    }
  }
}

async function issueQr(kind: 'issue' | 'reissue') {
  if (!activeTableId.value || !selectedTable.value) {
    qrMessage.value = '테이블을 선택하세요.'
    return
  }
  if (kind === 'reissue') {
    const confirmed = window.confirm('재발급하면 기존 QR은 더 이상 사용할 수 없습니다.')
    if (!confirmed) {
      return
    }
  }
  qrBusy.value = true
  qrMessage.value = ''
  qrResult.value = null
  try {
    const key = createIdempotencyKey(kind === 'issue' ? 'qr-issue' : 'qr-reissue')
    const response =
      kind === 'issue'
        ? await issueQrCredential(operator.auth, activeTableId.value, key)
        : await reissueQrCredential(operator.auth, activeTableId.value, key)
    qrResult.value = response.accessUrl ? response : null
    qrMessage.value = response.accessUrl
      ? 'QR을 발급했습니다. 인쇄 후 화면에서 URL을 제거합니다.'
      : '이미 처리된 요청입니다. 보안상 QR URL은 다시 표시되지 않습니다.'
  } catch (error) {
    qrMessage.value = problemMessage(error)
  } finally {
    qrBusy.value = false
  }
}

function clearQrSecret() {
  qrResult.value = null
  qrMessage.value = 'QR URL을 화면 메모리에서 제거했습니다.'
}

async function startSession() {
  if (!activeTableId.value) {
    currentError.value = '테이블을 선택하거나 테이블 ID를 입력하세요.'
    return
  }
  sessionBusy.value = true
  currentError.value = ''
  try {
    await startTableSession(operator.auth, activeTableId.value, createIdempotencyKey('session-start'))
    notice.value = '세션을 시작했습니다.'
    await loadCurrentOrders(false)
    await loadTables()
  } catch (error) {
    currentError.value = problemMessage(error)
    if (error instanceof ApiError && error.code === 'TABLE_SESSION_ALREADY_OPEN') {
      await loadCurrentOrders(false)
    }
  } finally {
    sessionBusy.value = false
  }
}

function openCloseConfirm() {
  closeBlockers.value = []
  closeConfirmOpen.value = true
}

async function confirmCloseSession() {
  if (!activeTableId.value || !currentSession.value) {
    return
  }
  sessionBusy.value = true
  currentError.value = ''
  closeBlockers.value = []
  try {
    await closeTableSession(
      operator.auth,
      activeTableId.value,
      currentSession.value.sessionId,
      createIdempotencyKey('session-close'),
    )
    closeConfirmOpen.value = false
    notice.value = '세션을 종료했습니다.'
    await loadCurrentOrders(false)
    await loadPastSessions(false)
    await loadTables()
  } catch (error) {
    closeBlockers.value = blockerMessages(error)
    currentError.value = problemMessage(error)
  } finally {
    sessionBusy.value = false
  }
}

async function loadCurrentOrders(append: boolean) {
  if (!activeTableId.value || !canReadOrders.value) {
    return
  }
  currentLoading.value = true
  currentError.value = ''
  try {
    const response = await getCurrentOrders(operator.auth, activeTableId.value, {
      status: currentStatus.value || undefined,
      cursor: append ? (currentOrders.value.nextCursor ?? undefined) : undefined,
      size: currentSize.value,
    })
    currentOrders.value = append
      ? {
          session: response.session,
          items: [...currentOrders.value.items, ...response.items],
          nextCursor: response.nextCursor,
        }
      : response
  } catch (error) {
    currentError.value = problemMessage(error)
  } finally {
    currentLoading.value = false
  }
}

async function loadPastSessions(append: boolean) {
  if (!activeTableId.value || !canReadOrders.value) {
    return
  }
  pastLoading.value = true
  pastError.value = ''
  try {
    const response = await getPastSessions(operator.auth, activeTableId.value, {
      from: toInstant(pastFrom.value),
      to: toInstant(pastTo.value),
      cursor: append ? (pastNextCursor.value ?? undefined) : undefined,
      size: pastSize.value,
    })
    pastSessions.value = append ? [...pastSessions.value, ...response.items] : response.items
    pastNextCursor.value = response.nextCursor
    if (!append) {
      selectedPastSessionId.value = ''
      pastOrders.value = { session: null, items: [], nextCursor: null }
    }
  } catch (error) {
    pastError.value = problemMessage(error)
  } finally {
    pastLoading.value = false
  }
}

async function loadPastOrders(append: boolean) {
  if (!activeTableId.value || !selectedPastSessionId.value || !canReadOrders.value) {
    return
  }
  pastLoading.value = true
  pastError.value = ''
  try {
    const response = await getPastSessionOrders(
      operator.auth,
      activeTableId.value,
      selectedPastSessionId.value,
      {
        status: pastOrderStatus.value || undefined,
        cursor: append ? (pastOrders.value.nextCursor ?? undefined) : undefined,
        size: pastSize.value,
      },
    )
    pastOrders.value = append
      ? {
          session: response.session,
          items: [...pastOrders.value.items, ...response.items],
          nextCursor: response.nextCursor,
        }
      : response
  } catch (error) {
    pastError.value = problemMessage(error)
  } finally {
    pastLoading.value = false
  }
}

function validateForm(): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.tableNumber.trim()) {
    errors.tableNumber = '테이블 번호를 입력하세요.'
  }
  if (!form.displayName.trim()) {
    errors.displayName = '표시 이름을 입력하세요.'
  }
  const seats = Number(form.seatCapacity)
  if (!Number.isInteger(seats) || seats < 1 || seats > 999) {
    errors.seatCapacity = '좌석 수는 1명 이상 999명 이하로 입력하세요.'
  }
  return errors
}

function upsertTable(table: TableResponse) {
  const index = tables.value.findIndex((item) => item.tableId === table.tableId)
  if (index >= 0) {
    tables.value.splice(index, 1, table)
  } else {
    tables.value = [...tables.value, table].sort((a, b) =>
      a.tableNumber.localeCompare(b.tableNumber),
    )
  }
}

function toInstant(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-'
  }
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

</script>

<template>
  <main class="operation-shell">
    <section class="operation-toolbar" aria-labelledby="operation-title">
      <div>
        <p class="eyebrow">TABLE-09</p>
        <h1 id="operation-title">테이블 운영</h1>
      </div>
      <form class="connection-form" @submit.prevent="loadTables">
        <label>
          API
          <input
            v-model="operator.apiBaseUrl"
            type="url"
            inputmode="url"
            placeholder="http://localhost:8080"
          />
        </label>
        <label>
          권한
          <select v-model="operator.roleCode">
            <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
          </select>
        </label>
        <label>
          ID
          <input v-model="operator.loginId" autocomplete="username" />
        </label>
        <label>
          비밀번호
          <input v-model="operator.password" type="password" autocomplete="current-password" />
        </label>
        <button type="submit" class="button">새로고침</button>
        <button type="button" class="button button--ghost" @click="operator.clearPassword">
          비밀번호 제거
        </button>
      </form>
    </section>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="tableError" class="error-banner" role="alert">{{ tableError }}</p>

    <section class="table-workspace">
      <aside class="table-list" aria-labelledby="table-list-title">
        <div class="section-head">
          <div>
            <p class="eyebrow">Tables</p>
            <h2 id="table-list-title">목록</h2>
          </div>
          <button
            v-if="canManageTables"
            type="button"
            class="button button--primary"
            @click="openCreateForm"
          >
            등록
          </button>
        </div>

        <div v-if="loadingTables" class="empty-state">불러오는 중</div>
        <div v-else-if="tables.length === 0" class="empty-state">등록된 테이블이 없습니다.</div>
        <div v-else class="table-grid">
          <article
            v-for="table in tables"
            :key="table.tableId"
            class="table-card"
            :class="{ 'table-card--selected': table.tableId === selectedTableId }"
          >
            <button type="button" class="table-card__main" @click="selectTable(table.tableId)">
              <strong>{{ table.tableNumber }}</strong>
              <span>{{ table.displayName }}</span>
              <span>{{ table.seatCapacity }}석</span>
              <span>{{ table.active ? '활성' : '비활성' }} · {{ table.usageStatus }}</span>
              <span>v{{ table.version }}</span>
            </button>
            <div class="table-card__actions">
              <button
                type="button"
                class="button button--small"
                :disabled="!canManageTables"
                @click="openEditForm(table)"
              >
                수정
              </button>
              <button
                type="button"
                class="button button--small"
                :disabled="!canManageTables"
                @click="changeActivation(table, !table.active)"
              >
                {{ table.active ? '비활성화' : '활성화' }}
              </button>
            </div>
          </article>
        </div>

        <label class="direct-table">
          테이블 ID
          <input
            v-model="directTableId"
            placeholder="목록 권한이 없을 때 사용"
            @change="refreshSelectedContext"
          />
        </label>
      </aside>

      <section class="detail-pane" aria-labelledby="detail-title">
        <div class="section-head">
          <div>
            <p class="eyebrow">Selected</p>
            <h2 id="detail-title">
              {{ selectedTable?.displayName ?? (activeTableId || '테이블 선택') }}
            </h2>
          </div>
          <button type="button" class="button" @click="refreshSelectedContext">상세 새로고침</button>
        </div>

        <div class="detail-grid">
          <section class="panel" aria-labelledby="qr-title">
            <div class="section-head">
              <div>
                <p class="eyebrow">QR</p>
                <h3 id="qr-title">발급·인쇄</h3>
              </div>
            </div>
            <p class="muted">재발급하면 이전 QR은 더 이상 사용할 수 없습니다.</p>
            <div class="button-row">
              <button
                type="button"
                class="button"
                :disabled="!canManageTables || qrBusy || !selectedTable"
                @click="issueQr('issue')"
              >
                최초 발급
              </button>
              <button
                type="button"
                class="button button--danger"
                :disabled="!canManageTables || qrBusy || !selectedTable"
                @click="issueQr('reissue')"
              >
                재발급
              </button>
            </div>
            <p v-if="qrMessage" class="inline-message" role="status">{{ qrMessage }}</p>
            <QrPrintPanel
              v-if="qrResult?.accessUrl && selectedTable"
              :access-url="qrResult.accessUrl"
              :table-number="selectedTable.tableNumber"
              @printed="clearQrSecret"
            />
          </section>

          <section class="panel" aria-labelledby="session-title">
            <div class="section-head">
              <div>
                <p class="eyebrow">Session</p>
                <h3 id="session-title">시작·종료</h3>
              </div>
            </div>
            <dl class="facts">
              <div>
                <dt>현재 Session</dt>
                <dd>{{ currentSession?.sessionId ?? '-' }}</dd>
              </div>
              <div>
                <dt>시작 시각</dt>
                <dd>{{ formatDate(currentSession?.openedAt) }}</dd>
              </div>
            </dl>
            <div class="button-row">
              <button
                type="button"
                class="button button--primary"
                :disabled="
                  !canManageSession ||
                  sessionBusy ||
                  !activeTableId ||
                  Boolean(currentSession) ||
                  selectedTable?.active === false
                "
                @click="startSession"
              >
                시작
              </button>
              <button
                type="button"
                class="button button--danger"
                :disabled="!canManageSession || sessionBusy || !currentSession"
                @click="openCloseConfirm"
              >
                종료
              </button>
            </div>
            <p v-if="currentError" class="inline-error" role="alert">{{ currentError }}</p>
            <ul v-if="closeBlockers.length" class="blocker-list" aria-label="종료 차단 사유">
              <li v-for="blocker in closeBlockers" :key="blocker">{{ blocker }}</li>
            </ul>
          </section>
        </div>

        <section class="orders-section" aria-labelledby="current-orders-title">
          <div class="section-head">
            <div>
              <p class="eyebrow">Current</p>
              <h3 id="current-orders-title">현재 주문</h3>
            </div>
            <div class="filters">
              <label>
                상태
                <select v-model="currentStatus" @change="loadCurrentOrders(false)">
                  <option v-for="status in orderStatusOptions" :key="status" :value="status">
                    {{ status || '전체' }}
                  </option>
                </select>
              </label>
              <label>
                크기
                <input v-model.number="currentSize" type="number" min="1" max="100" />
              </label>
              <button type="button" class="button" :disabled="!canReadOrders" @click="loadCurrentOrders(false)">
                조회
              </button>
            </div>
          </div>
          <OrderTable :orders="currentOrders.items" />
          <button
            v-if="currentOrders.nextCursor"
            type="button"
            class="button"
            :disabled="currentLoading"
            @click="loadCurrentOrders(true)"
          >
            다음 페이지
          </button>
        </section>

        <section class="orders-section" aria-labelledby="history-title">
          <div class="section-head">
            <div>
              <p class="eyebrow">History</p>
              <h3 id="history-title">과거 Session·주문</h3>
            </div>
            <div class="filters">
              <label>
                시작
                <input v-model="pastFrom" type="datetime-local" />
              </label>
              <label>
                종료
                <input v-model="pastTo" type="datetime-local" />
              </label>
              <label>
                상태
                <select v-model="pastOrderStatus">
                  <option v-for="status in orderStatusOptions" :key="status" :value="status">
                    {{ status || '전체' }}
                  </option>
                </select>
              </label>
              <button type="button" class="button" :disabled="!canReadOrders" @click="loadPastSessions(false)">
                조회
              </button>
            </div>
          </div>
          <p v-if="pastError" class="inline-error" role="alert">{{ pastError }}</p>
          <div class="history-list">
            <button
              v-for="session in pastSessions"
              :key="session.sessionId"
              type="button"
              class="history-item"
              :class="{ 'history-item--selected': session.sessionId === selectedPastSessionId }"
              @click="
                selectedPastSessionId = session.sessionId;
                loadPastOrders(false)
              "
            >
              <span>{{ formatDate(session.openedAt) }}</span>
              <span>{{ formatDate(session.closedAt) }}</span>
              <span>{{ session.status }}</span>
            </button>
          </div>
          <button
            v-if="pastNextCursor"
            type="button"
            class="button"
            :disabled="pastLoading"
            @click="loadPastSessions(true)"
          >
            Session 다음 페이지
          </button>
          <p v-if="selectedPastSession" class="muted">
            선택한 Session {{ selectedPastSession.sessionId }}
          </p>
          <OrderTable :orders="pastOrders.items" />
          <button
            v-if="pastOrders.nextCursor"
            type="button"
            class="button"
            :disabled="pastLoading"
            @click="loadPastOrders(true)"
          >
            주문 다음 페이지
          </button>
        </section>
      </section>
    </section>

    <div v-if="formOpen" class="modal-backdrop" role="presentation">
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="formMode === 'create' ? 'create-title' : 'edit-title'"
      >
        <div class="section-head">
          <h2 :id="formMode === 'create' ? 'create-title' : 'edit-title'">
            {{ formMode === 'create' ? '테이블 등록' : '테이블 수정' }}
          </h2>
          <button type="button" class="button button--ghost" @click="closeForm">취소</button>
        </div>
        <form class="table-form" @submit.prevent="submitForm">
          <p v-if="formErrors._global" class="inline-error" role="alert">
            {{ formErrors._global }}
          </p>
          <label for="table-number">테이블 번호 *</label>
          <input
            id="table-number"
            v-model="form.tableNumber"
            maxlength="20"
            :aria-invalid="Boolean(formErrors.tableNumber)"
            aria-describedby="table-number-error"
          />
          <p id="table-number-error" class="field-error" role="alert">
            {{ formErrors.tableNumber }}
          </p>

          <label for="display-name">표시 이름 *</label>
          <input
            id="display-name"
            v-model="form.displayName"
            maxlength="60"
            :aria-invalid="Boolean(formErrors.displayName)"
            aria-describedby="display-name-error"
          />
          <p id="display-name-error" class="field-error" role="alert">
            {{ formErrors.displayName }}
          </p>

          <label for="seat-capacity">좌석 수 *</label>
          <input
            id="seat-capacity"
            v-model.number="form.seatCapacity"
            type="number"
            min="1"
            max="999"
            :aria-invalid="Boolean(formErrors.seatCapacity)"
            aria-describedby="seat-capacity-error"
          />
          <p id="seat-capacity-error" class="field-error" role="alert">
            {{ formErrors.seatCapacity }}
          </p>

          <label v-if="formMode === 'create'" class="check-row">
            <input v-model="form.active" type="checkbox" />
            활성 상태로 등록
          </label>

          <div class="button-row">
            <button type="submit" class="button button--primary" :disabled="savingForm">
              저장
            </button>
            <button
              v-if="formErrors._global?.includes('최신 정보')"
              type="button"
              class="button"
              @click="refreshAfterConflict"
            >
              최신 정보 조회
            </button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="closeConfirmOpen" class="modal-backdrop" role="presentation">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="close-title">
        <h2 id="close-title">Session 종료</h2>
        <p>현재 Session을 종료합니다.</p>
        <p v-if="currentError" class="inline-error" role="alert">{{ currentError }}</p>
        <ul v-if="closeBlockers.length" class="blocker-list">
          <li v-for="blocker in closeBlockers" :key="blocker">{{ blocker }}</li>
        </ul>
        <div class="button-row">
          <button
            type="button"
            class="button button--danger"
            :disabled="sessionBusy"
            @click="confirmCloseSession"
          >
            종료
          </button>
          <button type="button" class="button" @click="closeConfirmOpen = false">취소</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.operation-shell {
  display: grid;
  gap: 1rem;
  min-height: 100vh;
  padding: 1rem;
  color: var(--color-text);
}

.operation-toolbar,
.table-workspace,
.detail-pane,
.panel,
.orders-section,
.modal {
  background: var(--color-surface);
}

.operation-toolbar {
  display: grid;
  grid-template-columns: minmax(12rem, 0.4fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: end;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 1rem;
}

.operation-toolbar h1,
.section-head h2,
.section-head h3,
.modal h2 {
  margin: 0;
  color: var(--color-heading);
  letter-spacing: 0;
}

.eyebrow {
  margin: 0 0 0.25rem;
  color: var(--color-text-soft);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.connection-form,
.filters,
.button-row,
.table-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: end;
}

label {
  display: grid;
  gap: 0.25rem;
  color: var(--color-heading);
  font-size: 0.88rem;
  font-weight: 650;
}

input,
select {
  min-height: 2.35rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.45rem 0.6rem;
  background: #ffffff;
  color: #172026;
  font: inherit;
}

input[aria-invalid='true'] {
  border-color: #b42318;
}

.button {
  min-height: 2.35rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 6px;
  padding: 0.45rem 0.8rem;
  background: #ffffff;
  color: var(--color-heading);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.button--primary {
  border-color: #126a5a;
  background: #126a5a;
  color: #ffffff;
}

.button--danger {
  border-color: #b42318;
  background: #b42318;
  color: #ffffff;
}

.button--ghost {
  background: transparent;
}

.button--small {
  min-height: 2rem;
  padding: 0.3rem 0.55rem;
  font-size: 0.84rem;
}

.notice,
.error-banner,
.inline-message,
.inline-error,
.field-error {
  margin: 0;
}

.notice {
  border-left: 4px solid #126a5a;
  padding: 0.75rem 1rem;
  background: #e7f6f1;
  color: #0f4d43;
}

.error-banner,
.inline-error,
.field-error {
  color: #b42318;
}

.error-banner {
  border-left: 4px solid #b42318;
  padding: 0.75rem 1rem;
  background: #fff0ed;
}

.inline-message,
.muted {
  color: var(--color-text-soft);
}

.field-error {
  min-height: 1.1rem;
  font-size: 0.82rem;
}

.table-workspace {
  display: grid;
  grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
  gap: 1rem;
}

.table-list,
.detail-pane {
  min-width: 0;
}

.table-list {
  display: grid;
  align-content: start;
  gap: 1rem;
  border-right: 1px solid var(--color-border);
  padding-right: 1rem;
}

.detail-pane {
  display: grid;
  align-content: start;
  gap: 1rem;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.table-grid {
  display: grid;
  gap: 0.75rem;
}

.table-card {
  display: grid;
  gap: 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  background: #ffffff;
}

.table-card--selected {
  border-color: #126a5a;
  box-shadow: 0 0 0 2px rgba(18, 106, 90, 0.14);
}

.table-card__main {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 0.75rem;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.table-card__main strong {
  color: var(--color-heading);
  font-size: 1.1rem;
}

.table-card__main span {
  color: var(--color-text-soft);
  font-size: 0.88rem;
}

.direct-table {
  border-top: 1px solid var(--color-border);
  padding-top: 1rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.panel,
.orders-section {
  display: grid;
  gap: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
}

.facts {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.facts div {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 0.75rem;
}

.facts dt {
  color: var(--color-text-soft);
}

.facts dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-heading);
}

.blocker-list {
  margin: 0;
  padding-left: 1rem;
  color: #b42318;
}

.history-list {
  display: grid;
  gap: 0.5rem;
}

.history-item {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.6rem;
  background: #ffffff;
  color: var(--color-heading);
  text-align: left;
}

.history-item--selected {
  border-color: #126a5a;
  background: #e7f6f1;
}

.empty-state {
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  color: var(--color-text-soft);
  text-align: center;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.48);
}

.modal {
  display: grid;
  width: min(34rem, 100%);
  gap: 1rem;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.24);
}

.table-form {
  display: grid;
  gap: 0.25rem;
}

.check-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.order-table-wrap {
  overflow-x: auto;
}

:deep(.order-table) {
  width: 100%;
  border-collapse: collapse;
}

:deep(.order-table th),
:deep(.order-table td) {
  border-bottom: 1px solid var(--color-border);
  padding: 0.55rem;
  text-align: left;
  vertical-align: top;
}

:deep(.order-table th) {
  color: var(--color-heading);
  font-size: 0.84rem;
}

@media (max-width: 980px) {
  .operation-toolbar,
  .table-workspace,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .table-list {
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
    padding-right: 0;
    padding-bottom: 1rem;
  }
}

@media print {
  .operation-toolbar,
  .table-list,
  .orders-section,
  .panel > :not(.qr-print-panel),
  .modal-backdrop {
    display: none !important;
  }
}
</style>
