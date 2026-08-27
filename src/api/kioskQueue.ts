import { apiRequest } from './http'

export interface RegisterKioskEntryQueueRequest {
  partySize: number
}

/** Queue candidate contract, isolated until the Queue OpenAPI is schema-approved. */
export const registerKioskEntryQueue = (
  body: RegisterKioskEntryQueueRequest,
  idempotencyKey: string,
) =>
  apiRequest<void>(
    '/kiosk/entry-queues',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    },
    { handleUnauthorized: 'kiosk' },
  )
