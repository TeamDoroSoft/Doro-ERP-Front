import { parseJsonPreservingInt64, type Int64JsonOptions } from './int64'
import { resolveApiBaseUrl } from './baseUrl'

export interface ProblemFieldError {
  field: string
  code: string
}

export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  requestId?: string
  fieldErrors?: ProblemFieldError[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly type: string
  readonly requestId: string
  readonly fieldErrors: ProblemFieldError[]

  constructor(responseStatus: number, problem: ProblemDetails = {}) {
    super(problem.detail ?? problem.title ?? '요청을 처리하지 못했습니다.')
    this.name = 'ApiError'
    this.status = problem.status ?? responseStatus
    this.code = problem.code ?? `HTTP_${responseStatus}`
    this.type = problem.type ?? ''
    this.requestId = problem.requestId ?? ''
    this.fieldErrors = problem.fieldErrors ?? []
  }
}

export function safeApiErrorMessage(
  error: unknown,
  fallback = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
) {
  if (!(error instanceof ApiError)) return fallback
  const codeMessages: Record<string, string> = {
    REAUTH_PASSWORD_REQUIRED: '계속하려면 현재 비밀번호를 입력해 주세요.',
    AUTHENTICATION_FAILED: '아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.',
    AUTH_RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    SESSION_INVALIDATED: '보안을 위해 세션이 종료되었습니다. 다시 로그인해 주세요.',
    REAUTHENTICATION_REQUIRED: '보호된 작업입니다. 현재 비밀번호로 다시 인증해 주세요.',
    PASSWORD_CHANGE_REQUIRED: '계속하려면 먼저 본인 비밀번호를 변경해 주세요.',
    FORBIDDEN: '이 작업을 수행할 권한이 없습니다.',
    CSRF_VALIDATION_FAILED: '요청을 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
    SESSION_VALIDATION_UNAVAILABLE: '로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    VALIDATION_FAILED: '입력한 내용을 확인해 주세요.',
    CATEGORY_NAME_DUPLICATED: '같은 이름의 메뉴 분류가 있습니다. 다른 이름을 입력해 주세요.',
    PRODUCT_NAME_DUPLICATED: '같은 이름의 상품이 있습니다. 다른 이름을 입력해 주세요.',
    CATEGORY_NOT_FOUND: '메뉴 분류를 찾을 수 없습니다. 최신 목록을 확인해 주세요.',
    PRODUCT_NOT_FOUND: '상품을 찾을 수 없습니다. 최신 목록을 확인해 주세요.',
    CATALOG_VERSION_CONFLICT: '다른 사용자가 먼저 변경했습니다. 최신 목록을 확인한 뒤 다시 시도해 주세요.',
    PRECONDITION_REQUIRED: '최신 버전을 확인한 뒤 다시 시도해 주세요.',
    COMMERCE_UNAVAILABLE: '상품 관리 기능을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    STORE_ACCESS_UNAVAILABLE: '직원·권한 관리 기능을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    KIOSK_MODE_FORBIDDEN: '이 기기에서는 해당 기능을 사용할 수 없습니다. 기기 설정을 다시 확인해 주세요.',
    KIOSK_PAYMENT_PAIR_INVALID: '같은 매장의 사용 가능한 결제 Kiosk를 선택해 주세요.',
    KIOSK_PAYMENT_HANDOFF_ACTIVE:
      '진행 중인 결제가 있습니다. 결제 요청을 재배정하거나 취소한 뒤 모드를 변경해 주세요.',
    KIOSK_PAYMENT_HANDOFF_VALIDATION_UNAVAILABLE:
      '진행 중인 결제를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    PAYMENT_HANDOFF_EXPIRED: '결제 시간이 만료되었습니다. 직원에게 새 결제 링크를 요청해 주세요.',
    PAYMENT_HANDOFF_NOT_FOUND: '결제 링크가 만료되었거나 사용할 수 없습니다.',
    PAYMENT_HANDOFF_CONFLICT: '이미 결제 중이거나 완료된 요청입니다. 최신 상태를 확인해 주세요.',
    PUBLIC_CHECKOUT_UNAVAILABLE: '결제 링크가 만료되었거나 사용할 수 없습니다.',
    PAYMENT_DEVICE_NOT_FOUND: '사용 가능한 결제 Kiosk를 찾을 수 없습니다.',
    ORDER_NOT_ELIGIBLE: '현재 주문은 결제할 수 없습니다. 주문 상태를 확인해 주세요.',
    IDEMPOTENCY_REQUEST_IN_PROGRESS: '같은 요청을 처리하고 있습니다. 잠시 후 결과를 확인해 주세요.',
    IDEMPOTENCY_KEY_REUSED: '이전 요청과 내용이 달라 처리할 수 없습니다. 화면을 새로고침해 주세요.',
    TABLE_RESERVATION_CONFLICT: '테이블 상태가 변경되었습니다. 최신 상태를 다시 확인해 주세요.',
    TABLE_CONCURRENT_MODIFICATION: '다른 직원이 테이블을 변경했습니다. 최신 상태를 다시 확인해 주세요.',
    WEAK_PASSWORD: '임시 비밀번호 정책을 확인해 주세요.',
    INVALID_LOGIN_ID: '로그인 ID 형식을 확인해 주세요.',
    INITIAL_OWNER_PROVISIONING_CONFLICT: '최초 관리자 등록 상태가 변경되었습니다. 업체 정보를 다시 확인해 주세요.',
    UPSTREAM_INVALID_RESPONSE: '업체 서비스 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  }
  const codeMessage = codeMessages[error.code]
  if (codeMessage) return codeMessage
  if (error.status === 0) return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.'
  if (error.status === 403) return '이 작업을 수행할 권한이 없습니다.'
  if (error.status === 404) return '요청한 정보를 찾을 수 없습니다.'
  if (error.status === 409)
    return '다른 작업과 충돌했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.'
  if (error.status === 412)
    return '다른 사용자가 먼저 변경했습니다. 최신 목록을 확인한 뒤 다시 시도해 주세요.'
  if (error.status === 428)
    return '최신 버전을 확인한 뒤 다시 시도해 주세요.'
  if (error.status === 503) return '현재 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  if (error.status === 400 || error.code === 'VALIDATION_FAILED')
    return '입력한 내용을 확인해 주세요.'
  return fallback
}

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
const employeeSessionEndCodes = new Set([
  'UNAUTHENTICATED',
  'SESSION_ABSOLUTE_EXPIRED',
  'SESSION_INVALIDATED',
])
const kioskSessionEndCodes = new Set([
  'KIOSK_AUTHENTICATION_FAILED',
  'UNAUTHENTICATED',
  'SESSION_ABSOLUTE_EXPIRED',
])
let unauthorizedHandler: (() => void) | undefined
let kioskUnauthorizedHandler: (() => void) | undefined

export function registerUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

export function registerKioskUnauthorizedHandler(handler: () => void) {
  kioskUnauthorizedHandler = handler
}

export type UnauthorizedBehavior = { handleUnauthorized?: boolean | 'kiosk' }

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined

  const prefix = `${name}=`
  const cookie = document.cookie.split('; ').find((value) => value.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails
  } catch {
    return {}
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  behavior: UnauthorizedBehavior = {},
): Promise<T> {
  const response = await apiResponse(path, options, behavior)

  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}

/**
 * `apiRequest` for resources carrying int64 wire values. The body is read as text and parsed with
 * the listed values preserved, because `response.json()` would already have rounded them.
 */
export async function apiRequestExact<T>(
  path: string,
  options: RequestInit = {},
  int64: Int64JsonOptions = {},
  behavior: UnauthorizedBehavior = {},
): Promise<T> {
  const response = await apiResponse(path, options, behavior)

  if (response.status === 204) return undefined as T

  return parseJsonPreservingInt64<T>(await response.text(), int64)
}

export async function apiResponse(
  path: string,
  options: RequestInit = {},
  behavior: UnauthorizedBehavior = {},
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json, application/problem+json')
  if (options.body !== undefined && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json')
  if (!safeMethods.has(method)) {
    const csrfToken = readCookie('XSRF-TOKEN')
    if (csrfToken) headers.set('X-XSRF-TOKEN', csrfToken)
  }
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/${path.replace(/^\//, '')}`, {
      ...options,
      method,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new ApiError(0, {
      status: 0,
      code: 'NETWORK_ERROR',
      detail: '서버에 연결할 수 없습니다.',
    })
  }

  if (!response.ok) {
    const error = new ApiError(response.status, await readProblem(response))
    if (error.status === 401) {
      if (
        behavior.handleUnauthorized === 'kiosk' &&
        kioskSessionEndCodes.has(error.code)
      ) {
        kioskUnauthorizedHandler?.()
      } else if (
        behavior.handleUnauthorized !== false &&
        behavior.handleUnauthorized !== 'kiosk' &&
        employeeSessionEndCodes.has(error.code)
      ) {
        unauthorizedHandler?.()
      }
    }
    throw error
  }
  return response
}
