import { createRouter, createWebHistory } from 'vue-router'
import TableManagementView from '../views/TableManagementView.vue'
import HomeView from '../views/HomeView.vue'
import PaymentCheckoutView from '../views/PaymentCheckoutView.vue'
import PaymentResultView from '../views/PaymentResultView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/tables',
    },
    {
      path: '/tables',
      name: 'tables',
      component: TableManagementView,
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
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

export default router
