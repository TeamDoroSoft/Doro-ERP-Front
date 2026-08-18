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

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    passwordChangeRoute?: boolean
    roles?: EmployeeRole[]
    kiosk?: boolean
    kioskActivation?: boolean
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
    meta: { guestOnly: true },
  },
  {
    path: '/pos/account/change-password',
    name: 'pos-change-password',
    component: ChangePasswordView,
    meta: { requiresAuth: true, passwordChangeRoute: true },
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
        meta: { roles: ['OWNER', 'MANAGER', 'STAFF'] },
      },
      {
        path: 'orders/new',
        name: 'pos-orders-new',
        component: PosOrderCreateView,
        meta: { roles: ['OWNER', 'MANAGER', 'STAFF'] },
      },
      {
        path: 'orders/:orderId',
        name: 'pos-orders-detail',
        component: PosOrderDetailView,
        meta: { roles: ['OWNER', 'MANAGER', 'STAFF'] },
      },
      {
        path: 'queues/entry',
        name: 'pos-queues-entry',
        component: EntryQueueView,
        meta: { roles: ['OWNER', 'MANAGER', 'STAFF'] },
      },
      {
        path: 'queues/fulfillment',
        name: 'pos-queues-fulfillment',
        component: FulfillmentQueueView,
        meta: { roles: ['OWNER', 'MANAGER', 'STAFF'] },
      },
      {
        path: 'catalog',
        name: 'pos-catalog',
        component: CatalogManagementView,
        meta: { roles: ['OWNER', 'MANAGER', 'STAFF'] },
      },
      {
        path: 'tables',
        name: 'pos-tables',
        component: TableManagementView,
        meta: { roles: ['OWNER', 'MANAGER'] },
      },
      {
        path: 'sales',
        name: 'pos-sales',
        component: SalesClosingView,
        meta: { roles: ['OWNER', 'MANAGER', 'STAFF'] },
      },
      {
        path: 'settings',
        name: 'pos-settings',
        component: StoreSettingsView,
        meta: { roles: ['OWNER', 'MANAGER'] },
      },
      {
        path: 'history',
        name: 'pos-history',
        component: HistoryView,
        meta: { roles: ['OWNER', 'MANAGER'] },
      },
    ],
  },

  // 4. Payment Internal Routes (No Navigation Exposure)
  {
    path: '/payments/toss/success',
    name: 'payment-toss-success',
    component: PaymentResultView,
    meta: { requiresAuth: true },
  },
  {
    path: '/payments/toss/fail',
    name: 'payment-toss-fail',
    component: PaymentResultView,
    meta: { requiresAuth: true },
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
        meta: { kioskActivation: true },
      },
      { path: '', name: 'kiosk-menu', component: KioskMenuView },
      { path: 'cart', name: 'kiosk-cart', component: KioskCartView },
      { path: 'checkout', name: 'kiosk-checkout', component: KioskCheckoutView },
      { path: 'payments/:paymentId', name: 'kiosk-payment', component: KioskPaymentView },
      { path: 'orders/:orderId', name: 'kiosk-order', component: KioskOrderStatusView },
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

router.beforeEach((to) => {
  const session = useOperatorSessionStore()
  const kioskSession = useKioskSessionStore()
  const kioskRoute = to.matched.some((record) => record.meta.kiosk)
  const kioskActivation = to.matched.some((record) => record.meta.kioskActivation)
  if (kioskRoute) {
    if (kioskSession.deviceState !== 'ACTIVE' && !kioskActivation) return '/kiosk/activate'
    if (kioskSession.deviceState === 'ACTIVE' && kioskActivation) return '/kiosk'
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
