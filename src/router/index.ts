import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/management/catalog/categories',
      name: 'category-management',
      component: () => import('../views/management/CategoryManagementView.vue'),
    },
    {
      path: '/management/catalog/products',
      name: 'product-management',
      component: () => import('../views/management/ProductManagementView.vue'),
    },
    {
      path: '/management/catalog/history',
      name: 'catalog-history',
      component: () => import('../views/management/CatalogHistoryView.vue'),
    },
    {
      path: '/menu',
      name: 'public-menu',
      component: () => import('../views/PublicMenuView.vue'),
    },
  ],
})

export default router
