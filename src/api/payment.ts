export interface PaymentResponse {
  id: string
  orderId: string
  providerOrderId: string
  amount: number
  currency: string
  status: string
}

interface ProblemResponse {
  code?: string
  detail?: string
  title?: string
  status?: number
}

export class PaymentApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: string

  constructor(status: number, problem: ProblemResponse = {}) {
    const code = problem.code ?? `HTTP_${status}`
    const detail = problem.detail ?? problem.title ?? '결제 요청을 처리하지 못했습니다.'
    super(detail)
    this.name = 'PaymentApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export function createPaymentIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16)
    const value = token === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export async function createPayment(
  apiBaseUrl: string,
  orderId: string,
  idempotencyKey: string,
): Promise<PaymentResponse> {
  return paymentRequest<PaymentResponse>(apiBaseUrl, '/api/v1/payments', {
    method: 'POST',
    body: { orderId },
    idempotencyKey,
  })
}

export async function confirmPayment(
  apiBaseUrl: string,
  paymentId: string,
  paymentKey: string,
  amount: number,
  idempotencyKey: string,
): Promise<PaymentResponse> {
  return paymentRequest<PaymentResponse>(
    apiBaseUrl,
    `/api/v1/payments/${encodeURIComponent(paymentId)}/confirm`,
    {
      method: 'POST',
      body: { paymentKey, amount },
      idempotencyKey,
    },
  )
}

export function paymentProblemMessage(error: unknown): string {
  if (!(error instanceof PaymentApiError)) {
    return '네트워크 상태를 확인한 뒤 다시 시도하세요.'
  }

  const messageByCode: Record<string, string> = {
    UNAUTHENTICATED: '직원 로그인이 필요합니다.',
    AUTHENTICATION_REQUIRED: '직원 로그인이 필요합니다.',
    SESSION_ABSOLUTE_EXPIRED: '직원 세션이 만료되었습니다. 다시 로그인하세요.',
    SESSION_VALIDATION_UNAVAILABLE: '직원 세션을 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
    PAYMENT_UNAVAILABLE: '결제 서비스를 사용할 수 없습니다. 잠시 후 다시 시도하세요.',
    DEPENDENCY_UNAVAILABLE: '결제 의존 서비스를 사용할 수 없습니다. 잠시 후 다시 시도하세요.',
    PAYMENT_NOT_FOUND: '결제 정보를 찾을 수 없습니다.',
    ACCESS_DENIED: '현재 직원 권한으로 결제를 처리할 수 없습니다.',
    VALIDATION_FAILED: '결제 요청 값을 확인하세요.',
    IDEMPOTENCY_KEY_REUSED: '이미 다른 결제 요청에 사용된 요청 키입니다.',
    IDEMPOTENCY_REQUEST_IN_PROGRESS: '같은 결제 요청을 처리 중입니다. 잠시 후 다시 시도하세요.',
    STATE_CONFLICT: '현재 결제 상태에서는 요청을 처리할 수 없습니다.',
    ORDER_NOT_ELIGIBLE: '현재 결제할 수 없는 주문입니다.',
    PROVIDER_REJECTED: '결제 제공자가 요청을 거절했습니다.',
  }

  return messageByCode[error.code] ?? error.detail
}

export function isAuthenticationPaymentError(error: unknown): boolean {
  return (
    error instanceof PaymentApiError &&
    ['UNAUTHENTICATED', 'AUTHENTICATION_REQUIRED', 'SESSION_ABSOLUTE_EXPIRED'].includes(error.code)
  )
}

export function isDependencyPaymentError(error: unknown): boolean {
  return (
    error instanceof PaymentApiError &&
    ['SESSION_VALIDATION_UNAVAILABLE', 'PAYMENT_UNAVAILABLE', 'DEPENDENCY_UNAVAILABLE'].includes(
      error.code,
    )
  )
}

interface PaymentRequestOptions {
  method?: string
  body?: unknown
  idempotencyKey?: string
}

async function paymentRequest<T>(
  apiBaseUrl: string,
  path: string,
  options: PaymentRequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json, application/problem+json' })
  headers.set('X-Request-Id', createRequestId())
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey)
  }

  const response = await fetch(buildUrl(apiBaseUrl, path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new PaymentApiError(response.status, await readProblem(response))
  }

  return (await response.json()) as T
}

function buildUrl(apiBaseUrl: string, path: string): string {
  const base = apiBaseUrl.trim().replace(/\/+$/, '')
  return `${base}${path}`
}

async function readProblem(response: Response): Promise<ProblemResponse> {
  try {
    return (await response.json()) as ProblemResponse
  } catch {
    return {
      code: response.status === 401 ? 'UNAUTHENTICATED' : `HTTP_${response.status}`,
      detail: response.statusText,
      status: response.status,
    }
  }
}

function createRequestId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12)
  return `web-${random}`.slice(0, 64)
}
