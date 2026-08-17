import type { EmployeeRole } from '@/stores/operatorSession'

export interface WorkspaceField {
  label: string
  placeholder: string
  type?: 'text' | 'date' | 'select'
  options?: Array<string | { value: string; label: string }>
}

const option = (value: string, label: string) => ({ value, label })

export interface WorkspaceDefinition {
  eyebrow: string
  title: string
  description: string
  tabs?: string[]
  filters: WorkspaceField[]
  columns: string[]
  statuses: Array<{ label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }>
  workflowTitle: string
  workflow: string[]
  emptyTitle: string
  emptyDescription: string
  primaryAction?: {
    label: string
    roles: EmployeeRole[]
    title: string
    description: string
    fields: WorkspaceField[]
  }
  accessRoles: EmployeeRole[]
  contractNote: string
}

const allEmployees: EmployeeRole[] = ['OWNER', 'MANAGER', 'STAFF']
const managers: EmployeeRole[] = ['OWNER', 'MANAGER']

export const workspaceDefinitions = {
  catalog: {
    eyebrow: '상품 운영', title: '상품·메뉴 관리',
    description: '카테고리와 판매 상품의 가격, 노출 순서, 판매·품절 상태를 관리합니다.',
    tabs: ['상품', '카테고리'],
    filters: [
      { label: '카테고리', placeholder: '전체 카테고리', type: 'select', options: ['전체 카테고리'] },
      { label: '판매 상태', placeholder: '전체 상태', type: 'select', options: ['전체', option('ACTIVE', '판매 중'), option('INACTIVE', '판매 중지'), option('SOLD_OUT', '품절')] },
      { label: '상품명', placeholder: '상품명 검색' },
    ],
    columns: ['상품', '카테고리', '가격', '판매 상태', '품절', '표시 순서', '관리'],
    statuses: [{ label: '판매 중', tone: 'success' }, { label: '품절', tone: 'warning' }, { label: '비활성', tone: 'neutral' }],
    workflowTitle: '상품 운영 순서',
    workflow: ['카테고리 정렬', '상품 정보·가격', '판매 상태', '품절 즉시 반영'],
    emptyTitle: '등록된 상품이 없습니다',
    emptyDescription: '카테고리를 만든 뒤 첫 상품을 등록해 보세요.',
    primaryAction: {
      label: '메뉴 등록', roles: managers, title: '새 상품 등록',
      description: '가격과 판매 상태를 확인한 뒤 상품을 등록하세요.',
      fields: [
        { label: '카테고리', placeholder: '카테고리 선택', type: 'select', options: ['카테고리 연결 대기'] },
        { label: '상품명', placeholder: '상품명' }, { label: '설명', placeholder: '상품 설명' },
        { label: '가격', placeholder: 'KRW' }, { label: '표시 순서', placeholder: '0' },
      ],
    },
    accessRoles: allEmployees,
    contractNote: '직원은 품절 상태만 변경할 수 있으며, 상품 정보와 가격은 관리자만 수정할 수 있습니다.',
  },
  queue: {
    eyebrow: '대기·조리 운영', title: '대기·조리',
    description: '입장 대기와 주문별 조리 진행 상태를 확인합니다.',
    tabs: ['입장 대기', '조리 현황'],
    filters: [{ label: '영업일', placeholder: '영업일 선택', type: 'date' }, { label: '처리 상태', placeholder: '전체 상태', type: 'select', options: ['전체', option('WAITING', '대기 중'), option('ENTERED', '입장 완료'), option('NO_SHOW', '미방문'), option('CANCELLED', '취소'), option('PREPARING', '조리 중'), option('READY', '준비 완료')] }],
    columns: ['대기/표시 번호', '구분', '인원·주문', '현재 상태', '등록 시각', '처리'],
    statuses: [{ label: '대기', tone: 'warning' }, { label: '입장/준비 완료', tone: 'success' }, { label: '취소·미방문', tone: 'danger' }],
    workflowTitle: '책임이 분리된 두 흐름',
    workflow: ['입장 대기', '입장 / 미방문', '조리 중', '준비 완료'],
    emptyTitle: '현재 처리할 대기 항목이 없습니다',
    emptyDescription: '현재 입장 대기나 조리 중인 주문이 없습니다.',
    primaryAction: {
      label: '입장 대기 등록', roles: allEmployees, title: '입장 대기 등록',
      description: '영업일과 대기 인원을 확인해 등록하세요.',
      fields: [{ label: '영업일', placeholder: '영업일 선택', type: 'date' }, { label: '인원', placeholder: '1~100명' }],
    },
    accessRoles: allEmployees,
    contractNote: '입장·취소·미방문을 처리하고, 조리가 끝난 주문은 준비 완료로 변경할 수 있습니다.',
  },
  payments: {
    eyebrow: '결제 운영', title: '결제 관리',
    description: '주문과 연결된 결제의 승인·실패·검토·취소 상태를 안전하게 확인합니다.',
    filters: [{ label: '결제 ID', placeholder: '결제 ID 입력' }],
    columns: ['결제 ID', '주문 ID', '금액', '결제 상태', '결제사', '처리 시각', '상세'],
    statuses: [{ label: '결제 대기', tone: 'warning' }, { label: '결제 완료', tone: 'success' }, { label: '결제 실패', tone: 'danger' }, { label: '결제 확인 필요', tone: 'warning' }, { label: '결제 취소', tone: 'neutral' }],
    workflowTitle: '결제 처리 흐름', workflow: ['승인 대기', '승인 완료', '결제 완료', '결제 취소'],
    emptyTitle: '결제 ID를 입력해 주세요',
    emptyDescription: '결제 ID를 입력하면 결제 상태를 확인할 수 있습니다.',
    accessRoles: allEmployees,
    contractNote: '확인 필요 상태의 결제는 완료로 처리하지 말고 결제 내역을 확인하세요.',
  },
  sales: {
    eyebrow: '매출 운영', title: '매출·마감',
    description: '영업일별 승인·취소 금액과 완료 주문을 확인하고 마감 상태를 관리합니다.',
    filters: [{ label: '영업일', placeholder: '영업일 선택', type: 'date' }],
    columns: ['구분', '승인 금액', '취소 금액', '순매출', '완료 주문', '취소 주문', '마감 상태'],
    statuses: [{ label: '영업 중', tone: 'success' }, { label: '마감 완료', tone: 'neutral' }],
    workflowTitle: '일일 마감 순서', workflow: ['결제 내역 반영', '미처리 내역 확인', '영업일 마감', '마감 완료'],
    emptyTitle: '매출 내역을 준비하고 있습니다',
    emptyDescription: '연동 후 승인·취소 금액과 주문 수를 확인할 수 있습니다.',
    primaryAction: {
      label: '마감 조건 확인', roles: managers, title: '영업일 마감',
      description: '마감할 영업일과 미처리 내역을 확인하세요. 마감은 한 번만 할 수 있습니다.',
      fields: [{ label: '영업일', placeholder: '마감할 영업일', type: 'date' }],
    },
    accessRoles: allEmployees,
    contractNote: '매출과 주문 수는 연동된 집계 결과를 기준으로 표시합니다.',
  },
  staff: {
    eyebrow: '직원·권한', title: '직원 관리',
    description: '직원 계정의 역할과 사용 상태를 관리합니다.',
    filters: [{ label: '권한', placeholder: '전체 권한', type: 'select', options: ['전체', option('OWNER', '최고 관리자'), option('MANAGER', '관리자'), option('STAFF', '직원')] }, { label: '상태', placeholder: '전체 상태', type: 'select', options: ['전체', option('ACTIVE', '사용 중'), option('INACTIVE', '사용 중지')] }, { label: '로그인 ID', placeholder: '로그인 ID 검색' }],
    columns: ['로그인 ID', '역할', '상태', '비밀번호 변경 필요', '생성일', '관리'],
    statuses: [{ label: '사용 중', tone: 'success' }, { label: '사용 중지', tone: 'neutral' }, { label: '비밀번호 변경 필요', tone: 'warning' }],
    workflowTitle: '계정 보안 운영', workflow: ['임시 비밀번호 발급', '최초 로그인', '비밀번호 변경', '역할·상태 관리'],
    emptyTitle: '등록된 직원이 없습니다',
    emptyDescription: '직원을 등록하면 이곳에서 계정과 권한을 관리할 수 있습니다.',
    primaryAction: {
      label: '직원 생성', roles: managers, title: '직원 계정 생성',
      description: '직원 역할과 임시 비밀번호를 확인해 계정을 등록하세요.',
      fields: [{ label: '로그인 ID', placeholder: '직원 로그인 ID' }, { label: '권한', placeholder: '권한 선택', type: 'select', options: [option('STAFF', '직원'), option('MANAGER', '관리자'), option('OWNER', '최고 관리자')] }, { label: '임시 비밀번호', placeholder: '안전한 임시 비밀번호' }],
    },
    accessRoles: managers,
    contractNote: '관리자는 일반 직원만 관리할 수 있으며, 마지막 소유자 계정은 비활성화할 수 없습니다.',
  },
  store: {
    eyebrow: '매장 운영', title: '매장 설정',
    description: '현재 매장의 이름과 시간대 등 직원에게 허용된 운영 설정을 확인합니다.',
    filters: [],
    columns: ['매장 이름', '시간대', '통화', '상태', '매장 ID'],
    statuses: [{ label: '운영 중', tone: 'success' }, { label: '운영 중지', tone: 'danger' }],
    workflowTitle: '설정 변경 순서', workflow: ['매장 정보 확인', '이름·시간대 확인', '설정 변경', '변경 이력 저장'],
    emptyTitle: '매장 정보를 준비하고 있습니다',
    emptyDescription: '연동 후 현재 매장의 정보를 확인할 수 있습니다.',
    primaryAction: {
      label: '기본 정보 수정', roles: managers, title: '매장 기본 정보',
      description: '매장 이름과 시간대를 확인한 뒤 변경하세요.',
      fields: [{ label: '매장 이름', placeholder: '매장 이름' }, { label: '시간대', placeholder: '예: Asia/Seoul' }],
    },
    accessRoles: managers,
    contractNote: '매장 이름과 시간대를 변경할 수 있으며 통화 정보는 조회만 가능합니다.',
  },
} satisfies Record<string, WorkspaceDefinition>
