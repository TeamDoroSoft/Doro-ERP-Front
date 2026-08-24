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
  if (error.status === 0) return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.'
  if (error.status === 403) return '이 작업을 수행할 권한이 없습니다.'
  if (error.status === 404) return '요청한 정보를 찾을 수 없습니다.'
  if (error.status === 409)
    return '다른 작업과 충돌했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.'
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
const kioskSessionEndCodes = new Set(['KIOSK_AUTHENTICATION_FAILED'])
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
