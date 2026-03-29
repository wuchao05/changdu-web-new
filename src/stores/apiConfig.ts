import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { buildSessionHeaders } from '@/utils/sessionToken'

export interface ApiConfig {
  cookie: string
  userId?: string
  autoDownloadEnabled?: boolean
  autoDownloadIntervalMinutes?: number
  distributorId?: string
  adUserId?: string
  rootAdUserId?: string
  appId?: string
  dramaListTableId?: string
  dramaStatusTableId?: string
  accountTableId?: string
  userType?: 'admin' | 'normal'
  channelId?: string
  channelName?: string
  nickname?: string
}

const STORAGE_KEY = 'studio_runtime_channel_config'
const DEFAULT_DISTRIBUTOR_ID = ''

const DEFAULT_API_CONFIG: ApiConfig = {
  cookie: '',
  userId: '',
  autoDownloadEnabled: false,
  autoDownloadIntervalMinutes: 20,
  distributorId: DEFAULT_DISTRIBUTOR_ID,
  adUserId: '',
  rootAdUserId: '',
  appId: '',
  dramaListTableId: '',
  dramaStatusTableId: '',
  accountTableId: '',
  userType: 'normal',
  channelId: '',
  channelName: '',
  nickname: '',
}

export const useApiConfigStore = defineStore('apiConfig', () => {
  const runtimeConfig = ref<ApiConfig>({ ...DEFAULT_API_CONFIG })
  const config = computed<ApiConfig>(() => runtimeConfig.value)
  const effectiveUserId = computed(() => runtimeConfig.value.userId?.trim() || '')

  function getConfigByAccount(): ApiConfig {
    return runtimeConfig.value
  }

  function updateConfig(newConfig: Partial<ApiConfig>) {
    runtimeConfig.value = { ...runtimeConfig.value, ...newConfig }
    saveToStorage()
  }

  function resetConfig() {
    runtimeConfig.value = {
      ...DEFAULT_API_CONFIG,
      userId: runtimeConfig.value.userId,
    }
    saveToStorage()
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runtimeConfig.value))
    } catch (error) {
      console.warn('保存 API 配置失败:', error)
    }
  }

  function loadLocalConfig() {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY)
      if (!savedConfig) return
      const parsedConfig = JSON.parse(savedConfig) as ApiConfig
      runtimeConfig.value = { ...DEFAULT_API_CONFIG, ...parsedConfig }
    } catch (error) {
      console.warn('加载 API 配置失败:', error)
      runtimeConfig.value = { ...DEFAULT_API_CONFIG }
    }
  }

  async function applyRoleDefaults() {
    try {
      const response = await fetch('/api/session/me', {
        headers: buildSessionHeaders(),
      })
      if (!response.ok) return

      const { data } = await response.json()
      updateFromAuthConfig({
        platforms: data?.platforms,
        feishu: data?.feishu,
        sessionUser: data?.user,
        runtimeUser: data?.runtimeUser,
        activeChannel: data?.channel,
      })
    } catch (error) {
      console.warn('从服务器同步每日鉴权配置失败，将继续使用本地配置', error)
    }
  }

  async function loadFromStorage() {
    loadLocalConfig()
    await applyRoleDefaults()
  }

  function updateFromAuthConfig(authData: {
    platforms?: {
      changdu?: {
        channel?: Partial<ApiConfig>
      }
    }
    feishu?: {
      dramaListTableId?: string
      dramaStatusTableId?: string
      accountTableId?: string
    }
    sessionUser?: {
      id?: string
      userType?: 'admin' | 'normal'
      channelId?: string
      nickname?: string
    }
    runtimeUser?: {
      id?: string
      nickname?: string
    }
    activeChannel?: {
      id?: string
      name?: string
    } | null
  }) {
    try {
      const channelConfig = authData.platforms?.changdu?.channel
      const sessionUser = authData.sessionUser
      const runtimeUser = authData.runtimeUser
      if (!channelConfig && !sessionUser) {
        return
      }

      runtimeConfig.value = {
        ...runtimeConfig.value,
        cookie: channelConfig?.cookie ?? runtimeConfig.value.cookie,
        distributorId: channelConfig?.distributorId || runtimeConfig.value.distributorId,
        adUserId: channelConfig?.adUserId ?? runtimeConfig.value.adUserId,
        rootAdUserId: channelConfig?.rootAdUserId ?? runtimeConfig.value.rootAdUserId,
        appId: channelConfig?.appId ?? runtimeConfig.value.appId,
        dramaListTableId: authData.feishu?.dramaListTableId ?? runtimeConfig.value.dramaListTableId,
        dramaStatusTableId:
          authData.feishu?.dramaStatusTableId ?? runtimeConfig.value.dramaStatusTableId,
        accountTableId: authData.feishu?.accountTableId ?? runtimeConfig.value.accountTableId,
        userId: runtimeUser?.id ?? sessionUser?.id ?? runtimeConfig.value.userId,
        userType: sessionUser?.userType ?? runtimeConfig.value.userType,
        channelId:
          authData.activeChannel?.id ?? sessionUser?.channelId ?? runtimeConfig.value.channelId,
        channelName: authData.activeChannel?.name ?? runtimeConfig.value.channelName,
        nickname: runtimeUser?.nickname ?? sessionUser?.nickname ?? runtimeConfig.value.nickname,
      }
      saveToStorage()
    } catch (error) {
      console.error('更新认证配置失败:', error)
    }
  }

  return {
    config,
    effectiveUserId,
    getConfigByAccount,
    updateConfig,
    resetConfig,
    saveToStorage,
    loadFromStorage,
    applyRoleDefaults,
    updateFromAuthConfig,
  }
})
