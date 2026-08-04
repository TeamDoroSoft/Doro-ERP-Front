export type RoleCode = 'OWNER' | 'MANAGER' | 'ADMIN' | 'STAFF' | 'CUSTOMER'

export interface OperatorAuth {
  apiBaseUrl: string
  loginId: string
  password: string
}

export interface ProblemFieldError {
  field: string
  code: string
}

export interface ProblemBlocker {
  code: string
  message: string
}

export interface ProblemResponse {
  code?: string
  detail?: string
  title?: string
  status?: number
  fieldErrors?: ProblemFieldError[]
  blockers?: ProblemBlocker[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: string
  readonly fieldErrors: ProblemFieldError[]
  readonly blockers: ProblemBlocker[]

  constructor(status: number, problem: ProblemResponse = {}) {
    const code = problem.code ?? `HTTP_${status}`
    const detail = problem.detail ?? problem.title ?? '요청을 처리하지 못했습니다.'
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
    this.fieldErrors = problem.fieldErrors ?? []
    this.blockers = problem.blockers ?? []
  }
}

export interface TableResponse {
  tableId: string
  tableNumber: string
  displayName: string
  seatCapacity: number
  active: boolean
  usageStatus: 'VACANT' | 'OCCUPIED' | string
  version: number
}

export interface TableFormPayload {
  tableNumber: string
  displayName: string
  seatCapacity: number
  active?: boolean
}

export interface QrCredentialResponse {
  credentialId: string
  tableId: string
  predecessorCredentialId: string | null
  status: string
  issuedAt: string
  accessUrl?: string
}

export interface QrTableAccessResponse {
  accessible: boolean
  store: {
    tenantId: string
  }
  table: {
    tableNumber: string
    displayName: string
  }
  session: {
    sessionId: string
  }
}

export interface TableUsageSessionResponse {
  sessionId: string
  tableId: string
  status: string
  openedAt: string
}

export interface TableUsageSessionCloseResponse {
  sessionId: string
  tableId: string
  openedAt: string
  closedAt: string
  status: string
}

export interface SessionSummary {
  sessionId: string
  tableId: string
  openedAt: string
  closedAt: string | null
  status: string
}

export interface TableOrderItemSummaryResponse {
  productId: string
  productName: string
  quantity: number
  lineAmount: string
}

export interface TableOrderSummaryResponse {
  orderId: string
  orderNumber: string
  createdAt: string
  status: string
  totalAmount: string
  currency: string
  paymentStatus: string
  items: TableOrderItemSummaryResponse[]
}

export interface TableOrderPageResponse {
  session: SessionSummary | null
  items: TableOrderSummaryResponse[]
  nextCursor: string | null
}

export interface TableSessionHistoryPageResponse {
  items: SessionSummary[]
  nextCursor: string | null
}

interface ApiRequestOptions {
  method?: string
  body?: unknown
  auth?: OperatorAuth
  idempotencyKey?: string
  ifMatch?: number
  query?: Record<string, string | number | undefined | null>
  includeCredentials?: boolean
}

const defaultApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

export function createIdempotencyKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12)
  return `${prefix}-${random}`
}

export async function getTables(auth: OperatorAuth): Promise<TableResponse[]> {
  return apiRequest<TableResponse[]>('/tables', { auth })
}

export async function getTable(auth: OperatorAuth, tableId: string): Promise<TableResponse> {
  return apiRequest<TableResponse>(`/tables/${encodeURIComponent(tableId)}`, { auth })
}

export async function createTable(
  auth: OperatorAuth,
  payload: TableFormPayload,
  idempotencyKey: string,
): Promise<TableResponse> {
  return apiRequest<TableResponse>('/tables', {
    method: 'POST',
    body: payload,
    auth,
    idempotencyKey,
  })
}

export async function updateTable(
  auth: OperatorAuth,
  tableId: string,
  payload: TableFormPayload,
  version: number,
  idempotencyKey: string,
): Promise<TableResponse> {
  return apiRequest<TableResponse>(`/tables/${encodeURIComponent(tableId)}`, {
    method: 'PUT',
    body: {
      tableNumber: payload.tableNumber,
      displayName: payload.displayName,
      seatCapacity: payload.seatCapacity,
    },
    auth,
    ifMatch: version,
    idempotencyKey,
  })
}

export async function updateTableActivation(
  auth: OperatorAuth,
  table: TableResponse,
  active: boolean,
  idempotencyKey: string,
): Promise<TableResponse> {
  return apiRequest<TableResponse>(`/tables/${encodeURIComponent(table.tableId)}/activation`, {
    method: 'PATCH',
    body: { active },
    auth,
    ifMatch: table.version,
    idempotencyKey,
  })
}

export async function issueQrCredential(
  auth: OperatorAuth,
  tableId: string,
  idempotencyKey: string,
): Promise<QrCredentialResponse> {
  return apiRequest<QrCredentialResponse>(
    `/tables/${encodeURIComponent(tableId)}/qr-credentials`,
    {
      method: 'POST',
      auth,
      idempotencyKey,
    },
  )
}

export async function reissueQrCredential(
  auth: OperatorAuth,
  tableId: string,
  idempotencyKey: string,
): Promise<QrCredentialResponse> {
  return apiRequest<QrCredentialResponse>(
    `/tables/${encodeURIComponent(tableId)}/qr-credentials/reissue`,
    {
      method: 'POST',
      auth,
      idempotencyKey,
    },
  )
}

export async function startTableSession(
  auth: OperatorAuth,
  tableId: string,
  idempotencyKey: string,
): Promise<TableUsageSessionResponse> {
  return apiRequest<TableUsageSessionResponse>(
    `/tables/${encodeURIComponent(tableId)}/sessions`,
    {
      method: 'POST',
      auth,
      idempotencyKey,
    },
  )
}

export async function closeTableSession(
  auth: OperatorAuth,
  tableId: string,
  sessionId: string,
  idempotencyKey: string,
): Promise<TableUsageSessionCloseResponse> {
  return apiRequest<TableUsageSessionCloseResponse>(
    `/tables/${encodeURIComponent(tableId)}/sessions/${encodeURIComponent(sessionId)}/close`,
    {
      method: 'POST',
      auth,
      idempotencyKey,
    },
  )
}

export async function getCurrentOrders(
  auth: OperatorAuth,
  tableId: string,
  options: { status?: string; cursor?: string; size?: number } = {},
): Promise<TableOrderPageResponse> {
  return apiRequest<TableOrderPageResponse>(
    `/tables/${encodeURIComponent(tableId)}/sessions/current/orders`,
    {
      auth,
      query: options,
    },
  )
}

export async function getPastSessions(
  auth: OperatorAuth,
  tableId: string,
  options: { from?: string; to?: string; cursor?: string; size?: number } = {},
): Promise<TableSessionHistoryPageResponse> {
  return apiRequest<TableSessionHistoryPageResponse>(
    `/tables/${encodeURIComponent(tableId)}/sessions/history`,
    {
      auth,
      query: options,
    },
  )
}

export async function getPastSessionOrders(
  auth: OperatorAuth,
  tableId: string,
  sessionId: string,
  options: { status?: string; cursor?: string; size?: number } = {},
): Promise<TableOrderPageResponse> {
  return apiRequest<TableOrderPageResponse>(
    `/tables/${encodeURIComponent(tableId)}/sessions/${encodeURIComponent(sessionId)}/orders`,
    {
      auth,
      query: options,
    },
  )
}

export async function verifyQrTableAccess(token: string): Promise<QrTableAccessResponse> {
  return apiRequest<QrTableAccessResponse>('/qr/table-access', {
    method: 'POST',
    body: { token },
    includeCredentials: false,
  })
}

export function problemMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '네트워크 상태를 확인한 뒤 다시 시도하세요.'
  }

  const messageByCode: Record<string, string> = {
    AUTHENTICATION_REQUIRED: '로그인이 필요합니다.',
    FORBIDDEN: '현재 권한으로 수행할 수 없습니다.',
    TABLE_NOT_FOUND: '테이블을 찾을 수 없습니다.',
    TABLE_NUMBER_DUPLICATED: '이미 사용 중인 테이블 번호입니다.',
    INVALID_TABLE_NUMBER: '테이블 번호를 확인하세요.',
    INVALID_DISPLAY_NAME: '표시 이름을 확인하세요.',
    INVALID_SEAT_CAPACITY: '좌석 수는 1명 이상 999명 이하로 입력하세요.',
    PRECONDITION_REQUIRED: '최신 테이블 정보를 다시 불러온 뒤 저장하세요.',
    PRECONDITION_FAILED: '다른 사용자가 먼저 수정했습니다. 최신 정보를 다시 불러오세요.',
    QR_CREDENTIAL_ALREADY_ACTIVE: '이미 활성 QR이 있습니다. 재발급을 사용하세요.',
    QR_ACCESS_DENIED: '이 QR은 현재 사용할 수 없습니다.',
    QR_HOST_FORBIDDEN: '허용되지 않은 접속 주소입니다.',
    QR_RATE_LIMITED: '요청이 많습니다. 잠시 후 다시 시도하세요.',
    TABLE_SESSION_ALREADY_OPEN: '이미 열린 세션이 있습니다.',
    TABLE_SESSION_ALREADY_CLOSED: '이미 종료된 세션입니다.',
    TABLE_SESSION_CLOSE_BLOCKED: '세션 종료를 막는 항목이 있습니다.',
    TABLE_SESSION_NOT_AVAILABLE: '비활성 테이블은 세션을 시작할 수 없습니다.',
    TABLE_SESSION_NOT_FOUND: '세션을 찾을 수 없습니다.',
    INVALID_CURSOR: '페이지 정보를 다시 불러오세요.',
    INVALID_PERIOD: '조회 기간을 확인하세요.',
    UNSUPPORTED_ORDER_STATUS: '지원하지 않는 주문 상태입니다.',
    INVALID_PAGE_SIZE: '페이지 크기를 확인하세요.',
    VALIDATION_FAILED: '입력값을 확인하세요.',
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

export function blockerMessages(error: unknown): string[] {
  if (!(error instanceof ApiError)) {
    return []
  }
  return error.blockers.map((blocker) => closeBlockerMessage(blocker.code, blocker.message))
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  headers.set('X-Request-Id', createRequestId())

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey)
  }
  if (options.ifMatch !== undefined) {
    headers.set('If-Match', String(options.ifMatch))
  }
  if (options.auth?.loginId && options.auth.password) {
    headers.set('Authorization', `Basic ${basicToken(options.auth.loginId, options.auth.password)}`)
  }

  const response = await fetch(buildUrl(path, options.auth?.apiBaseUrl, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: options.includeCredentials === false ? 'omit' : 'include',
  })

  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function buildUrl(
  path: string,
  apiBaseUrl = defaultApiBaseUrl,
  query: ApiRequestOptions['query'],
): string {
  const base = apiBaseUrl.trim().replace(/\/+$/, '')
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const params = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value))
    }
  })
  const queryString = params.toString()
  return queryString ? `${url}?${queryString}` : url
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
  const random =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12)
  return `web-${random}`.slice(0, 64)
}

function basicToken(loginId: string, password: string): string {
  const bytes = new TextEncoder().encode(`${loginId}:${password}`)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function validationMessage(field: string, code: string): string {
  if (field === 'seatCapacity') {
    return '좌석 수는 1명 이상 999명 이하로 입력하세요.'
  }
  if (field === 'tableNumber') {
    return '테이블 번호를 입력하세요.'
  }
  if (field === 'displayName') {
    return '표시 이름을 입력하세요.'
  }
  return code
}

function closeBlockerMessage(code: string, fallback: string): string {
  const messageByCode: Record<string, string> = {
    IN_PROGRESS_ORDER: '진행 중인 주문이 있습니다.',
    UNSETTLED_PAYMENT: '미완료 결제가 있습니다.',
    UNKNOWN_ORDER_OR_PAYMENT_STATE: '주문 또는 결제 상태를 확인할 수 없습니다.',
    CONCURRENT_ORDER_APPEND: '새 주문 추가와 충돌했습니다. 다시 확인하세요.',
  }
  return messageByCode[code] ?? fallback
}
