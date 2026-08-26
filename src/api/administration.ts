import { apiRequest } from './http'
export type Role = 'OWNER' | 'MANAGER' | 'STAFF'
export type ActiveStatus = 'ACTIVE' | 'INACTIVE'
export interface StoreView {
  id: string
  tenantId: string
  name: string
  timezone: string
  currency: string
  status: ActiveStatus
}
export interface EmployeeView {
  id: string
  loginId: string
  role: Role
  status: ActiveStatus
  passwordChangeRequired: boolean
  createdAt: string
}
export interface EmployeeIdentityView {
  employeeId: string
  role: Role
  status: ActiveStatus
  passwordChangeRequired: boolean
}
export interface KioskCredentialView {
  kioskDeviceId: string
  credential: string
}
export type KioskDeviceStatus = 'ACTIVE' | 'REVOKED'
export interface KioskDeviceView {
  id: string
  deviceCode: string
  status: KioskDeviceStatus
  credentialVersion: number
  createdAt: string
  updatedAt: string
}
export interface SecurityEntry {
  id: string
  eventType: string
  actorEmployeeId: string | null
  targetType: string
  targetId: string
  result: string
  reasonCode: string | null
  previousValue: string | null
  newValue: string | null
  occurredAt: string
}
export interface SecurityPage {
  items: SecurityEntry[]
  nextCursorOccurredAt: string | null
  nextCursorId: string | null
  hasMore: boolean
}
export const reauthenticate = (password: string) =>
  apiRequest<void>('/auth/reauthenticate', { method: 'POST', body: JSON.stringify({ password }) })
export const getStore = () => apiRequest<StoreView>('/store')
export const updateStore = (name: string, timezone: string) =>
  apiRequest<StoreView>('/store', { method: 'PATCH', body: JSON.stringify({ name, timezone }) })
export const changeStoreStatus = (status: ActiveStatus) =>
  apiRequest<StoreView>('/store/status', { method: 'PATCH', body: JSON.stringify({ status }) })
export const getEmployees = () => apiRequest<EmployeeView[]>('/employees')
export const getEmployee = (id: string) =>
  apiRequest<EmployeeView>(`/employees/${encodeURIComponent(id)}`)
export const createEmployee = (
  body: { loginId: string; temporaryPassword: string; role: Role },
  key: string,
) =>
  apiRequest<EmployeeView>('/employees', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(body),
  })
export const changeEmployeeRole = (id: string, role: Role) =>
  apiRequest<EmployeeView>(`/employees/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
export const changeEmployeeStatus = (id: string, status: ActiveStatus) =>
  apiRequest<EmployeeView>(`/employees/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
export const resetEmployeePassword = (id: string, newTemporaryPassword: string, key: string) =>
  apiRequest<EmployeeIdentityView>(`/employees/${encodeURIComponent(id)}/password-reset`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ newTemporaryPassword }),
  })
export const registerKiosk = (deviceCode: string) =>
  apiRequest<KioskCredentialView>('/kiosk-devices', {
    method: 'POST',
    body: JSON.stringify({ deviceCode }),
  })
export const getKiosks = () => apiRequest<KioskDeviceView[]>('/kiosk-devices')
export const rotateKiosk = (id: string) =>
  apiRequest<KioskCredentialView>(`/kiosk-devices/${encodeURIComponent(id)}/rotate`, {
    method: 'POST',
  })
export const revokeKiosk = (id: string) =>
  apiRequest<void>(`/kiosk-devices/${encodeURIComponent(id)}/revoke`, { method: 'POST' })
export function getSecurityHistory(query: {
  from: string
  to: string
  eventType?: string
  targetType?: string
  targetId?: string
  result?: string
  cursorOccurredAt?: string
  cursorId?: string
  size?: number
}) {
  const q = new URLSearchParams({ from: query.from, to: query.to })
  for (const key of [
    'eventType',
    'targetType',
    'targetId',
    'result',
    'cursorOccurredAt',
    'cursorId',
  ] as const)
    if (query[key]) q.set(key, query[key])
  if (query.size) q.set('size', String(query.size))
  return apiRequest<SecurityPage>(`/security-history?${q}`)
}
