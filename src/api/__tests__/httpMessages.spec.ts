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

  it.each([
    ['KIOSK_PAYMENT_HANDOFF_ACTIVE', '재배정하거나 취소'],
    ['KIOSK_PAYMENT_PAIR_INVALID', '결제 Kiosk'],
    ['PUBLIC_CHECKOUT_UNAVAILABLE', '결제 링크'],
    ['IDEMPOTENCY_REQUEST_IN_PROGRESS', '처리하고 있습니다'],
    ['TABLE_CONCURRENT_MODIFICATION', '최신 상태'],
  ])('maps %s to safe workflow guidance', (code, expected) => {
    const message = safeApiErrorMessage(
      new ApiError(409, { code, detail: 'upstream implementation detail' }),
    )
    expect(message).toContain(expected)
    expect(message).not.toContain('upstream implementation detail')
  })
})

describe('Catalog Product messages', () => {
  it('explains duplicate Product names without exposing raw detail', () => {
    const error = new ApiError(409, {
      code: 'PRODUCT_NAME_DUPLICATED',
      detail: 'duplicate key tenant_product_name',
    })

    expect(safeApiErrorMessage(error)).toContain('같은 이름의 상품')
    expect(safeApiErrorMessage(error)).not.toContain('duplicate key')
  })

  it.each([
    [412, '최신 목록'],
    [428, '최신 버전'],
  ])('explains an HTTP %s Product precondition failure', (status, expected) => {
    expect(safeApiErrorMessage(new ApiError(status))).toContain(expected)
  })
})
