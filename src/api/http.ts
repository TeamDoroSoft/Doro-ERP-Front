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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

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

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json, application/problem+json')

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

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

  if (!response.ok) throw new ApiError(response.status, await readProblem(response))
  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}
