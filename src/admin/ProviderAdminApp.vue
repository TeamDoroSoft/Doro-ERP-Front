<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { loginIdError, temporaryPasswordError } from '@/validation/credentials'
import {
  changeProviderAdminTenantStatus,
  createProviderAdminInitialOwner,
  getProviderAdminSession,
  getProviderAdminTenant,
  getProviderAdminTenants,
  isProviderAdminUnauthenticated,
  logoutProviderAdmin,
  providerAdminErrorMessage,
  providerAdminLoginUrl,
  provisionProviderAdminTenant,
  type ProviderAdminMe,
  type ProviderAdminTenantDetail,
  type ProviderAdminTenantPage,
  type ProviderAdminTenantStatus,
} from '@/api/providerAdmin'

type View = 'list' | 'create' | 'detail'
type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

const authState = ref<AuthState>('loading')
const session = ref<ProviderAdminMe>()
const authMessage = ref('')
const view = ref<View>('list')
const page = ref<ProviderAdminTenantPage>()
const selected = ref<ProviderAdminTenantDetail>()
const listLoading = ref(false)
const detailLoading = ref(false)
const commandLoading = ref(false)
const listError = ref('')
const detailError = ref('')
const notice = ref('')
const confirmStatus = ref(false)
const currentPage = ref(0)
const pageSize = 20
const filters = reactive({ code: '', name: '', status: '' as '' | ProviderAdminTenantStatus })
const createForm = reactive({ tenantCode: '', tenantName: '', storeName: '', timezone: 'Asia/Seoul' })
const ownerForm = reactive({ loginId: '', temporaryPassword: '' })

const tenants = computed(() => page.value?.items ?? [])
const pageCount = computed(() => safePageCount(page.value?.totalPages))
const loginUrl = providerAdminLoginUrl()
const ownerLoginIdError = computed(() => ownerForm.loginId ? loginIdError(ownerForm.loginId) : '')
const ownerPasswordError = computed(() => ownerForm.temporaryPassword ? temporaryPasswordError(ownerForm.temporaryPassword, ownerForm.loginId) : '')

onMounted(() => void bootstrap())

async function bootstrap() {
  readLoginFailure()
  authState.value = 'loading'
  try {
    session.value = await getProviderAdminSession()
    authState.value = 'authenticated'
    await loadTenants()
  } catch (error) {
    if (isProviderAdminUnauthenticated(error)) {
      authState.value = 'unauthenticated'
      return
    }
    authState.value = 'error'
    authMessage.value = providerAdminErrorMessage(error)
  }
}

async function loadTenants(targetPage = currentPage.value) {
  listLoading.value = true
  listError.value = ''
  try {
    page.value = await getProviderAdminTenants({
      code: filters.code,
      name: filters.name,
      status: filters.status || undefined,
      page: targetPage,
      size: pageSize,
    })
    currentPage.value = page.value.page
  } catch (error) {
    if (handleExpiredSession(error)) return
    listError.value = providerAdminErrorMessage(error)
  } finally {
    listLoading.value = false
  }
}

function searchTenants() {
  currentPage.value = 0
  void loadTenants(0)
}

function changePage(offset: number) {
  const next = Math.min(Math.max(currentPage.value + offset, 0), pageCount.value - 1)
  if (next !== currentPage.value) void loadTenants(next)
}

function openList() {
  view.value = 'list'
  selected.value = undefined
  detailError.value = ''
  notice.value = ''
}

function openCreate() {
  view.value = 'create'
  notice.value = ''
  detailError.value = ''
  Object.assign(createForm, {
    tenantCode: '',
    tenantName: '',
    storeName: '',
    timezone: 'Asia/Seoul',
  })
}

async function openTenant(tenantId: string) {
  view.value = 'detail'
  detailLoading.value = true
  detailError.value = ''
  notice.value = ''
  selected.value = undefined
  try {
    selected.value = await getProviderAdminTenant(tenantId)
  } catch (error) {
    if (handleExpiredSession(error)) return
    detailError.value = providerAdminErrorMessage(error)
  } finally {
    detailLoading.value = false
  }
}

async function createTenant() {
  commandLoading.value = true
  detailError.value = ''
  try {
    const created = await provisionProviderAdminTenant(createForm)
    await loadTenants(0)
    await openTenant(created.tenantId)
    notice.value = '업체와 첫 매장이 등록되었습니다. 최초 관리자 계정을 등록해 주세요.'
  } catch (error) {
    if (handleExpiredSession(error)) return
    detailError.value = providerAdminErrorMessage(error)
  } finally {
    commandLoading.value = false
  }
}

async function createInitialOwner() {
  if (!selected.value) return
  if (ownerLoginIdError.value || ownerPasswordError.value) return
  commandLoading.value = true
  detailError.value = ''
  notice.value = ''
  try {
    await createProviderAdminInitialOwner(selected.value.tenantId, {
      loginId: ownerForm.loginId,
      temporaryPassword: ownerForm.temporaryPassword,
    })
    ownerForm.loginId = ''
    ownerForm.temporaryPassword = ''
    selected.value = await getProviderAdminTenant(selected.value.tenantId)
    notice.value = '최초 관리자 계정이 등록되었습니다.'
    await loadTenants(currentPage.value)
  } catch (error) {
    if (handleExpiredSession(error)) return
    detailError.value = providerAdminErrorMessage(error)
  } finally {
    commandLoading.value = false
  }
}

async function changeStatus() {
  if (!selected.value) return
  commandLoading.value = true
  detailError.value = ''
  notice.value = ''
  const status: ProviderAdminTenantStatus =
    selected.value.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  try {
    const changed = await changeProviderAdminTenantStatus(selected.value.tenantId, status)
    selected.value.status = changed.status
    confirmStatus.value = false
    notice.value = `업체 상태가 ${statusLabel(changed.status)}으로 변경되었습니다.`
    await loadTenants(currentPage.value)
  } catch (error) {
    if (handleExpiredSession(error)) return
    detailError.value = providerAdminErrorMessage(error)
  } finally {
    commandLoading.value = false
  }
}

async function logout() {
  commandLoading.value = true
  authMessage.value = ''
  try {
    await logoutProviderAdmin()
    session.value = undefined
    authState.value = 'unauthenticated'
  } catch (error) {
    authMessage.value = providerAdminErrorMessage(error)
  } finally {
    commandLoading.value = false
  }
}

function handleExpiredSession(error: unknown): boolean {
  if (!isProviderAdminUnauthenticated(error)) return false
  session.value = undefined
  authState.value = 'unauthenticated'
  authMessage.value = '관리자 세션이 만료되었습니다. 다시 로그인해 주세요.'
  return true
}

function readLoginFailure() {
  if (typeof window === 'undefined') return
  const query = new URLSearchParams(window.location.search)
  if (query.get('error') !== 'login_failed') return
  authMessage.value = '관리자 로그인에 실패했습니다. 접근 권한을 확인한 뒤 다시 시도해 주세요.'
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
}

function statusLabel(status: ProviderAdminTenantStatus) {
  return status === 'ACTIVE' ? '운영 중' : '이용 중지'
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '확인 필요' : new Intl.DateTimeFormat('ko-KR').format(date)
}

function safePageCount(value?: string) {
  if (!value || !/^\d+$/.test(value)) return 1
  const pages = BigInt(value)
  if (pages < 1n) return 1
  return pages > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(pages)
}
</script>

<template>
  <div class="admin-shell">
    <header class="admin-header">
      <button class="brand" type="button" @click="openList">
        <span class="brand-mark">D</span>
        <span><strong>Doro ERP</strong><small>Provider Admin</small></span>
      </button>
      <div v-if="authState === 'authenticated'" class="header-meta">
        <span class="internal-badge">내부 관리자</span>
        <span>{{ session?.adminId }}</span>
        <button type="button" :disabled="commandLoading" @click="logout">로그아웃</button>
      </div>
    </header>

    <main v-if="authState !== 'authenticated'" class="auth-page">
      <LoadingState v-if="authState === 'loading'" />
      <section v-else class="auth-card">
        <p class="eyebrow">Provider Admin</p>
        <h1>관리자 인증이 필요합니다</h1>
        <p>{{ authMessage || (authState === 'error' ? '관리자 API에 연결하지 못했습니다.' : '승인된 관리자 계정으로 로그인해 주세요.') }}</p>
        <div class="actions">
          <a v-if="authState === 'unauthenticated'" class="primary" :href="loginUrl">관리자 로그인</a>
          <button v-else class="secondary" type="button" @click="bootstrap">다시 확인</button>
        </div>
      </section>
    </main>

    <div v-else class="admin-layout">
      <aside class="admin-nav" aria-label="관리 메뉴">
        <p class="nav-label">관리</p>
        <button class="active" type="button" @click="openList">▦ 업체 관리</button>
        <p class="nav-note">Admin Edge를 통해 업체와 최초 관리자 계정을 관리합니다.</p>
      </aside>

      <main class="admin-main">
        <p v-if="authMessage" class="error-notice" role="alert">{{ authMessage }}</p>

        <section v-if="view === 'list'" class="page" aria-labelledby="tenant-list-title">
          <div class="page-heading">
            <div><p class="eyebrow">업체 관리</p><h1 id="tenant-list-title">업체 목록</h1></div>
            <button class="primary" data-test="new-tenant" type="button" @click="openCreate">신규 업체 등록</button>
          </div>

          <form class="filters" @submit.prevent="searchTenants">
            <label>업체명<input v-model="filters.name" name="tenant-name-filter" maxlength="255" placeholder="업체명 검색" /></label>
            <label>업체 코드<input v-model="filters.code" name="tenant-code-filter" maxlength="30" pattern="[a-z0-9-]+" placeholder="doro-gangnam" /></label>
            <label>운영 상태<select v-model="filters.status"><option value="">전체</option><option value="ACTIVE">운영 중</option><option value="INACTIVE">이용 중지</option></select></label>
            <button class="secondary" type="submit" :disabled="listLoading">조회</button>
          </form>

          <LoadingState v-if="listLoading" />
          <section v-else-if="listError" class="error-notice" role="alert">
            <p>{{ listError }}</p><button class="secondary" type="button" @click="loadTenants()">다시 시도</button>
          </section>
          <EmptyState v-else-if="tenants.length === 0" title="표시할 업체가 없습니다" description="검색 조건을 바꾸거나 신규 업체를 등록해 주세요." />
          <template v-else>
            <div class="tenant-table-wrap">
              <table class="tenant-table">
                <thead><tr><th>업체명</th><th>운영 상태</th><th>첫 매장</th><th>관리자</th><th>등록일</th><th /></tr></thead>
                <tbody>
                  <tr v-for="tenant in tenants" :key="tenant.tenantId">
                    <td><strong>{{ tenant.name }}</strong><small>{{ tenant.tenantCode }}</small></td>
                    <td><span class="status" :class="tenant.status.toLowerCase()">{{ statusLabel(tenant.status) }}</span></td>
                    <td><template v-if="tenant.store"><strong>{{ tenant.store.name }}</strong><small>{{ statusLabel(tenant.store.status) }}</small></template><span v-else>등록 전</span></td>
                    <td>{{ tenant.firstOwnerRequired ? '등록 필요' : '등록 완료' }}</td>
                    <td>{{ dateLabel(tenant.createdAt) }}</td>
                    <td><button class="text-button" type="button" @click="openTenant(tenant.tenantId)">상세보기</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <nav class="pagination" aria-label="업체 목록 페이지">
              <button class="secondary" :disabled="currentPage === 0" type="button" @click="changePage(-1)">이전</button>
              <span>{{ currentPage + 1 }} / {{ pageCount }}</span>
              <button class="secondary" :disabled="currentPage + 1 >= pageCount" type="button" @click="changePage(1)">다음</button>
            </nav>
          </template>
        </section>

        <section v-else-if="view === 'create'" class="page narrow" aria-labelledby="tenant-create-title">
          <button class="back" type="button" @click="openList">← 업체 목록</button>
          <div class="page-heading"><div><p class="eyebrow">업체 관리</p><h1 id="tenant-create-title">신규 업체 등록</h1></div></div>
          <p v-if="detailError" class="error-notice" role="alert">{{ detailError }}</p>
          <form class="panel form" @submit.prevent="createTenant">
            <label>업체 코드<input v-model="createForm.tenantCode" name="tenant-code" required maxlength="30" pattern="[a-z0-9-]+" autocomplete="off" /></label>
            <label>업체명<input v-model="createForm.tenantName" name="tenant-name" required maxlength="255" /></label>
            <label>첫 매장명<input v-model="createForm.storeName" name="store-name" required maxlength="190" /></label>
            <label>시간대<input v-model="createForm.timezone" name="timezone" maxlength="64" placeholder="Asia/Seoul" /></label>
            <div class="actions"><button class="primary" type="submit" :disabled="commandLoading">업체 및 매장 등록</button><button class="secondary" type="button" @click="openList">취소</button></div>
          </form>
        </section>

        <section v-else class="page narrow" aria-labelledby="tenant-detail-title">
          <button class="back" type="button" @click="openList">← 업체 목록</button>
          <LoadingState v-if="detailLoading" />
          <section v-else-if="detailError && !selected" class="error-notice" role="alert"><p>{{ detailError }}</p><button class="secondary" type="button" @click="openList">목록으로</button></section>
          <template v-else-if="selected">
            <div class="page-heading"><div><p class="eyebrow">업체 상세</p><h1 id="tenant-detail-title">{{ selected.name }}</h1><p>{{ selected.tenantCode }}</p></div><span class="status large" :class="selected.status.toLowerCase()">{{ statusLabel(selected.status) }}</span></div>
            <p v-if="notice" class="notice" role="status">{{ notice }}</p>
            <p v-if="detailError" class="error-notice" role="alert">{{ detailError }}</p>
            <div class="detail-grid">
              <section class="panel"><h2>업체 정보</h2><dl><div><dt>업체 ID</dt><dd>{{ selected.tenantId }}</dd></div><div><dt>등록일</dt><dd>{{ dateLabel(selected.createdAt) }}</dd></div><div><dt>수정일</dt><dd>{{ dateLabel(selected.updatedAt) }}</dd></div></dl></section>
              <section class="panel"><h2>첫 매장</h2><dl v-if="selected.store"><div><dt>매장명</dt><dd>{{ selected.store.name }}</dd></div><div><dt>상태</dt><dd>{{ statusLabel(selected.store.status) }}</dd></div></dl><p v-else>등록된 첫 매장이 없습니다.</p></section>
            </div>
            <form v-if="selected.firstOwnerRequired" class="panel form" @submit.prevent="createInitialOwner">
              <div><p class="eyebrow">최초 관리자</p><h2>OWNER 계정 등록</h2></div>
              <label>로그인 ID<input v-model="ownerForm.loginId" name="owner-login-id" required minlength="4" maxlength="50" pattern="[a-z0-9](?:[a-z0-9._-]{2,48}[a-z0-9])" autocomplete="off" /><small :class="{ invalid: ownerLoginIdError }">{{ ownerLoginIdError || '4~50자 영문 소문자·숫자·점·밑줄·하이픈, 시작과 끝은 영문 또는 숫자' }}</small></label>
              <label>임시 비밀번호<input v-model="ownerForm.temporaryPassword" name="owner-temporary-password" required minlength="15" maxlength="128" type="password" autocomplete="new-password" /><small v-if="ownerPasswordError" class="invalid">{{ ownerPasswordError }}</small></label>
              <button class="primary" type="submit" :disabled="commandLoading || selected.status !== 'ACTIVE' || !!ownerLoginIdError || !!ownerPasswordError">최초 관리자 등록</button>
            </form>
            <section v-else class="panel"><p class="eyebrow">최초 관리자</p><h2>등록 완료</h2><p>최초 OWNER 계정이 등록되어 있습니다.</p></section>
            <section class="panel action-panel"><div><h2>업체 이용 관리</h2><p>이용 상태를 변경해도 매장과 관리자 정보는 유지됩니다.</p></div><button class="danger" type="button" :disabled="commandLoading" @click="confirmStatus = true">{{ selected.status === 'ACTIVE' ? '업체 이용 중지' : '업체 이용 재개' }}</button></section>
          </template>
        </section>
      </main>
    </div>

    <div v-if="confirmStatus && selected" class="modal-backdrop" role="presentation">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="status-confirm-title">
        <p class="eyebrow">이용 상태 변경</p><h2 id="status-confirm-title">업체 이용을 {{ selected.status === 'ACTIVE' ? '중지' : '재개' }}할까요?</h2>
        <div class="actions"><button class="danger" type="button" :disabled="commandLoading" @click="changeStatus">확인</button><button class="secondary" type="button" @click="confirmStatus = false">취소</button></div>
      </section>
    </div>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }
.admin-shell { min-height: 100vh; background: #f5f7fb; color: #24324a; }
.admin-header { height: 68px; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; background: #15233f; color: #fff; }
.brand { display: flex; align-items: center; gap: 10px; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; }
.brand-mark { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; background: #5b8def; font-weight: 800; }
.brand small, .tenant-table small { display: block; color: #7a8699; font-size: 11px; }
.brand small { color: #b9c6df; }
.header-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; }
.header-meta button { border: 1px solid #607493; border-radius: 7px; background: transparent; padding: 7px 10px; color: #fff; cursor: pointer; }
.internal-badge { border: 1px solid #516786; border-radius: 999px; padding: 4px 9px; font-weight: 700; }
.auth-page { display: grid; min-height: calc(100vh - 68px); place-items: center; padding: 24px; }
.auth-card { width: min(480px, 100%); border: 1px solid #dbe3ef; border-radius: 14px; background: #fff; padding: 30px; box-shadow: 0 18px 50px rgb(25 46 80 / 10%); }
.auth-card h1 { margin: 8px 0 12px; }.auth-card p:not(.eyebrow) { margin-bottom: 22px; color: #66758b; }
.admin-layout { display: grid; grid-template-columns: 224px minmax(0, 1fr); min-height: calc(100vh - 68px); }
.admin-nav { padding: 26px 14px; border-right: 1px solid #dce4f0; background: #fff; }
.nav-label, .eyebrow { color: #62708a; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.admin-nav button { width: 100%; border: 0; border-radius: 8px; background: #eaf1ff; padding: 11px 12px; color: #275cae; text-align: left; font-weight: 750; cursor: pointer; }
.nav-note { margin: 28px 12px 0; color: #78859a; font-size: 12px; line-height: 1.55; }
.admin-main { width: min(1180px, 100%); padding: 30px; margin: 0 auto; }
.page { display: grid; gap: 20px; }.page.narrow { max-width: 920px; }
.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; }.page-heading h1 { margin: 4px 0 5px; color: #16233a; font-size: 28px; }
.filters { display: grid; grid-template-columns: 1fr 1fr 180px auto; gap: 10px; align-items: end; }
label { display: grid; gap: 6px; color: #526177; font-size: 13px; font-weight: 700; }
input, select { width: 100%; border: 1px solid #cbd6e6; border-radius: 8px; background: #fff; padding: 10px 11px; color: #24324a; }
.primary, .danger, .secondary, .text-button { display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 700; text-decoration: none; cursor: pointer; }
.primary { background: #2f69c7; color: #fff; }.danger { background: #c83c43; color: #fff; }.secondary { border: 1px solid #ccd6e5; background: #fff; color: #3d4e67; }.text-button { background: transparent; color: #2f69c7; padding: 5px; }
button:disabled { opacity: .45; cursor: not-allowed; }
.tenant-table-wrap, .panel { overflow: hidden; border: 1px solid #dbe3ef; border-radius: 12px; background: #fff; }
.tenant-table { width: 100%; border-collapse: collapse; table-layout: fixed; }.tenant-table th, .tenant-table td { padding: 14px 12px; border-bottom: 1px solid #edf1f6; text-align: left; font-size: 13px; overflow-wrap: anywhere; }.tenant-table th { background: #f9fbfe; color: #68768d; font-size: 11px; }.tenant-table tr:last-child td { border-bottom: 0; }
.status { display: inline-flex; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 800; }.status.active { background: #e6f7f0; color: #087c57; }.status.inactive { background: #fceceb; color: #b5393e; }.status.large { padding: 7px 11px; }
.pagination { display: flex; align-items: center; justify-content: end; gap: 10px; }
.back { width: max-content; border: 0; background: transparent; padding: 0; color: #386ac0; font-weight: 700; cursor: pointer; }
.panel { padding: 22px; }.panel h2 { margin: 5px 0 14px; color: #20304a; font-size: 17px; }.form { display: grid; gap: 16px; }.actions { display: flex; flex-wrap: wrap; gap: 9px; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }.panel dl { display: grid; gap: 14px; }.panel dt { color: #758197; font-size: 12px; }.panel dd { margin: 2px 0 0; font-weight: 700; overflow-wrap: anywhere; }
.action-panel { display: flex; align-items: end; justify-content: space-between; gap: 20px; }.action-panel p { color: #66758b; }
.notice, .error-notice { border-radius: 9px; padding: 13px; }.notice { background: #eaf2ff; color: #315b98; }.error-notice { background: #fff0f0; color: #9b2f36; }.error-notice p { margin-bottom: 10px; }
.modal-backdrop { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 20px; background: rgb(11 23 42 / 48%); }.modal { width: min(440px, 100%); border-radius: 14px; background: #fff; padding: 26px; }.modal h2 { margin: 7px 0 20px; color: #20304a; font-size: 20px; }
@media (max-width: 800px) { .admin-header { padding: 0 16px; }.header-meta > span { display: none; }.admin-layout { grid-template-columns: 1fr; }.admin-nav { padding: 10px 14px; border-right: 0; border-bottom: 1px solid #dce4f0; }.nav-label, .nav-note { display: none; }.admin-nav button { width: auto; }.admin-main { padding: 20px 14px; }.filters, .detail-grid { grid-template-columns: 1fr; }.page-heading, .action-panel { align-items: stretch; flex-direction: column; }.tenant-table th:nth-child(3), .tenant-table td:nth-child(3), .tenant-table th:nth-child(5), .tenant-table td:nth-child(5) { display: none; } }
</style>
