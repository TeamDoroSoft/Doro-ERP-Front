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
