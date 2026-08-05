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
    {
      path: '/management/store-settings/profile',
      name: 'store-settings-profile',
      component: () => import('../views/management/StoreProfileView.vue'),
    },
    {
      path: '/management/store-settings/schedule',
      name: 'store-settings-schedule',
      component: () => import('../views/management/StoreScheduleView.vue'),
    },
    {
      path: '/management/store-settings/features',
      name: 'store-settings-features',
      component: () => import('../views/management/StoreFeatureSettingsView.vue'),
    },
  ],
})

export default router
