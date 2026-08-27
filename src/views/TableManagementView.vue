<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ApiError } from '@/api/http'
import {
  changeTableStatus,
  createTable,
  getInactiveTables,
  getTables,
  updateTable,
  type TableDetailsRequest,
  type TableResponse,
} from '@/api/table'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import TableOperationsPanel from '@/components/tables/TableOperationsPanel.vue'

type FormMode = 'create' | 'edit'

const session = useOperatorSessionStore()
const tables = ref<TableResponse[]>([])
const loading = ref(true)
const listError = ref('')
const inactiveTables = ref<TableResponse[]>([])
const inactiveLoading = ref(false)
const inactiveListError = ref('')
const notice = ref('')
const operationError = ref('')
const formMode = ref<FormMode | null>(null)
const editingId = ref('')
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const form = reactive<TableDetailsRequest>({ tableNumber: '', displayName: '' })

const canManage = computed(() => session.canManageTables)

onMounted(async () => {
  await loadTables()
  if (canManage.value) await loadInactiveTables()
})

async function loadTables() {
  loading.value = true
  listError.value = ''
  try {
    tables.value = await getTables()
  } catch {
    listError.value = '테이블 목록을 불러오지 못했습니다. 다시 시도해 주세요.'
  } finally {
    loading.value = false
  }
}

async function loadInactiveTables() {
  inactiveLoading.value = true
  inactiveListError.value = ''
  try {
    inactiveTables.value = await getInactiveTables()
  } catch {
    inactiveListError.value = '이용 중지한 테이블을 불러오지 못했습니다. 다시 시도해 주세요.'
  } finally {
    inactiveLoading.value = false
  }
}

async function reloadTableLists() {
  await loadTables()
  if (canManage.value) await loadInactiveTables()
}

function openCreateForm() {
  formMode.value = 'create'
  editingId.value = ''
  form.tableNumber = ''
  form.displayName = ''
  resetOperationMessages()
}

function openEditForm(table: TableResponse) {
  formMode.value = 'edit'
  editingId.value = table.id
  form.tableNumber = table.tableNumber
  form.displayName = table.displayName
  resetOperationMessages()
}

function closeForm() {
  if (!saving.value) formMode.value = null
}

function resetOperationMessages() {
  notice.value = ''
  operationError.value = ''
  formErrors.value = {}
}

function validateForm(): boolean {
  const errors: Record<string, string> = {}
  if (!form.tableNumber.trim()) errors.tableNumber = '테이블 번호를 입력해 주세요.'
  if (!form.displayName.trim()) errors.displayName = '표시 이름을 입력해 주세요.'
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submitForm() {
  if (!validateForm()) return

  saving.value = true
  notice.value = ''
  operationError.value = ''
  const payload = {
    tableNumber: form.tableNumber.trim(),
    displayName: form.displayName.trim(),
  }

  try {
    if (formMode.value === 'create') {
      await createTable(payload)
      notice.value = '테이블을 등록했습니다.'
    } else {
      await updateTable(editingId.value, payload)
      notice.value = '테이블 정보를 수정했습니다.'
    }
    formMode.value = null
    await reloadTableLists()
  } catch (error) {
    await handleMutationError(error)
  } finally {
    saving.value = false
  }
}

async function deactivate(table: TableResponse) {
  if (!window.confirm(`${table.displayName} 테이블 이용을 중지할까요?`)) return

  resetOperationMessages()
  try {
    await changeTableStatus(table.id, 'INACTIVE')
    notice.value = '테이블 이용을 중지했습니다.'
    await reloadTableLists()
  } catch (error) {
    await handleMutationError(error)
  }
}

async function reactivate(table: TableResponse) {
  if (!window.confirm(`${table.displayName} 테이블을 다시 이용할까요?`)) return

  resetOperationMessages()
  try {
    await changeTableStatus(table.id, 'ACTIVE')
    notice.value = '테이블을 다시 이용할 수 있습니다.'
    await reloadTableLists()
  } catch (error) {
    await handleMutationError(error)
  }
}

async function handleMutationError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'TABLE_NUMBER_DUPLICATED') {
      formErrors.value = { tableNumber: '이미 사용 중인 테이블 번호입니다.' }
      return
    }
    if (error.code === 'TABLE_MANAGEMENT_FORBIDDEN') {
      operationError.value = '테이블 관리 권한이 없습니다.'
      return
    }
    if (error.code === 'TABLE_CONCURRENT_MODIFICATION') {
      operationError.value = '다른 사용자가 먼저 수정했습니다. 최신 정보를 다시 불러왔습니다.'
      await loadTables()
      return
    }
    if (error.code === 'TABLE_HAS_ACTIVE_ORDER') {
      operationError.value = '진행 중인 주문이 있어 테이블 이용을 중지할 수 없습니다.'
      await loadTables()
      return
    }
    if (error.code === 'TABLE_ORDER_VALIDATION_UNAVAILABLE') {
      operationError.value = '진행 주문을 확인할 수 없어 테이블 상태를 변경하지 않았습니다.'
      await loadTables()
      return
    }
    if (error.code === 'TABLE_NOT_FOUND') {
      operationError.value = '테이블 정보를 찾을 수 없습니다. 최신 목록을 다시 불러왔습니다.'
      formMode.value = null
      await loadTables()
      return
    }

    for (const fieldError of error.fieldErrors) {
      if (fieldError.field === 'tableNumber') {
        formErrors.value.tableNumber = '테이블 번호를 확인해 주세요.'
      }
      if (fieldError.field === 'displayName') {
        formErrors.value.displayName = '표시 이름을 확인해 주세요.'
      }
    }
  }

  if (Object.keys(formErrors.value).length === 0) {
    operationError.value = messageFor(error, '테이블 정보를 저장하지 못했습니다. 다시 시도해 주세요.')
  }
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}
</script>

<template>
  <main class="table-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">매장 운영</p>
        <h1>테이블 관리</h1>
        <p>주문에 사용할 수 있는 테이블을 확인하고 관리합니다.</p>
      </div>
      <button v-if="canManage" class="primary" type="button" @click="openCreateForm">
        테이블 등록
      </button>
    </header>

    <TableOperationsPanel />

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="operationError" class="error-banner" role="alert">{{ operationError }}</p>

    <section v-if="formMode" class="editor" aria-labelledby="editor-title">
      <div class="section-heading list-heading">
        <h2 id="editor-title">{{ formMode === 'create' ? '새 테이블 등록' : '테이블 수정' }}</h2>
        <button class="text-button" type="button" :disabled="saving" @click="closeForm">닫기</button>
      </div>
      <form @submit.prevent="submitForm">
        <label>
          테이블 번호
          <input v-model="form.tableNumber" name="tableNumber" autocomplete="off" />
          <span v-if="formErrors.tableNumber" class="field-error">{{ formErrors.tableNumber }}</span>
        </label>
        <label>
          표시 이름
          <input v-model="form.displayName" name="displayName" autocomplete="off" />
          <span v-if="formErrors.displayName" class="field-error">{{ formErrors.displayName }}</span>
        </label>
        <button class="primary" type="submit" :disabled="saving">
          {{ saving ? '저장 중…' : '저장' }}
        </button>
      </form>
    </section>

    <section class="table-list" aria-labelledby="table-list-title" :aria-busy="loading">
      <div class="section-heading">
        <div>
          <h2 id="table-list-title">이용 중인 테이블</h2>
          <p>주문에 사용할 수 있는 테이블을 확인하고 관리합니다.</p>
        </div>
        <button class="text-button" type="button" :disabled="loading" @click="loadTables">새로고침</button>
      </div>

      <p v-if="loading" class="state-message" role="status">테이블 목록을 불러오는 중입니다…</p>
      <div v-else-if="listError" class="state-message error-state" role="alert">
        <p>{{ listError }}</p>
        <button type="button" @click="loadTables">다시 시도</button>
      </div>
      <p v-else-if="tables.length === 0" class="state-message">이용 중인 테이블이 없습니다.</p>
      <div v-else class="operations-table-wrap"><table class="operations-table"><thead><tr><th>테이블 번호</th><th>표시 이름</th><th>운영 상태</th><th v-if="canManage" aria-label="작업" /></tr></thead><tbody><tr v-for="table in tables" :key="table.id"><td class="table-number">{{ table.tableNumber }}</td><td><strong>{{ table.displayName }}</strong></td><td><span class="table-status">운영 중</span></td><td v-if="canManage" class="row-actions"><button type="button" @click="openEditForm(table)">수정</button><button class="danger" type="button" @click="deactivate(table)">이용 중지</button></td></tr></tbody></table></div>
    </section>

    <section v-if="canManage" class="table-list" aria-labelledby="inactive-table-list-title" :aria-busy="inactiveLoading">
      <div class="section-heading">
        <div>
          <h2 id="inactive-table-list-title">이용 중지한 테이블</h2>
          <p>번호와 이력은 유지되며, 다시 이용으로 복구할 수 있습니다.</p>
        </div>
        <button class="text-button" type="button" :disabled="inactiveLoading" @click="loadInactiveTables">새로고침</button>
      </div>

      <p v-if="inactiveLoading" class="state-message" role="status">이용 중지한 테이블을 불러오는 중입니다…</p>
      <div v-else-if="inactiveListError" class="state-message error-state" role="alert">
        <p>{{ inactiveListError }}</p>
        <button type="button" @click="loadInactiveTables">다시 시도</button>
      </div>
      <p v-else-if="inactiveTables.length === 0" class="state-message">이용 중지한 테이블이 없습니다.</p>
      <div v-else class="operations-table-wrap"><table class="operations-table"><thead><tr><th>테이블 번호</th><th>표시 이름</th><th>운영 상태</th><th aria-label="작업" /></tr></thead><tbody><tr v-for="table in inactiveTables" :key="table.id"><td class="table-number">{{ table.tableNumber }}</td><td><strong>{{ table.displayName }}</strong></td><td><span class="table-status">이용 중지</span></td><td class="row-actions"><button type="button" @click="reactivate(table)">다시 이용</button></td></tr></tbody></table></div>
    </section>
  </main>
</template>

<style scoped>
.table-page {
  display: grid;
  gap: 1.25rem;
  width: 100%;
  margin: 0 auto;
}

.page-heading,
.section-heading,
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.page-heading h1,
.section-heading h2,
.page-heading p,
.section-heading p {
  margin: 0;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.notice,
.error-banner,
.editor,
.table-list {
  border-radius: var(--radius-surface);
  padding: 1rem 1.25rem;
}

.notice {
  margin: 0;
  background: #e6f7ed;
  color: #17633b;
}

.error-banner,
.error-state,
.field-error {
  color: #a32d2d;
}

.error-banner {
  margin: 0;
  background: #fff0f0;
}

.editor,
.table-list {
  border: 1px solid var(--color-border);
  background: white;
}

.editor form {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: start;
  gap: 1rem;
  margin-top: 1rem;
}

label {
  display: grid;
  gap: 0.4rem;
  font-weight: 650;
}

input {
  min-height: 42px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  padding: 0.65rem 0.75rem;
  font: inherit;
}

input:focus-visible,
button:focus-visible {
  outline: 3px solid rgb(37 99 235 / 16%);
  outline-offset: 2px;
  border-color: var(--color-primary);
}

.field-error {
  font-size: 0.84rem;
}

button {
  min-height: 40px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: white;
  padding: 0.55rem 0.85rem;
  color: var(--color-text);
  cursor: pointer;
}

button:hover:not(:disabled) { background: #f8fafc; }

button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
}
.primary:hover:not(:disabled) { background: var(--color-primary-hover); }

.text-button {
  border-color: transparent;
  background: transparent;
}

.danger {
  border-color: #d6a3a3;
  color: #a32d2d;
}

.state-message {
  margin: 0;
  padding: 1.25rem 1rem;
  text-align: center;
}

.error-state { display: flex; align-items: center; justify-content: center; gap: 12px; }
.error-state p { margin: 0; }
.error-state button { min-height: 32px; flex: 0 0 auto; padding-block: 0; white-space: nowrap; }

.operations-table-wrap { overflow-x: auto; margin: 12px -20px -16px; border-top: 1px solid var(--color-border); }
.operations-table { width: 100%; min-width: 650px; border-collapse: collapse; }.operations-table th, .operations-table td { height: 46px; border-bottom: 1px solid var(--color-border); padding: 0 20px; text-align: left; font-size: 13px; }.operations-table th { height: 36px; background: var(--color-surface-subtle); color: var(--color-muted); font-size: 11px; font-weight: 750; letter-spacing: .04em; }.operations-table tr:last-child td { border-bottom: 0; }.operations-table tbody tr:hover { background: #fafafa; }.row-actions { display: flex; justify-content: flex-end; gap: 6px; min-width: 150px; white-space: nowrap; }.row-actions button { min-height: 30px; flex-shrink: 0; padding: 0 8px; font-size: 12px; white-space: nowrap; }.table-status { display: inline-flex; border-radius: 999px; background: #ecfdf5; padding: 3px 7px; color: #047857; font-size: 11px; font-weight: 700; }

.table-number {
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 700;
}

/* Dense restaurant back-office treatment: metadata is a row, operations are a table. */
.notice, .error-banner { border-radius: 0; padding: .7rem 0; background: transparent; border-bottom: 1px solid var(--color-border); }
.editor, .table-list { border-radius: 4px; padding: 16px 18px; }
.operations-table-wrap { margin: 12px -18px -16px; }
.table-status { background: #f1f5f9; color: #334155; }

@media (max-width: 760px) {
  .page-heading,
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .editor form {
    grid-template-columns: 1fr;
  }

  .page-heading .primary { align-self: flex-start; }
  .error-state { align-items: stretch; flex-direction: column; text-align: left; }
  .error-state button { align-self: flex-start; }
}
</style>
