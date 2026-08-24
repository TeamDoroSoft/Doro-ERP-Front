import { ApiError, apiRequestExact } from './http'
import { stringifyWithInt64, type Int64String } from './int64'

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REVIEW_REQUIRED' | 'CANCELLED'

/** Payment Service's payment representation. IDs are opaque values supplied by the service. */
export interface PaymentView {
  id: string
  orderId: string
  providerOrderId: string
  amount: Int64String
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

export type PaymentRequestContext = 'employee' | 'kiosk'

export function createPayment(
  orderId: string,
  idempotencyKey: string,
  context: PaymentRequestContext = 'employee',
): Promise<PaymentView> {
  return exactPaymentRequest<PaymentView>(
    '/payments',
    commandOptions(JSON.stringify({ orderId }), idempotencyKey),
    context,
  )
}

export function getPayment(
  paymentId: string,
  context: PaymentRequestContext = 'employee',
): Promise<PaymentView> {
  return exactPaymentRequest<PaymentView>(`/payments/${encodeURIComponent(paymentId)}`, {}, context)
}

export async function confirmPayment(
  paymentId: string,
  paymentKey: string,
  amount: Int64String,
  idempotencyKey: string,
  context: PaymentRequestContext = 'employee',
): Promise<PaymentView> {
  return exactPaymentRequest<PaymentView>(
    `/payments/${encodeURIComponent(paymentId)}/confirm`,
    commandOptions(stringifyWithInt64({ paymentKey }, { amount }), idempotencyKey),
    context,
  )
}

export function cancelPayment(
  paymentId: string,
  reasonCode: string,
  idempotencyKey: string,
  context: PaymentRequestContext = 'employee',
): Promise<PaymentView> {
  return exactPaymentRequest<PaymentView>(
    `/payments/${encodeURIComponent(paymentId)}/cancel`,
    commandOptions(JSON.stringify({ reasonCode }), idempotencyKey),
    context,
  )
}

function exactPaymentRequest<T>(
  path: string,
  options: RequestInit,
  context: PaymentRequestContext,
): Promise<T> {
  return apiRequestExact<T>(path, options, { fields: ['amount'] }, {
    handleUnauthorized: context === 'employee' ? true : 'kiosk',
  })
}

/** `body` is already-serialised JSON so int64 command amounts keep their exact wire literal. */
function commandOptions(body: string, idempotencyKey: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body,
  }
}

/**
 * Only recognised public problem codes are rendered. Never expose a raw Problem `detail`,
 * which can include backend or provider diagnostics.
 */
export function paymentProblemMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '연결 상태를 확인한 뒤 다시 시도해 주세요.'

  const messageByCode: Partial<Record<string, string>> = {
    UNAUTHENTICATED: '직원 로그인이 필요합니다.',
    AUTHENTICATION_REQUIRED: '직원 로그인이 필요합니다.',
    SESSION_ABSOLUTE_EXPIRED: '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.',
    SESSION_VALIDATION_UNAVAILABLE: '로그인 상태를 확인할 수 없습니다. 다시 로그인해 주세요.',
    PAYMENT_UNAVAILABLE: '지금은 결제할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    DEPENDENCY_UNAVAILABLE: '지금은 결제할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    PAYMENT_NOT_FOUND: '결제 정보를 찾을 수 없습니다.',
    ACCESS_DENIED: '현재 직원 권한으로 결제를 처리할 수 없습니다.',
    VALIDATION_FAILED: '결제 정보를 확인해 주세요.',
    IDEMPOTENCY_KEY_REUSED: '이미 처리된 결제입니다. 결제 상태를 다시 확인해 주세요.',
    IDEMPOTENCY_REQUEST_IN_PROGRESS: '결제를 처리하고 있습니다. 잠시 후 다시 확인해 주세요.',
    STATE_CONFLICT: '현재 결제 상태에서는 요청을 처리할 수 없습니다.',
    ORDER_NOT_ELIGIBLE: '현재 결제할 수 없는 주문입니다.',
    PROVIDER_REJECTED: '결제가 승인되지 않았습니다. 다른 결제 수단을 이용해 주세요.',
  }

  return messageByCode[error.code] ?? '결제를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
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
