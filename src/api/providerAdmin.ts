import { ApiError, apiRequest, apiRequestExact } from './http'
import { resolveApiBaseUrl } from './baseUrl'

export type ProviderAdminTenantStatus = 'ACTIVE' | 'INACTIVE'

export interface ProviderAdminMe {
  adminId: string
  expiresAt: string
}

export interface ProviderAdminStore {
  storeId: string
  name: string
  status: ProviderAdminTenantStatus
}

export interface ProviderAdminTenantListItem {
  tenantId: string
  tenantCode: string
  name: string
  status: ProviderAdminTenantStatus
  createdAt: string
  store: ProviderAdminStore | null
  firstOwnerRequired: boolean
}

export interface ProviderAdminTenantDetail extends ProviderAdminTenantListItem {
  updatedAt: string
}

export interface ProviderAdminTenantPage {
  items: ProviderAdminTenantListItem[]
  page: number
  size: number
  totalCount: string
  totalPages: string
}

export interface ProviderAdminTenantSearch {
  code?: string
  name?: string
  status?: ProviderAdminTenantStatus
  page?: number
  size?: number
}

export interface ProvisionProviderAdminTenantRequest {
  tenantCode: string
  tenantName: string
  storeName: string
  timezone?: string
}

export interface ProvisionedProviderAdminTenant {
  tenantId: string
  storeId: string
  tenantCode: string
  tenantName: string
  storeName: string
  timezone: string
  currency: string
}

export interface CreateProviderAdminInitialOwnerRequest {
  loginId: string
  temporaryPassword: string
}

export interface ProviderAdminInitialOwner {
  employeeId: string
  loginId: string
  role: 'OWNER'
  status: 'ACTIVE'
  passwordChangeRequired: boolean
}

export interface ProviderAdminStatusChanged {
  tenantId: string
  status: ProviderAdminTenantStatus
}

const withoutEmployeeSessionBoundary = { handleUnauthorized: false } as const
const providerBasePath = '/provider'

export function providerAdminLoginUrl(): string {
  const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
  return `${baseUrl}${providerBasePath}/auth/login`
}

export function getProviderAdminSession() {
  return apiRequest<ProviderAdminMe>(
    `${providerBasePath}/auth/me`,
    {},
    withoutEmployeeSessionBoundary,
  )
}

export function logoutProviderAdmin() {
  return apiRequest<void>(
    `${providerBasePath}/auth/logout`,
    { method: 'POST' },
    withoutEmployeeSessionBoundary,
  )
}

export function getProviderAdminTenants(search: ProviderAdminTenantSearch = {}) {
  const query = new URLSearchParams()
  appendTrimmed(query, 'code', search.code)
  appendTrimmed(query, 'name', search.name)
  if (search.status) query.set('status', search.status)
  if (search.page !== undefined) query.set('page', String(search.page))
  if (search.size !== undefined) query.set('size', String(search.size))
  const suffix = query.size > 0 ? `?${query.toString()}` : ''

  return apiRequestExact<ProviderAdminTenantPage>(
    `${providerBasePath}/tenants${suffix}`,
    {},
    { fields: ['totalCount', 'totalPages'] },
    withoutEmployeeSessionBoundary,
  )
}

export function getProviderAdminTenant(tenantId: string) {
  return apiRequest<ProviderAdminTenantDetail>(
    `${providerBasePath}/tenants/${encodeURIComponent(tenantId)}`,
    {},
    withoutEmployeeSessionBoundary,
  )
}

export function provisionProviderAdminTenant(request: ProvisionProviderAdminTenantRequest) {
  const body = {
    tenantCode: request.tenantCode.trim(),
    tenantName: request.tenantName.trim(),
    storeName: request.storeName.trim(),
    ...(request.timezone?.trim() ? { timezone: request.timezone.trim() } : {}),
  }
  return apiRequest<ProvisionedProviderAdminTenant>(
    `${providerBasePath}/tenants`,
    { method: 'POST', body: JSON.stringify(body) },
    withoutEmployeeSessionBoundary,
  )
}

export function createProviderAdminInitialOwner(
  tenantId: string,
  request: CreateProviderAdminInitialOwnerRequest,
) {
  return apiRequest<ProviderAdminInitialOwner>(
    `${providerBasePath}/tenants/${encodeURIComponent(tenantId)}/first-owner`,
    {
      method: 'POST',
      body: JSON.stringify({
        loginId: request.loginId.trim(),
        temporaryPassword: request.temporaryPassword,
      }),
    },
    withoutEmployeeSessionBoundary,
  )
}

export function changeProviderAdminTenantStatus(
  tenantId: string,
  status: ProviderAdminTenantStatus,
) {
  return apiRequest<ProviderAdminStatusChanged>(
    `${providerBasePath}/tenants/${encodeURIComponent(tenantId)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    withoutEmployeeSessionBoundary,
  )
}

export function providerAdminErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  }
  const messages: Record<string, string> = {
    UNAUTHENTICATED: '관리자 로그인이 필요합니다.',
    CSRF_VALIDATION_FAILED: '요청 출처를 확인할 수 없습니다. Admin 주소를 다시 확인해 주세요.',
    TENANT_NOT_FOUND: '업체를 찾을 수 없습니다.',
    TENANT_INACTIVE: '이용 중지된 업체에는 관리자 계정을 등록할 수 없습니다.',
    UPSTREAM_INVALID_RESPONSE: '업체 서비스 응답을 확인할 수 없습니다.',
    DEPENDENCY_UNAVAILABLE: '업체 서비스를 일시적으로 사용할 수 없습니다.',
    VALIDATION_FAILED: '입력한 내용을 확인해 주세요.',
  }
  const message = messages[error.code]
  if (message) return message
  if (error.status === 409) return '요청이 기존 정보 또는 다른 변경과 충돌했습니다. 최신 상태를 확인해 주세요.'
  if (error.status === 502 || error.status === 503) {
    return '업체 서비스를 일시적으로 사용할 수 없습니다.'
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export function isProviderAdminUnauthenticated(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401 && error.code === 'UNAUTHENTICATED'
}

function appendTrimmed(query: URLSearchParams, key: string, value?: string) {
  const trimmed = value?.trim()
  if (trimmed) query.set(key, trimmed)
}
