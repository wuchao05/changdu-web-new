import { ref, computed, watch, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

export function useAutoRefresh(refreshCallback: () => void) {
  const settingsStore = useSettingsStore()
  const timer = ref<ReturnType<typeof setInterval> | null>(null)
  const isRunning = ref(false)

  // 计算自动刷新是否启用
  const autoRefreshEnabled = computed(() => settingsStore.settings.autoRefresh)
  const refreshInterval = computed(() => settingsStore.settings.refreshInterval * 1000) // 转换为毫秒

  // 启动自动刷新
  function startAutoRefresh() {
    if (!autoRefreshEnabled.value || isRunning.value) return

    isRunning.value = true

    // 设置定时器
    timer.value = setInterval(() => {
      refreshCallback()
    }, refreshInterval.value)

    // 自动刷新已启动
  }

  // 停止自动刷新
  function stopAutoRefresh() {
    if (timer.value) {
      clearInterval(timer.value)
      timer.value = null
    }
    isRunning.value = false

    // 自动刷新已停止
  }

  // 重启自动刷新（设置变更时）
  function restartAutoRefresh() {
    stopAutoRefresh()
    if (autoRefreshEnabled.value) {
      startAutoRefresh()
    }
  }

  // 手动刷新（重置定时器）
  function manualRefresh() {
    refreshCallback()
    if (isRunning.value) {
      // 重置定时器
      restartAutoRefresh()
    }
  }

  // 监听设置变化
  watch(
    () => [autoRefreshEnabled.value, refreshInterval.value],
    ([enabled]) => {
      if (enabled) {
        restartAutoRefresh()
      } else {
        stopAutoRefresh()
      }
    },
    { immediate: true }
  )

  // 组件卸载时清理
  onUnmounted(() => {
    stopAutoRefresh()
  })

  return {
    isRunning: computed(() => isRunning.value),
    startAutoRefresh,
    stopAutoRefresh,
    restartAutoRefresh,
    manualRefresh,
  }
}
