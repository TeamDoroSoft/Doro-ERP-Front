/**
 * 03 상품·메뉴 관리 (FR-CATALOG-*) Commerce Catalog API Client.
 *
 * 기존 `src/api/table.ts`의 Problem 계약·If-Match·Request ID 패턴을 그대로 따른다.
 */

export type CatalogRoleCode = 'OWNER' | 'MANAGER' | 'STAFF' | 'KIOSK_DEVICE'

/**
 * Commerce가 요구하는 Actor Context.
 *
 * 02 계정·역할·기기 인증의 Session 계약이 확정되기 전까지 Edge가 붙일 Header를 화면에서 설정한다.
 * 서명 Secret은 절대 Browser에 두지 않는다.
 */
export interface CatalogAuth {
  apiBaseUrl: string
  tenantId: string
  storeId: string
  actorId: string
  roleCode: CatalogRoleCode
}

export interface ProblemFieldError {
  field: string
  code: string
}

export interface ProblemResponse {
  code?: string
  detail?: string
  title?: string
  status?: number
  fieldErrors?: ProblemFieldError[]
}

export type CatalogErrorKind =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER'
  | 'NETWORK'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: string
  readonly fieldErrors: ProblemFieldError[]

  constructor(status: number, problem: ProblemResponse = {}) {
    const code = problem.code ?? `HTTP_${status}`
    const detail = problem.detail ?? problem.title ?? '요청을 처리하지 못했습니다.'
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
    this.fieldErrors = problem.fieldErrors ?? []
  }
}

export interface CategoryResponse {
  categoryId: string
  name: string
  displayOrder: number
  active: boolean
  version: number
}

export interface ProductResponse {
  productId: string
  categoryId: string
  name: string
  description: string | null
  price: number
  soldOut: boolean
  active: boolean
  displayOrder: number
  version: number
}

/**
 * 판매 메뉴 항목 (FR-CATALOG-004).
 *
 * 비활성 Category·비활성 상품·품절 상품은 서버가 이미 제외하므로 판매 가능 Flag가 없다.
 * 목록에 있으면 곧 주문 가능한 상품이다. 품절 Toggle이 필요한 직원 화면은 운영 목록을 사용한다.
 */
export interface SalesMenuItemResponse {
  productId: string
  name: string
  description: string | null
  price: number
  displayOrder: number
}

export interface SalesMenuCategoryResponse {
  categoryId: string
  name: string
  displayOrder: number
  products: SalesMenuItemResponse[]
}

export interface SalesMenuResponse {
  currency: string
  categories: SalesMenuCategoryResponse[]
}

export interface CategoryFormPayload {
  name: string
  displayOrder: number
  active?: boolean
}

export interface ProductFormPayload {
  categoryId: string
  name: string
  description?: string | null
  price: number
  displayOrder: number
  active?: boolean
}

interface ApiRequestOptions {
  method?: string
  body?: unknown
  auth: CatalogAuth
  ifMatch?: number
}

const defaultApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

export async function getSalesMenu(auth: CatalogAuth): Promise<SalesMenuResponse> {
  return apiRequest<SalesMenuResponse>('/api/v1/catalog/menu', { auth })
}

export async function getCategories(auth: CatalogAuth): Promise<CategoryResponse[]> {
  return apiRequest<CategoryResponse[]>('/api/v1/catalog/categories', { auth })
}

export async function getProducts(auth: CatalogAuth): Promise<ProductResponse[]> {
  return apiRequest<ProductResponse[]>('/api/v1/catalog/products', { auth })
}

export async function createCategory(
  auth: CatalogAuth,
  payload: CategoryFormPayload,
): Promise<CategoryResponse> {
  return apiRequest<CategoryResponse>('/api/v1/catalog/categories', {
    method: 'POST',
    body: {
      name: payload.name,
      displayOrder: payload.displayOrder,
      active: payload.active ?? true,
    },
    auth,
  })
}

export async function updateCategory(
  auth: CatalogAuth,
  categoryId: string,
  payload: Partial<CategoryFormPayload>,
  version: number,
): Promise<CategoryResponse> {
  return apiRequest<CategoryResponse>(`/api/v1/catalog/categories/${encodeURIComponent(categoryId)}`, {
    method: 'PATCH',
    body: payload,
    auth,
    ifMatch: version,
  })
}

export async function createProduct(
  auth: CatalogAuth,
  payload: ProductFormPayload,
): Promise<ProductResponse> {
  return apiRequest<ProductResponse>('/api/v1/catalog/products', {
    method: 'POST',
    body: {
      categoryId: payload.categoryId,
      name: payload.name,
      description: payload.description ?? null,
      price: payload.price,
      displayOrder: payload.displayOrder,
      active: payload.active ?? true,
    },
    auth,
  })
}

export async function updateProduct(
  auth: CatalogAuth,
  productId: string,
  payload: Partial<ProductFormPayload>,
  version: number,
): Promise<ProductResponse> {
  return apiRequest<ProductResponse>(`/api/v1/catalog/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    body: payload,
    auth,
    ifMatch: version,
  })
}

export async function updateProductSoldOut(
  auth: CatalogAuth,
  productId: string,
  soldOut: boolean,
  version: number,
): Promise<ProductResponse> {
  return apiRequest<ProductResponse>(
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/sold-out`,
    {
      method: 'PATCH',
      body: { soldOut },
      auth,
      ifMatch: version,
    },
  )
}

/** 화면이 오류 종류별로 다른 안내를 보여줄 수 있게 분류한다. */
export function errorKind(error: unknown): CatalogErrorKind {
  if (!(error instanceof ApiError)) {
    return 'NETWORK'
  }
  if (error.status === 401) {
    return 'AUTHENTICATION'
  }
  if (error.status === 403) {
    return 'FORBIDDEN'
  }
  if (error.status === 404) {
    return 'NOT_FOUND'
  }
  if (error.status === 409 || error.status === 412 || error.status === 428) {
    return 'CONFLICT'
  }
  if (error.status >= 500) {
    return 'SERVER'
  }
  return 'VALIDATION'
}

export function problemMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.'
  }

  const messageByCode: Record<string, string> = {
    AUTHENTICATION_REQUIRED: '로그인이 필요합니다. 다시 로그인한 뒤 시도하세요.',
    FORBIDDEN: '권한이 부족합니다. 이 작업은 현재 역할로 수행할 수 없습니다.',
    VALIDATION_FAILED: '입력값을 확인하세요.',
    CATEGORY_NOT_FOUND: 'Category를 찾을 수 없습니다. 목록을 새로고침하세요.',
    PRODUCT_NOT_FOUND: '상품을 찾을 수 없습니다. 목록을 새로고침하세요.',
    CATEGORY_NAME_DUPLICATED: '이미 사용 중인 Category 이름입니다.',
    PRODUCT_NAME_DUPLICATED: '이미 사용 중인 상품 이름입니다.',
    PRECONDITION_REQUIRED: '최신 정보를 다시 불러온 뒤 저장하세요.',
    CATALOG_VERSION_CONFLICT: '다른 사용자가 먼저 변경했습니다. 새로고침한 뒤 다시 시도하세요.',
    INTERNAL_SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
  }
  return messageByCode[error.code] ?? error.detail
}

export function fieldErrorMap(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) {
    return {}
  }
  return Object.fromEntries(
    error.fieldErrors.map((item) => [item.field, validationMessage(item.field, item.code)]),
  )
}

async function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  headers.set('X-Request-Id', createRequestId())
  headers.set('X-Doro-Tenant-Id', options.auth.tenantId)
  headers.set('X-Doro-Store-Id', options.auth.storeId)
  headers.set('X-Doro-Actor-Type', options.auth.roleCode === 'KIOSK_DEVICE' ? 'DEVICE' : 'EMPLOYEE')
  headers.set('X-Doro-Actor-Id', options.auth.actorId)
  headers.set('X-Doro-Actor-Role', options.auth.roleCode)

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.ifMatch !== undefined) {
    headers.set('If-Match', String(options.ifMatch))
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.auth.apiBaseUrl), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
    })
  } catch {
    throw new TypeError('network request failed')
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response))
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

function buildUrl(path: string, apiBaseUrl = defaultApiBaseUrl): string {
  const base = (apiBaseUrl ?? '').trim().replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function readProblem(response: Response): Promise<ProblemResponse> {
  try {
    return (await response.json()) as ProblemResponse
  } catch {
    return {
      code: response.status === 401 ? 'AUTHENTICATION_REQUIRED' : `HTTP_${response.status}`,
      detail: response.statusText,
      status: response.status,
    }
  }
}

function createRequestId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12)
  return `web-${random}`.slice(0, 64)
}

function validationMessage(field: string, code: string): string {
  const messageByField: Record<string, string> = {
    name: '이름을 1자 이상 100자 이하로 입력하세요.',
    price: '가격은 0원 이상의 정수로 입력하세요.',
    displayOrder: '표시 순서는 0 이상 9999 이하로 입력하세요.',
    description: '설명은 500자 이하로 입력하세요.',
    categoryId: 'Category를 다시 선택하세요.',
    soldOut: '품절 여부를 선택하세요.',
    'If-Match': '최신 정보를 다시 불러온 뒤 저장하세요.',
  }
  return messageByField[field] ?? code
}
