import { apiRequestExact } from './http'
import type { Int64String } from './int64'

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
  /**
   * Audit `metadata`는 Service의 `Map<String, Object>`이며 값 타입이 계약으로 고정되어 있지 않다.
   * 실제로 `totalAmount`·`amount`·`version` 같은 Java `long`이 들어오므로 JSON 정수 리터럴은
   * 모두 정확한 10진 문자열로 보존한다. 문자열·Boolean·`null`·소수는 원본 타입 그대로다.
   */
  metadata: Record<string, Int64String | string | number | boolean | null>
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
  return apiRequestExact<AuditPage>(`/audits?${query.toString()}`, {}, AUDIT_INT64)
}

export function getAudit(id: string): Promise<AuditRecord> {
  return apiRequestExact<AuditRecord>(`/audits/${encodeURIComponent(id)}`, {}, AUDIT_INT64)
}

const AUDIT_INT64 = { maps: ['metadata'] } as const
