import type { EmployeeRole } from '@/stores/operatorSession'

export interface AdminNavigationItem {
  label: string
  to: string
  icon: 'dashboard' | 'orders' | 'tables' | 'queue' | 'catalog' | 'payment' | 'sales' | 'audit' | 'staff' | 'settings'
  roles: EmployeeRole[]
  ready: boolean
}

const allEmployees: EmployeeRole[] = ['OWNER', 'MANAGER', 'STAFF']
const managers: EmployeeRole[] = ['OWNER', 'MANAGER']

export const adminNavigation: AdminNavigationItem[] = [
  { label: '대시보드', to: '/admin/dashboard', icon: 'dashboard', roles: allEmployees, ready: true },
  { label: '주문 관리', to: '/admin/orders', icon: 'orders', roles: allEmployees, ready: true },
  { label: '테이블', to: '/admin/tables', icon: 'tables', roles: allEmployees, ready: true },
  { label: '대기·조리', to: '/admin/queue', icon: 'queue', roles: allEmployees, ready: true },
  { label: '상품·메뉴', to: '/admin/catalog', icon: 'catalog', roles: allEmployees, ready: true },
  { label: '결제 관리', to: '/admin/payments', icon: 'payment', roles: allEmployees, ready: true },
  { label: '매출·마감', to: '/admin/sales', icon: 'sales', roles: allEmployees, ready: true },
  { label: '감사 이력', to: '/admin/audit', icon: 'audit', roles: managers, ready: true },
  { label: '직원 관리', to: '/admin/staff', icon: 'staff', roles: managers, ready: true },
  { label: '매장 설정', to: '/admin/store', icon: 'settings', roles: managers, ready: true },
]

export function navigationForRole(role: EmployeeRole | null) {
  if (role === null) return adminNavigation.filter((item) => item.roles.includes('STAFF'))
  return adminNavigation.filter((item) => item.roles.includes(role))
}
