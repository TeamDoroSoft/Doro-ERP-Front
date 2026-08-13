const labels: Record<string, string> = {
  CREATED: '주문 생성', ACCEPTED: '주문 접수', COMPLETED: '처리 완료', CANCELLED: '취소',
  DINE_IN: '매장 이용', TAKEOUT: '포장', KIOSK: '키오스크',
  PENDING: '결제 대기', PAID: '결제 완료', FAILED: '결제 실패', REVIEW_REQUIRED: '결제 확인 필요',
  PREPARING: '조리 중', READY: '준비 완료', WAITING: '대기 중', ENTERED: '입장 완료', NO_SHOW: '미방문',
  OWNER: '최고 관리자', MANAGER: '관리자', STAFF: '직원', ACTIVE: '운영 중', INACTIVE: '운영 중지',
  SOLD_OUT: '품절', TOSS: '토스페이먼츠', EMPLOYEE: '직원', KIOSK_DEVICE: '키오스크 기기', SYSTEM: '시스템',
  ORDER: '주문', PAYMENT: '결제', TABLE: '테이블', STORE: '매장',
  ORDER_CREATED: '주문 생성', ORDER_ACCEPTED: '주문 접수', ORDER_COMPLETED: '주문 처리 완료', ORDER_CANCELLED: '주문 취소',
  EMPLOYEE_CREATED: '직원 생성', ROLE_CHANGED: '권한 변경', PASSWORD_RESET: '비밀번호 초기화',
}

export function displayLabel(value: string): string {
  return labels[value] ?? value
}
