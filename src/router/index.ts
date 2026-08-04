import { createRouter, createWebHistory } from 'vue-router'
import QrLandingView from '../views/QrLandingView.vue'
import TableOperationsView from '../views/TableOperationsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/tables',
    },
    {
      path: '/tables',
      name: 'table-operations',
      component: TableOperationsView,
    },
    {
      path: '/qr',
      name: 'qr-landing',
      component: QrLandingView,
    },
  ],
})

export default router
