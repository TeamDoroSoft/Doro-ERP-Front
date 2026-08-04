interface ApiEnvelope<T> {
  data: T
  requestId: string
}

interface ProblemDetails {
  status?: number
  detail?: string
  code?: string
  requestId?: string
  fieldErrors?: ApiFieldError[]
}

export interface ApiFieldError {
  field: string
  code: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: string
  readonly requestId: string
  readonly fieldErrors: ApiFieldError[]

  constructor(problem: Required<ProblemDetails>) {
    super(problem.detail)
    this.name = 'ApiError'
    this.status = problem.status
    this.code = problem.code
    this.detail = problem.detail
    this.requestId = problem.requestId
    this.fieldErrors = problem.fieldErrors
  }
}

export interface RequestOptions extends RequestInit {
  version?: number
}

const defaultBaseUrl = '/api/v1'
const baseUrl = (import.meta.env.VITE_API_BASE_URL || defaultBaseUrl).replace(/\/$/, '')

function createApiError(response: Response, problem?: ProblemDetails): ApiError {
  return new ApiError({
    status: problem?.status ?? response.status,
    code: problem?.code ?? 'HTTP_ERROR',
    detail: problem?.detail ?? (response.statusText || 'API 요청에 실패했습니다.'),
    requestId: problem?.requestId ?? response.headers.get('X-Request-Id') ?? '',
    fieldErrors: problem?.fieldErrors ?? [],
  })
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { version, headers: providedHeaders, ...fetchOptions } = options
  const headers = new Headers(providedHeaders)
  headers.set('Content-Type', 'application/json')

  if (version !== undefined) {
    headers.set('If-Match', `"${version}"`)
  }

  // Temporary development-only authentication. Replace this block when the Identity module
  // provides cookie-based session authentication. DEV is always false in production builds,
  // and each header is additionally guarded by the presence of its environment value.
  if (import.meta.env.DEV) {
    if (import.meta.env.VITE_DEV_ACTOR_ID) {
      headers.set('X-Doro-Actor-Id', import.meta.env.VITE_DEV_ACTOR_ID)
    }
    if (import.meta.env.VITE_DEV_ACTOR_ROLE) {
      headers.set('X-Doro-Actor-Role', import.meta.env.VITE_DEV_ACTOR_ROLE)
    }
    if (import.meta.env.VITE_DEV_ACTOR_PERMISSIONS) {
      headers.set('X-Doro-Actor-Permissions', import.meta.env.VITE_DEV_ACTOR_PERMISSIONS)
    }
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
      ...fetchOptions,
      headers,
    })
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      detail: '서버에 연결할 수 없습니다.',
      requestId: '',
      fieldErrors: [],
    })
  }

  if (!response.ok) {
    let problem: ProblemDetails | undefined
    try {
      problem = (await response.json()) as ProblemDetails
    } catch {
      problem = undefined
    }
    throw createApiError(response, problem)
  }

  const envelope = (await response.json()) as ApiEnvelope<T>
  return envelope.data
}
