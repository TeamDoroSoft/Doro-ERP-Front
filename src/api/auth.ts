import { apiRequest } from './http'
import type { EmployeeRole } from '@/stores/operatorSession'

export interface LoginRequest {
  tenantCode: string
  loginId: string
  password: string
}

export interface LoginResponse {
  employeeId: string
  role: EmployeeRole
  passwordChangeRequired: boolean
}

export interface ChangeOwnPasswordRequest {
  currentPassword: string
  newPassword: string
}

export function login(request: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(request) },
    { handleUnauthorized: false },
  )
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' })
}

export function changeOwnPassword(request: ChangeOwnPasswordRequest): Promise<void> {
  return apiRequest<void>('/employees/me/password', {
    method: 'PATCH',
    body: JSON.stringify(request),
  })
}
