import { apiRequestExact } from './http'
import type { Int64String } from './int64'

export type EntryStatus = 'WAITING' | 'ENTERED' | 'CANCELLED' | 'NO_SHOW'
export type FulfillmentStatus = 'PREPARING' | 'READY' | 'CANCELLED'

export interface EntryQueueView {
  entryId: string
  businessDate: string
  queueNumber: number
  partySize: number
  status: EntryStatus
  /** Queue optimistic-lock counter (Java `long`). */
  version: Int64String
}

export interface RegisterEntryRequest {
  businessDate: string
  partySize: number
}

export interface FulfillmentQueueView {
  fulfillmentId: string
  orderId: string
  displayNumber: number
  status: FulfillmentStatus
  /** Required projection fields remain nullable for legacy orders. */
  sourceType: 'KIOSK' | 'EMPLOYEE_POS' | null
  sourceDeviceNameSnapshot: string | null
  /** Queue optimistic-lock counter (Java `long`). */
  version: Int64String
}

const QUEUE_INT64 = { fields: ['version'] } as const

export function createQueueIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function registerEntry(request: RegisterEntryRequest, key: string) {
  return apiRequestExact<EntryQueueView>(
    '/queues/entry',
    { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(request) },
    QUEUE_INT64,
  )
}

export function getEntries(businessDate: string) {
  return apiRequestExact<EntryQueueView[]>(
    `/queues/entry?${new URLSearchParams({ businessDate }).toString()}`,
    {},
    QUEUE_INT64,
  )
}

export function transitionEntry(entryId: string, action: 'enter' | 'cancel' | 'no-show') {
  return apiRequestExact<EntryQueueView>(
    `/queues/entry/${encodeURIComponent(entryId)}/${action}`,
    { method: 'POST' },
    QUEUE_INT64,
  )
}

export function getFulfillments() {
  return apiRequestExact<FulfillmentQueueView[]>('/queues/fulfillment', {}, QUEUE_INT64)
}

export function markFulfillmentReady(fulfillmentId: string) {
  return apiRequestExact<FulfillmentQueueView>(
    `/queues/fulfillment/${encodeURIComponent(fulfillmentId)}/ready`,
    { method: 'POST' },
    QUEUE_INT64,
  )
}
