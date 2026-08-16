import { apiRequest } from './http'

export interface AuditActor {
  type: 'EMPLOYEE' | 'KIOSK_DEVICE' | 'SYSTEM'
  id: string
  role: 'OWNER' | 'MANAGER' | 'STAFF' | null
}

export interface AuditTarget {
  type: string
  id: string
}

export interface AuditRecord {
  id: string
  sourceService: 'store-access' | 'commerce' | 'payment' | 'queue'
  eventId: string
  action: string
  actor: AuditActor
  target: AuditTarget
  result: 'SUCCESS' | 'FAILURE'
  reasonCode: string | null
  metadata: Record<string, string | number | boolean | null>
  traceId: string
  occurredAt: string
}

export interface AuditPage {
  items: AuditRecord[]
  nextCursor: string | null
}

export interface AuditListParams {
  from: string
  to: string
  action?: string
  targetType?: string
  targetId?: string
  size?: number
  cursor?: string
}

export function getAudits(params: AuditListParams): Promise<AuditPage> {
  const query = new URLSearchParams({ from: params.from, to: params.to })
  if (params.action) query.set('action', params.action)
  if (params.targetType) query.set('targetType', params.targetType)
  if (params.targetId) query.set('targetId', params.targetId)
  if (params.size !== undefined) query.set('size', String(params.size))
  if (params.cursor) query.set('cursor', params.cursor)
  return apiRequest<AuditPage>(`/audits?${query.toString()}`)
}

export function getAudit(id: string): Promise<AuditRecord> {
  return apiRequest<AuditRecord>(`/audits/${encodeURIComponent(id)}`)
}
