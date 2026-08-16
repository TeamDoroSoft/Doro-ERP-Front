<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ApiError } from '@/api/http'
import {
  changeTableStatus,
  createTable,
  getTables,
  updateTable,
  type TableDetailsRequest,
  type TableResponse,
} from '@/api/table'
import { useOperatorSessionStore } from '@/stores/operatorSession'
import { displayLabel } from '@/ui/displayLabels'

type FormMode = 'create' | 'edit'

const session = useOperatorSessionStore()
const tables = ref<TableResponse[]>([])
const loading = ref(true)
const listError = ref('')
const notice = ref('')
const operationError = ref('')
const formMode = ref<FormMode | null>(null)
const editingId = ref('')
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const form = reactive<TableDetailsRequest>({ tableNumber: '', displayName: '' })

const canManage = computed(() => session.canManageTables)

onMounted(loadTables)

async function loadTables() {
  loading.value = true
  listError.value = ''
  try {
    tables.value = await getTables()
  } catch (error) {
    listError.value = messageFor(error, '테이블 목록을 불러오지 못했습니다.')
  } finally {
    loading.value = false
  }
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
    await loadTables()
  } catch (error) {
    await handleMutationError(error)
  } finally {
    saving.value = false
  }
}

async function deactivate(table: TableResponse) {
  if (!window.confirm(`${table.displayName} 테이블을 비활성화할까요?`)) return

  resetOperationMessages()
  try {
    await changeTableStatus(table.id, 'INACTIVE')
    notice.value = '테이블을 비활성화했습니다.'
    await loadTables()
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
    operationError.value = messageFor(error, '요청을 처리하지 못했습니다.')
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
        <p>주문에 사용할 활성 테이블의 번호와 표시 이름을 관리합니다.</p>
      </div>
      <button v-if="canManage" class="primary" type="button" @click="openCreateForm">
        테이블 등록
      </button>
    </header>

    <p v-if="session.role === null" class="role-note">
      현재 계정의 권한을 확인할 수 없어 조회 전용으로 표시합니다.
    </p>
    <p v-else class="role-note">현재 권한: {{ displayLabel(session.role) }}</p>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="operationError" class="error-banner" role="alert">{{ operationError }}</p>

    <section v-if="formMode" class="editor" aria-labelledby="editor-title">
      <div class="section-heading">
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
          <h2 id="table-list-title">활성 테이블</h2>
          <p>현재 주문에서 선택할 수 있는 테이블입니다.</p>
        </div>
        <button class="text-button" type="button" :disabled="loading" @click="loadTables">새로고침</button>
      </div>

      <p v-if="loading" class="state-message" role="status">테이블 목록을 불러오는 중입니다…</p>
      <div v-else-if="listError" class="state-message error-state" role="alert">
        <p>{{ listError }}</p>
        <button type="button" @click="loadTables">다시 시도</button>
      </div>
      <p v-else-if="tables.length === 0" class="state-message">등록된 활성 테이블이 없습니다.</p>
      <ul v-else class="cards">
        <li v-for="table in tables" :key="table.id" class="table-card">
          <div>
            <span class="table-number">{{ table.tableNumber }}</span>
            <h3>{{ table.displayName }}</h3>
          </div>
          <div v-if="canManage" class="card-actions">
            <button type="button" @click="openEditForm(table)">수정</button>
            <button class="danger" type="button" @click="deactivate(table)">비활성화</button>
          </div>
        </li>
      </ul>
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
.table-card,
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.page-heading h1,
.section-heading h2,
.table-card h3,
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

.role-note,
.notice,
.error-banner,
.editor,
.table-list {
  border-radius: 14px;
  padding: 1rem 1.25rem;
}

.role-note {
  margin: 0;
  border: 1px solid #c7d2fe;
  background: var(--color-primary-soft);
  color: #4338ca;
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
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  font: inherit;
}

input:focus-visible,
button:focus-visible {
  outline: 3px solid rgb(79 70 229 / 18%);
  outline-offset: 2px;
  border-color: var(--color-primary);
}

.field-error {
  font-size: 0.84rem;
}

button {
  min-height: 40px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
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
.primary:hover:not(:disabled) { background: #4338ca; }

.text-button {
  border-color: transparent;
  background: transparent;
}

.danger {
  border-color: #d6a3a3;
  color: #a32d2d;
}

.state-message {
  padding: 2.5rem 1rem;
  text-align: center;
}

.cards {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.table-card {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
}
.table-card:hover { border-color: #c7d2fe; background: #fafaff; }

.table-number {
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 700;
}

@media (max-width: 680px) {
  .page-heading,
  .table-card,
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .editor form {
    grid-template-columns: 1fr;
  }

  .card-actions button {
    flex: 1;
  }
}
</style>
