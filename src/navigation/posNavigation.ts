import type { EmployeeRole } from '@/stores/operatorSession'

export interface PosNavigationItem {
  label: string
  to: string
  icon: 'orders' | 'tables' | 'queue' | 'catalog' | 'sales' | 'audit' | 'settings'
  roles: EmployeeRole[]
  ready: boolean
}

const allEmployees: EmployeeRole[] = ['OWNER', 'MANAGER', 'STAFF']
const managersOnly: EmployeeRole[] = ['OWNER', 'MANAGER']

export const posNavigation: PosNavigationItem[] = [
  { label: '주문 관리', to: '/pos/orders', icon: 'orders', roles: allEmployees, ready: true },
  { label: '대기·조리', to: '/pos/queues/entry', icon: 'queue', roles: allEmployees, ready: true },
  { label: '상품·메뉴', to: '/pos/catalog', icon: 'catalog', roles: allEmployees, ready: false },
  { label: '테이블', to: '/pos/tables', icon: 'tables', roles: managersOnly, ready: true },
  { label: '매출·마감', to: '/pos/sales', icon: 'sales', roles: allEmployees, ready: false },
  { label: '매장·직원 설정', to: '/pos/settings', icon: 'settings', roles: managersOnly, ready: false },
  { label: '감사·보안 이력', to: '/pos/history', icon: 'audit', roles: managersOnly, ready: true },
]

export function navigationForRole(role: EmployeeRole | null): PosNavigationItem[] {
  if (role === null) {
    return posNavigation.filter((item) => item.roles.includes('STAFF'))
  }
  return posNavigation.filter((item) => item.roles.includes(role))
}
