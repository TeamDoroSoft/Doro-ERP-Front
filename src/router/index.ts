import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import PosLayout from '@/layouts/PosLayout.vue'
import TableManagementView from '@/views/TableManagementView.vue'
import PaymentResultView from '@/views/PaymentResultView.vue'
import LoginView from '@/views/LoginView.vue'
import ChangePasswordView from '@/views/ChangePasswordView.vue'
import HistoryView from '@/views/HistoryView.vue'
import PosOrdersView from '@/views/PosOrdersView.vue'
import PosOrderCreateView from '@/views/PosOrderCreateView.vue'
import PosOrderDetailView from '@/views/PosOrderDetailView.vue'
import CatalogManagementView from '@/views/CatalogManagementView.vue'
import EntryQueueView from '@/views/EntryQueueView.vue'
import FulfillmentQueueView from '@/views/FulfillmentQueueView.vue'
import SalesClosingView from '@/views/SalesClosingView.vue'
import StoreSettingsView from '@/views/StoreSettingsView.vue'
import KioskLayout from '@/layouts/KioskLayout.vue'
import KioskActivationView from '@/views/kiosk/KioskActivationView.vue'
import KioskMenuView from '@/views/kiosk/KioskMenuView.vue'
import KioskCartView from '@/views/kiosk/KioskCartView.vue'
import KioskCheckoutView from '@/views/kiosk/KioskCheckoutView.vue'
import KioskPaymentView from '@/views/kiosk/KioskPaymentView.vue'
import KioskOrderStatusView from '@/views/kiosk/KioskOrderStatusView.vue'
import { useOperatorSessionStore, type EmployeeRole } from '@/stores/operatorSession'
import { useKioskSessionStore } from '@/stores/kioskSession'
import { applyPageMetadata } from '@/router/pageMetadata'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    passwordChangeRoute?: boolean
    roles?: EmployeeRole[]
    kiosk?: boolean
    kioskActivation?: boolean
    title?: string
    description?: string
  }
}

function redirectWithoutLocation(path: string) {
  return () => ({ path, query: {}, hash: '', replace: true })
}

const routes: RouteRecordRaw[] = [
  // 1. Root & Legacy Redirections
  {
    path: '/',
    redirect: redirectWithoutLocation('/pos/orders'),
  },
  {
    path: '/pos',
    redirect: redirectWithoutLocation('/pos/orders'),
  },
  {
    path: '/login',
    redirect: redirectWithoutLocation('/pos/login'),
  },
  {
    path: '/account/change-password',
    redirect: redirectWithoutLocation('/pos/account/change-password'),
  },
  {
    path: '/tables',
    redirect: redirectWithoutLocation('/pos/tables'),
  },
  {
    path: '/payments/test',
    redirect: redirectWithoutLocation('/pos/orders'),
  },
  // Legacy /admin/** Redirections
  {
    path: '/admin',
    redirect: redirectWithoutLocation('/pos/orders'),
  },
  {
    path: '/admin/dashboard',
    redirect: redirectWithoutLocation('/pos/orders'),
  },
  {
    path: '/admin/orders',
    redirect: redirectWithoutLocation('/pos/orders'),
  },
  {
    path: '/admin/tables',
    redirect: redirectWithoutLocation('/pos/tables'),
  },
  {
    path: '/admin/queue',
    redirect: redirectWithoutLocation('/pos/queues/entry'),
  },
  {
    path: '/admin/catalog',
    redirect: redirectWithoutLocation('/pos/catalog'),
  },
  {
    path: '/admin/payments',
    redirect: redirectWithoutLocation('/pos/orders'),
  },
  {
    path: '/admin/sales',
    redirect: redirectWithoutLocation('/pos/sales'),
  },
  {
    path: '/admin/staff',
    redirect: redirectWithoutLocation('/pos/settings'),
  },
  {
    path: '/admin/store',
    redirect: redirectWithoutLocation('/pos/settings'),
  },
  {
    path: '/admin/audit',
    redirect: redirectWithoutLocation('/pos/history'),
  },

  // 2. POS Authentication Routes
  {
    path: '/pos/login',
    name: 'pos-login',
    component: LoginView,
    meta: {
      guestOnly: true,
      title: 'POS 로그인',
      description: 'Doro ERP 매장 직원 계정으로 POS에 로그인합니다.',
    },
  },
  {
    path: '/pos/account/change-password',
    name: 'pos-change-password',
    component: ChangePasswordView,
    meta: {
      requiresAuth: true,
      passwordChangeRoute: true,
      title: '비밀번호 변경',
      description: 'Doro ERP POS 직원 계정의 비밀번호를 안전하게 변경합니다.',
    },
  },

  // 3. POS Main Routes (PosLayout)
  {
    path: '/pos',
    component: PosLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'orders',
        name: 'pos-orders',
        component: PosOrdersView,
        meta: {
          roles: ['OWNER', 'MANAGER', 'STAFF'],
          title: '주문 관리',
          description: '매장의 주문 목록과 진행 상태를 확인하고 관리합니다.',
        },
      },
      {
        path: 'orders/new',
        name: 'pos-orders-new',
        component: PosOrderCreateView,
        meta: {
          roles: ['OWNER', 'MANAGER', 'STAFF'],
          title: '신규 주문',
          description: '매장 식사 또는 포장 주문을 새로 등록합니다.',
        },
      },
      {
        path: 'orders/:orderId',
        name: 'pos-orders-detail',
        component: PosOrderDetailView,
        meta: {
          roles: ['OWNER', 'MANAGER', 'STAFF'],
          title: '주문 상세',
          description: '주문 품목과 결제 내역을 확인하고 주문 상태를 처리합니다.',
        },
      },
      {
        path: 'queues/entry',
        name: 'pos-queues-entry',
        component: EntryQueueView,
        meta: {
          roles: ['OWNER', 'MANAGER', 'STAFF'],
          title: '입장 대기열',
          description: '고객의 입장 대기 등록과 호출 및 입장 상태를 관리합니다.',
        },
      },
      {
        path: 'queues/fulfillment',
        name: 'pos-queues-fulfillment',
        component: FulfillmentQueueView,
        meta: {
          roles: ['OWNER', 'MANAGER', 'STAFF'],
          title: '조리 대기열',
          description: '조리 중인 주문과 준비 완료된 주문의 픽업 상태를 관리합니다.',
        },
      },
      {
        path: 'catalog',
        name: 'pos-catalog',
        component: CatalogManagementView,
        meta: {
          roles: ['OWNER', 'MANAGER', 'STAFF'],
          title: '메뉴 관리',
          description: '판매 카테고리와 상품, 가격 및 품절 상태를 관리합니다.',
        },
      },
      {
        path: 'tables',
        name: 'pos-tables',
        component: TableManagementView,
        meta: {
          roles: ['OWNER', 'MANAGER'],
          title: '테이블 관리',
          description: '매장에서 사용하는 테이블 정보와 활성 상태를 관리합니다.',
        },
      },
      {
        path: 'sales',
        name: 'pos-sales',
        component: SalesClosingView,
        meta: {
          roles: ['OWNER', 'MANAGER', 'STAFF'],
          title: '매출 및 마감',
          description: '매장의 일별 매출을 조회하고 영업일 마감을 처리합니다.',
        },
      },
      {
        path: 'settings',
        name: 'pos-settings',
        component: StoreSettingsView,
        meta: {
          roles: ['OWNER', 'MANAGER'],
          title: '매장 설정',
          description: '매장 정보와 직원 계정 및 키오스크 기기를 관리합니다.',
        },
      },
      {
        path: 'history',
        name: 'pos-history',
        component: HistoryView,
        meta: {
          roles: ['OWNER', 'MANAGER'],
          title: '운영 이력',
          description: '매장의 감사 로그와 보안 관련 운영 이력을 조회합니다.',
        },
      },
    ],
  },

  // 4. Payment Internal Routes (No Navigation Exposure)
  {
    path: '/payments/toss/success',
    name: 'payment-toss-success',
    component: PaymentResultView,
    meta: {
      requiresAuth: true,
      title: '결제 승인 결과',
      description: '결제 승인 결과를 확인하고 원래 주문 화면으로 돌아갑니다.',
    },
  },
  {
    path: '/payments/toss/fail',
    name: 'payment-toss-fail',
    component: PaymentResultView,
    meta: {
      requiresAuth: true,
      title: '결제 실패',
      description: '결제 실패 사유를 확인하고 원래 주문 화면으로 돌아갑니다.',
    },
  },
  {
    path: '/kiosk',
    component: KioskLayout,
    meta: { kiosk: true },
    children: [
      {
        path: 'activate',
        name: 'kiosk-activate',
        component: KioskActivationView,
        meta: {
          kioskActivation: true,
          title: '키오스크 연결',
          description: 'Doro ERP 고객 주문 키오스크 기기를 매장에 연결합니다.',
        },
      },
      {
        path: '',
        name: 'kiosk-menu',
        component: KioskMenuView,
        meta: {
          title: '메뉴 주문',
          description: '매장에서 판매 중인 메뉴를 살펴보고 주문할 상품을 선택합니다.',
        },
      },
      {
        path: 'cart',
        name: 'kiosk-cart',
        component: KioskCartView,
        meta: {
          title: '장바구니',
          description: '키오스크에서 선택한 메뉴와 수량 및 주문 금액을 확인합니다.',
        },
      },
      {
        path: 'checkout',
        name: 'kiosk-checkout',
        component: KioskCheckoutView,
        meta: {
          title: '주문 확인',
          description: '주문 유형과 테이블 및 결제할 메뉴를 최종 확인합니다.',
        },
      },
      {
        path: 'payments/:paymentId',
        name: 'kiosk-payment',
        component: KioskPaymentView,
        meta: {
          title: '키오스크 결제',
          description: '고객 주문의 결제를 안전하게 진행합니다.',
        },
      },
      {
        path: 'orders/:orderId',
        name: 'kiosk-order',
        component: KioskOrderStatusView,
        meta: {
          title: '주문 상태',
          description: '주문 번호와 결제 및 조리 진행 상태를 확인합니다.',
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: () => ({
      path: '/pos/orders',
      query: { reason: 'not-found' },
      hash: '',
      replace: true,
    }),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to) => applyPageMetadata(to))

router.beforeEach((to) => {
  const session = useOperatorSessionStore()
  const kioskSession = useKioskSessionStore()
  const kioskRoute = to.matched.some((record) => record.meta.kiosk)
  const kioskActivation = to.matched.some((record) => record.meta.kioskActivation)
  if (kioskRoute) {
    if (!kioskSession.canAccessProtected && !kioskActivation) return '/kiosk/activate'
    if (kioskSession.canAccessProtected && kioskActivation) return '/kiosk'
    return true
  }
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const passwordChangeRoute = to.matched.some((record) => record.meta.passwordChangeRoute)

  // 1. Unauthenticated user trying to access protected route
  if (requiresAuth && !session.authenticated) {
    return { path: '/pos/login', query: { redirect: to.path }, replace: true }
  }

  // 2. Authenticated user requiring password change
  if (session.authenticated && session.passwordChangeRequired && !passwordChangeRoute) {
    return '/pos/account/change-password'
  }

  // 3. Authenticated user trying to access guestOnly route (e.g. login)
  if (to.meta.guestOnly && session.authenticated) {
    return session.passwordChangeRequired ? '/pos/account/change-password' : '/pos/orders'
  }

  // 4. Role Authorization Check
  if (session.authenticated && session.role) {
    const matchedWithRoles = to.matched.filter(
      (record) => record.meta.roles && record.meta.roles.length > 0,
    )
    for (const record of matchedWithRoles) {
      if (record.meta.roles && !record.meta.roles.includes(session.role)) {
        return {
          path: '/pos/orders',
          query: { reason: 'forbidden' },
          replace: true,
        }
      }
    }
  }

  return true
})

export default router
