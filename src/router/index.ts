import { createRouter, createWebHistory } from 'vue-router'
import CatalogOperationsView from '../views/CatalogOperationsView.vue'
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
      // 사이트맵 CATALOG-001: 전체 직원이 접근하고 관리 기능만 Role로 제한한다.
      path: '/pos/catalog',
      name: 'catalog-operations',
      component: CatalogOperationsView,
    },
    {
      path: '/qr',
      name: 'qr-landing',
      component: QrLandingView,
    },
  ],
})

export default router
