import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import { useSessionStore } from '@/stores/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/Settings.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/clip',
      name: 'clip',
      component: () => import('../components/NewDramaPreview.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/new-drama-preview',
      redirect: '/clip',
    },
  ],
})

router.beforeEach(async to => {
  const sessionStore = useSessionStore()

  if (!sessionStore.initialized) {
    await sessionStore.loadSession()
  }

  if (to.meta.requiresAuth && !sessionStore.isAuthenticated) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.guestOnly && sessionStore.isAuthenticated) {
    return sessionStore.isAdmin ? '/admin' : '/'
  }

  if (to.meta.requiresAdmin && !sessionStore.isAdmin) {
    return '/'
  }

  return true
})

export default router
