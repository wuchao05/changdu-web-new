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
      // 飞书看板已嵌入首页 Tab,避免再叠加全局浮动按钮
      meta: { requiresAuth: true, hideFeishuBoard: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/Settings.vue'),
      meta: { requiresAuth: true },
    },
    {
      // 旧入口保留:重定向到首页并定位到爆剧爆剪 Tab
      path: '/clip',
      redirect: '/?tab=clip',
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/logs',
      name: 'admin-logs',
      component: () => import('../views/ServerLogsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, hideFooter: true, hideDebugDrawer: true },
    },
    {
      path: '/admin/schedulers',
      name: 'admin-schedulers',
      component: () => import('../views/SchedulerOverviewView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, hideFooter: true, hideDebugDrawer: true },
    },
    {
      path: '/new-drama-preview',
      redirect: '/?tab=clip',
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
