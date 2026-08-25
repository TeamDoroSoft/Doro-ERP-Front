export const loginIdPattern = /^[a-z0-9](?:[a-z0-9._-]{2,48}[a-z0-9])$/

export function loginIdError(loginId: string): string {
  return loginIdPattern.test(loginId)
    ? ''
    : '로그인 ID는 4~50자의 영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용하고 영문 또는 숫자로 시작하고 끝나야 합니다.'
}

export function temporaryPasswordError(password: string, loginId: string): string {
  if (password.length < 15 || password.length > 128) return '임시 비밀번호는 15~128자로 입력해 주세요.'
  const normalized = password.toLowerCase()
  const forbidden = [loginId.trim().toLowerCase(), 'doro', 'storeaccess', 'doroerp'].filter(Boolean)
  return forbidden.some((value) => normalized.includes(value))
    ? '임시 비밀번호에는 로그인 ID, doro, storeaccess, doroerp를 포함할 수 없습니다.'
    : ''
}
