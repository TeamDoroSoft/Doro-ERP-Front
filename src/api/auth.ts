import { apiRequest } from './http'
import type { EmployeeView } from './administration'
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

/**
 * `PATCH /employees/me/password` answers `200 EmployeeResponse`, the same wire shape the
 * employee administration screens already use. Callers may ignore the value, but the
 * declared type must not claim the response is empty.
 */
export type ChangeOwnPasswordResponse = EmployeeView

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

/**
 * Edge answers `401 CURRENT_PASSWORD_INCORRECT` when the submitted current password is wrong,
 * which is a form error rather than an expired session. The shared 401 boundary would clear the
 * session and bounce to the login screen, so this call opts out and `ChangePasswordView`
 * distinguishes `CURRENT_PASSWORD_INCORRECT` from `UNAUTHENTICATED` /
 * `SESSION_ABSOLUTE_EXPIRED` itself.
 */
export function changeOwnPassword(
  request: ChangeOwnPasswordRequest,
): Promise<ChangeOwnPasswordResponse> {
  return apiRequest<ChangeOwnPasswordResponse>(
    '/employees/me/password',
    { method: 'PATCH', body: JSON.stringify(request) },
    { handleUnauthorized: false },
  )
}
