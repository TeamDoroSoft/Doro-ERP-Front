import { resolveApiBaseUrl } from './baseUrl'
import { ApiError, type ProblemDetails } from './http'
import { parseJsonPreservingInt64, stringifyWithInt64, type Int64String } from './int64'

/**
 * These paths and the token scheme are the candidates approved by the kiosk multi-mode decision
 * record. Keep them here until the Payment OpenAPI reaches SCHEMA_APPROVED.
 */
export const PUBLIC_CHECKOUT_CONTRACT = {
  handoffPath: '/public/payment-handoffs',
  tokenScheme: 'Bearer',
} as const

export type PublicCheckoutStatus =
  | 'QUEUED'
  | 'DISPLAYED'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface PublicCheckoutSummary {
  orderName: string
  amount: Int64String
  currency: 'KRW'
  expiresAt: string
  status: PublicCheckoutStatus
}

export interface PublicCheckoutStart {
  clientKey: string
  providerOrderId: string
  orderName: string
  amount: Int64String
  currency: 'KRW'
}

export interface PublicCheckoutConfirmInput {
  paymentKey: string
  providerOrderId: string
  amount: Int64String
}

export interface PublicCheckoutResult {
  status: PublicCheckoutStatus
}

export class PublicCheckoutContractError extends Error {
  constructor() {
    super('The public checkout response does not match the candidate contract.')
    this.name = 'PublicCheckoutContractError'
  }
}

export async function resolvePublicCheckout(
  publicId: string,
  token: string,
): Promise<PublicCheckoutSummary> {
  const value = await publicRequest(
    `${handoffPath(publicId)}/resolve`,
    {
      method: 'POST',
      headers: tokenHeader(token),
    },
    ['amount'],
  )
  return readSummary(value)
}

export async function startPublicCheckout(
  publicId: string,
  token: string,
): Promise<PublicCheckoutStart> {
  const value = await publicRequest(
    `${handoffPath(publicId)}/start`,
    {
      method: 'POST',
      headers: tokenHeader(token),
    },
    ['amount'],
  )
  return readStart(value)
}

export async function confirmPublicCheckout(
  publicId: string,
  input: PublicCheckoutConfirmInput,
  signal?: AbortSignal,
): Promise<PublicCheckoutResult> {
  const value = await publicRequest(
    `${handoffPath(publicId)}/confirm`,
    {
      method: 'POST',
      body: stringifyWithInt64(
        { paymentKey: input.paymentKey, providerOrderId: input.providerOrderId },
        { amount: input.amount },
      ),
      signal,
    },
    ['amount'],
  )
  return readResult(value)
}

export async function getPublicCheckoutStatus(publicId: string): Promise<PublicCheckoutResult> {
  return readResult(await publicRequest(`${handoffPath(publicId)}/status`, {}, ['amount']))
}

function handoffPath(publicId: string): string {
  return `${PUBLIC_CHECKOUT_CONTRACT.handoffPath}/${encodeURIComponent(publicId)}`
}

function tokenHeader(token: string): HeadersInit {
  const normalized = token.trim()
  if (!normalized) throw new PublicCheckoutContractError()
  return { Authorization: `${PUBLIC_CHECKOUT_CONTRACT.tokenScheme} ${normalized}` }
}

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

/**
 * Intentionally separate from the employee/kiosk client: a public 401 must never invoke either
 * session boundary, and an employee CSRF cookie must not be copied onto this request.
 */
async function publicRequest(
  path: string,
  options: RequestInit,
  int64Fields: readonly string[],
): Promise<unknown> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json, application/problem+json')
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/${path.replace(/^\//, '')}`, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new ApiError(0, { status: 0, code: 'NETWORK_ERROR' })
  }

  if (!response.ok) throw new ApiError(response.status, await readProblem(response))
  return parseJsonPreservingInt64<unknown>(await response.text(), { fields: int64Fields })
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails
  } catch {
    return {}
  }
}

function readSummary(value: unknown): PublicCheckoutSummary {
  const record = checkoutRecord(value)
  return {
    orderName: stringField(record, 'orderName'),
    amount: int64Field(record, 'amount'),
    currency: currencyField(record),
    expiresAt: dateField(record, 'expiresAt'),
    status: statusField(record),
  }
}

function readStart(value: unknown): PublicCheckoutStart {
  const record = checkoutRecord(value)
  return {
    clientKey: stringField(record, 'clientKey'),
    providerOrderId: stringField(record, 'providerOrderId'),
    orderName: stringField(record, 'orderName'),
    amount: int64Field(record, 'amount'),
    currency: currencyField(record),
  }
}

function readResult(value: unknown): PublicCheckoutResult {
  const record = checkoutRecord(value)
  return {
    status: statusField(record),
  }
}

function checkoutRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PublicCheckoutContractError()
  }
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) throw new PublicCheckoutContractError()
  return value
}

function int64Field(record: Record<string, unknown>, key: string): Int64String {
  const value = stringField(record, key)
  if (!/^\d+$/.test(value)) throw new PublicCheckoutContractError()
  return value
}

function currencyField(record: Record<string, unknown>): 'KRW' {
  if (record.currency !== 'KRW') throw new PublicCheckoutContractError()
  return 'KRW'
}

function dateField(record: Record<string, unknown>, key: string): string {
  const value = stringField(record, key)
  if (!Number.isFinite(Date.parse(value))) throw new PublicCheckoutContractError()
  return value
}

const checkoutStatuses: ReadonlySet<string> = new Set([
  'QUEUED',
  'DISPLAYED',
  'PROCESSING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
])

function statusField(record: Record<string, unknown>): PublicCheckoutStatus {
  const value = stringField(record, 'status')
  if (!checkoutStatuses.has(value)) throw new PublicCheckoutContractError()
  return value as PublicCheckoutStatus
}
