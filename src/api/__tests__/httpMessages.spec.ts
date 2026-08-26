import { describe, expect, it } from 'vitest'
import { ApiError, safeApiErrorMessage } from '@/api/http'

describe('safeApiErrorMessage', () => {
  it('uses allowlisted problem codes without exposing backend detail', () => {
    const error = new ApiError(503, { code: 'STORE_ACCESS_UNAVAILABLE', detail: 'internal host secret' })
    expect(safeApiErrorMessage(error)).toContain('직원·권한 관리 기능')
    expect(safeApiErrorMessage(error)).not.toContain('internal host secret')
  })

  it.each(['AUTHENTICATION_REQUIRED', 'UNAUTHENTICATED'])('%s falls back to the login-expired 401 guidance', (code) => {
    expect(safeApiErrorMessage(new ApiError(401, { code }))).toContain('다시 로그인')
  })

  it('uses neutral credentials wording for shared authentication failures', () => {
    const message = safeApiErrorMessage(new ApiError(401, { code: 'AUTHENTICATION_FAILED' }))
    expect(message).toContain('아이디 또는 비밀번호')
    expect(message).not.toContain('현재 비밀번호')
  })
})
