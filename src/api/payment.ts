import { ApiError, apiRequest } from './http'

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REVIEW_REQUIRED' | 'CANCELLED'

/** Payment Service's payment representation. IDs are opaque values supplied by the service. */
export interface PaymentView {
  id: string
  orderId: string
  providerOrderId: string
  amount: number
  currency: string
  status: PaymentStatus
}

/** @deprecated Use PaymentView. Kept while the checkout flow adopts the contract name. */
export type PaymentResponse = PaymentView

/** @deprecated Payment requests now use the shared API error and authentication handling. */
export { ApiError as PaymentApiError } from './http'

export function createPaymentIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16)
    const value = token === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function createPayment(orderId: string, idempotencyKey: string): Promise<PaymentView> {
  return apiRequest<PaymentView>('/payments', commandOptions({ orderId }, idempotencyKey))
}

export function getPayment(paymentId: string): Promise<PaymentView> {
  return apiRequest<PaymentView>(`/payments/${encodeURIComponent(paymentId)}`)
}

export function confirmPayment(
  paymentId: string,
  paymentKey: string,
  amount: number,
  idempotencyKey: string,
): Promise<PaymentView> {
  return apiRequest<PaymentView>(
    `/payments/${encodeURIComponent(paymentId)}/confirm`,
    commandOptions({ paymentKey, amount }, idempotencyKey),
  )
}

export function cancelPayment(
  paymentId: string,
  reasonCode: string,
  idempotencyKey: string,
): Promise<PaymentView> {
  return apiRequest<PaymentView>(
    `/payments/${encodeURIComponent(paymentId)}/cancel`,
    commandOptions({ reasonCode }, idempotencyKey),
  )
}

function commandOptions(body: unknown, idempotencyKey: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  }
}

/**
 * Only recognised public problem codes are rendered. Never expose a raw Problem `detail`,
 * which can include backend or provider diagnostics.
 */
export function paymentProblemMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '네트워크 상태를 확인한 뒤 다시 시도하세요.'

  const messageByCode: Partial<Record<string, string>> = {
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

  return messageByCode[error.code] ?? '결제 요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.'
}

export function isAuthenticationPaymentError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ['UNAUTHENTICATED', 'AUTHENTICATION_REQUIRED', 'SESSION_ABSOLUTE_EXPIRED'].includes(error.code)
  )
}

export function isDependencyPaymentError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ['SESSION_VALIDATION_UNAVAILABLE', 'PAYMENT_UNAVAILABLE', 'DEPENDENCY_UNAVAILABLE'].includes(
      error.code,
    )
  )
}
