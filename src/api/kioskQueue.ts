import { apiRequestExact } from './http'
import type { EntryQueueView } from './queue'

export interface RegisterKioskEntryQueueRequest {
  partySize: number
}

export const registerKioskEntryQueue = (
  body: RegisterKioskEntryQueueRequest,
  idempotencyKey: string,
) =>
  apiRequestExact<EntryQueueView>(
    '/kiosk/entry-queues',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    },
    { fields: ['version'] },
    { handleUnauthorized: 'kiosk' },
  )
