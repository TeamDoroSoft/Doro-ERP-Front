import { apiRequest } from './http'

export type EntryStatus = 'WAITING' | 'ENTERED' | 'CANCELLED' | 'NO_SHOW'
export type FulfillmentStatus = 'PREPARING' | 'READY' | 'CANCELLED'

export interface EntryQueueView {
  entryId: string
  businessDate: string
  queueNumber: number
  partySize: number
  status: EntryStatus
  version: number
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
  version: number
}

export function createQueueIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function registerEntry(request: RegisterEntryRequest, key: string) {
  return apiRequest<EntryQueueView>('/queues/entry', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(request),
  })
}

export function getEntries(businessDate: string) {
  return apiRequest<EntryQueueView[]>(
    `/queues/entry?${new URLSearchParams({ businessDate }).toString()}`,
  )
}

export function transitionEntry(entryId: string, action: 'enter' | 'cancel' | 'no-show') {
  return apiRequest<EntryQueueView>(`/queues/entry/${encodeURIComponent(entryId)}/${action}`, {
    method: 'POST',
  })
}

export function getFulfillments() {
  return apiRequest<FulfillmentQueueView[]>('/queues/fulfillment')
}

export function markFulfillmentReady(fulfillmentId: string) {
  return apiRequest<FulfillmentQueueView>(
    `/queues/fulfillment/${encodeURIComponent(fulfillmentId)}/ready`,
    { method: 'POST' },
  )
}
