const labels: Record<string, string> = {
  CREATED: '결제 대기', ACCEPTED: '주문 확정', COMPLETED: '주문 완료', CANCELLED: '취소',
  DINE_IN: '매장 이용', TAKEOUT: '포장', KIOSK: '키오스크',
  PENDING: '결제 대기', PAID: '결제 완료', FAILED: '결제 실패', REVIEW_REQUIRED: '결제 확인 필요',
  PREPARING: '조리 중', READY: '준비 완료', WAITING: '입장 대기', ENTERED: '입장 완료', NO_SHOW: '미방문',
  OWNER: '점주', MANAGER: '매니저', STAFF: '직원', ACTIVE: '운영 중', INACTIVE: '이용 중지',
  SOLD_OUT: '품절', TOSS: '토스페이먼츠', EMPLOYEE: '직원', KIOSK_DEVICE: '키오스크 기기', SYSTEM: '시스템',
  ORDER: '주문', PAYMENT: '결제', TABLE: '테이블', STORE: '매장',
  ORDER_CREATED: '주문 등록', ORDER_ACCEPTED: '주문 확정', ORDER_COMPLETED: '주문 완료', ORDER_CANCELLED: '주문 취소',
  EMPLOYEE_CREATED: '직원 등록', ROLE_CHANGED: '권한 변경', PASSWORD_RESET: '비밀번호 재설정',
  EMPLOYEE_LOGIN_FAILED: '로그인 실패', EMPLOYEE_ACCOUNT_LOCKED: '직원 계정 잠김',
  EMPLOYEE_REAUTHENTICATION_FAILED: '재인증 실패', EMPLOYEE_SESSION_INVALIDATED: '직원 세션 종료',
  EMPLOYEE_ROLE_CHANGED: '직원 권한 변경', EMPLOYEE_STATUS_CHANGED: '직원 상태 변경',
  EMPLOYEE_PASSWORD_CHANGED: '비밀번호 변경', EMPLOYEE_PASSWORD_RESET: '비밀번호 재설정',
  KIOSK_DEVICE_REGISTERED: '키오스크 기기 등록', KIOSK_CREDENTIAL_ROTATED: '키오스크 인증정보 교체',
  KIOSK_DEVICE_REVOKED: '키오스크 기기 해제',
  LOGIN_SUCCEEDED: '로그인 성공', LOGIN_FAILED: '로그인 실패', LOGOUT: '로그아웃',
  SUCCESS: '성공', FAILURE: '실패', CUSTOMER_REQUEST: '고객 요청', ACCESS_DENIED: '권한 없음',
}

export function displayLabel(value: string): string {
  return labels[value] ?? value
}
