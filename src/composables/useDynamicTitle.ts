import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserAuth } from './useUserAuth'

/**
 * 动态标题 Composable
 * 根据用户身份和当前路由动态设置页面标题
 */
export function useDynamicTitle() {
  const route = useRoute()
  const { isAdmin } = useUserAuth()

  // 计算动态标题
  const dynamicTitle = computed(() => {
    return isAdmin.value ? '爆剧坊' : '内部运营看板'
  })

  // 计算动态副标题
  const dynamicSubtitle = computed(() => {
    return isAdmin.value ? '数据驱动，精准运营' : '数据驱动，智能分析'
  })

  // 计算页面标题（包含路由信息）
  const pageTitle = computed(() => {
    const baseTitle = dynamicTitle.value
    const routeName = route.name as string

    if (routeName === 'Dashboard') {
      return baseTitle
    }

    // 可以根据不同路由添加不同的后缀
    const routeTitleMap: Record<string, string> = {
      Settings: '设置',
      DataAnalysis: '数据分析',
      UserManagement: '用户管理',
    }

    const routeTitle = routeTitleMap[routeName]
    return routeTitle ? `${routeTitle} - ${baseTitle}` : baseTitle
  })

  // 监听标题变化，动态更新 HTML 文档标题
  watch(
    pageTitle,
    newTitle => {
      document.title = newTitle
    },
    { immediate: true }
  )

  return {
    dynamicTitle,
    dynamicSubtitle,
    pageTitle,
  }
}
