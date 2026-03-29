import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'

export function useUserAuth() {
  const sessionStore = useSessionStore()

  const currentUserId = computed(() => sessionStore.currentUser?.id || '')
  const isAdmin = computed(() => sessionStore.isAdmin)
  const userRole = computed(() => {
    if (!sessionStore.currentUser) return null
    return isAdmin.value ? '管理员' : '普通用户'
  })
  const userRoleTheme = computed(() => (isAdmin.value ? 'blue' : 'green'))
  const userRoleIcon = computed(() =>
    isAdmin.value ? 'mdi:shield-crown' : 'mdi:account-circle-outline'
  )
  const userLabels = computed(() => {
    if (!sessionStore.currentUser) return []
    return [isAdmin.value ? '管理员' : '普通用户']
  })
  const isValidUser = computed(() => sessionStore.isAuthenticated)

  return {
    isAdmin,
    currentUserId,
    userRole,
    userRoleTheme,
    userRoleIcon,
    userLabels,
    isValidUser,
  }
}
