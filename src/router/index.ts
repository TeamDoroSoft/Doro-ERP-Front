import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'
import DashboardView from '../views/DashboardView.vue'
import TableManagementView from '../views/TableManagementView.vue'
import PaymentCheckoutView from '../views/PaymentCheckoutView.vue'
import PaymentResultView from '../views/PaymentResultView.vue'
import LoginView from '../views/LoginView.vue'
import ChangePasswordView from '../views/ChangePasswordView.vue'
import AuditLogView from '../views/AuditLogView.vue'
import OrdersView from '../views/OrdersView.vue'
import CatalogManagementView from '../views/CatalogManagementView.vue'
import QueueOperationsView from '../views/QueueOperationsView.vue'
import PaymentsManagementView from '../views/PaymentsManagementView.vue'
import SalesClosingView from '../views/SalesClosingView.vue'
import StaffManagementView from '../views/StaffManagementView.vue'
import StoreSettingsView from '../views/StoreSettingsView.vue'
import { useOperatorSessionStore } from '@/stores/operatorSession'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guestOnly: true },
    },
    {
      path: '/account/change-password',
      name: 'change-password',
      component: ChangePasswordView,
      meta: { requiresAuth: true, passwordChangeRoute: true },
    },
    {
      path: '/',
      redirect: '/admin/dashboard',
    },
    {
      path: '/tables',
      redirect: '/admin/tables',
    },
    {
      path: '/admin',
      component: AdminLayout,
      redirect: '/admin/dashboard',
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'admin-dashboard', component: DashboardView },
        { path: 'tables', name: 'tables', component: TableManagementView },
        { path: 'audit', name: 'admin-audit', component: AuditLogView },
        { path: 'orders', name: 'admin-orders', component: OrdersView },
        { path: 'catalog', name: 'admin-catalog', component: CatalogManagementView },
        { path: 'queue', name: 'admin-queue', component: QueueOperationsView },
        { path: 'payments', name: 'admin-payments', component: PaymentsManagementView },
        { path: 'sales', name: 'admin-sales', component: SalesClosingView },
        { path: 'staff', name: 'admin-staff', component: StaffManagementView },
        { path: 'store', name: 'admin-store', component: StoreSettingsView },
      ],
    },
    {
      path: '/payments/test',
      name: 'payment-checkout',
      component: PaymentCheckoutView,
    },
    {
      path: '/payments/toss/success',
      name: 'payment-toss-success',
      component: PaymentResultView,
    },
    {
      path: '/payments/toss/fail',
      name: 'payment-toss-fail',
      component: PaymentResultView,
    },
  ],
})

router.beforeEach((to) => {
  const session = useOperatorSessionStore()
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const passwordChangeRoute = to.matched.some((record) => record.meta.passwordChangeRoute)

  if (requiresAuth && !session.authenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (session.authenticated && session.passwordChangeRequired && !passwordChangeRoute) {
    return '/account/change-password'
  }
  if (to.meta.guestOnly && session.authenticated) {
    return session.passwordChangeRequired ? '/account/change-password' : '/admin/dashboard'
  }
  return true
})

export default router
