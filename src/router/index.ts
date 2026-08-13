import { createRouter, createWebHistory } from 'vue-router'
import TableManagementView from '../views/TableManagementView.vue'

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
  ],
})

export default router
