import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as adminApi from '@/api/admin'
import {
  clearSelectedChannelId,
  clearSessionToken,
  getSelectedChannelId,
  getSessionToken,
  setSelectedChannelId,
  setSessionToken,
} from '@/utils/sessionToken'

interface SessionRequestError extends Error {
  status?: number
  code?: number
}

function isRequestCanceled(error: unknown) {
  const requestError = error as { name?: string; code?: string; message?: string }
  return (
    requestError?.name === 'AbortError' ||
    requestError?.name === 'CanceledError' ||
    requestError?.code === 'ERR_CANCELED' ||
    requestError?.message === 'canceled'
  )
}

export const useSessionStore = defineStore('session', () => {
  const currentUser = ref<adminApi.UserProfile | null>(null)
  const currentRuntimeUser = ref<adminApi.UserProfile | null>(null)
  const currentChannel = ref<adminApi.ChannelSummary | null>(null)
  const availableChannels = ref<adminApi.ChannelSummary[]>([])
  const currentChannelUsers = ref<adminApi.UserProfile[]>([])
  const selectedChannelId = ref('')
  const initialized = ref(false)

  const isAuthenticated = computed(() => Boolean(currentUser.value))
  const isAdmin = computed(() => currentUser.value?.userType === 'admin')
  const activeChannelId = computed(() =>
    isAdmin.value ? selectedChannelId.value : currentChannel.value?.id || ''
  )

  async function syncAdminChannels(signal?: AbortSignal) {
    const sessionData = await adminApi.getCurrentSession({ signal })
    if (signal?.aborted) return

    currentUser.value = sessionData.user
    currentRuntimeUser.value = sessionData.runtimeUser
    currentChannel.value = sessionData.channel
    currentChannelUsers.value = Array.isArray(sessionData.channelBoundUsers)
      ? sessionData.channelBoundUsers
      : []
    availableChannels.value = Array.isArray((sessionData as any).availableChannels)
      ? (sessionData as any).availableChannels
      : sessionData.channel
        ? [sessionData.channel]
        : []

    const savedChannelId = getSelectedChannelId()
    const fallbackChannelId =
      sessionData.channel?.id ||
      sessionData.user.defaultChannelId ||
      availableChannels.value[0]?.id ||
      ''
    const nextChannelId = availableChannels.value.some(channel => channel.id === savedChannelId)
      ? savedChannelId
      : fallbackChannelId

    selectedChannelId.value = nextChannelId
    setSelectedChannelId(nextChannelId)
  }

  async function loadSession(signal?: AbortSignal) {
    if (!getSessionToken()) {
      currentUser.value = null
      currentRuntimeUser.value = null
      currentChannel.value = null
      availableChannels.value = []
      currentChannelUsers.value = []
      selectedChannelId.value = ''
      initialized.value = true
      return
    }

    try {
      await syncAdminChannels(signal)
    } catch (error) {
      if (isRequestCanceled(error)) {
        return
      }

      const sessionError = error as SessionRequestError
      const shouldClearSession =
        sessionError?.status === 401 ||
        sessionError?.code === 401 ||
        sessionError?.message?.includes('未登录') ||
        sessionError?.message?.includes('登录已失效')

      if (shouldClearSession) {
        clearSessionToken()
        clearSelectedChannelId()
        currentUser.value = null
        currentRuntimeUser.value = null
        currentChannel.value = null
        availableChannels.value = []
        currentChannelUsers.value = []
        selectedChannelId.value = ''
      } else {
        console.warn('[SessionStore] 会话校验失败，保留本地登录态，等待服务恢复:', error)
      }
    } finally {
      if (!signal?.aborted) {
        initialized.value = true
      }
    }
  }

  async function login(account: string, password: string) {
    const data = await adminApi.login(account, password)
    setSessionToken(data.token)
    currentUser.value = data.user
    currentRuntimeUser.value = null
    currentChannel.value = data.channel
    await syncAdminChannels()
    initialized.value = true
    return data
  }

  function updateSelectedChannel(channelId: string) {
    selectedChannelId.value = channelId
    setSelectedChannelId(channelId)
  }

  async function logout() {
    try {
      await adminApi.logout()
    } finally {
      clearSessionToken()
      clearSelectedChannelId()
      currentUser.value = null
      currentRuntimeUser.value = null
      currentChannel.value = null
      availableChannels.value = []
      currentChannelUsers.value = []
      selectedChannelId.value = ''
    }
  }

  return {
    currentUser,
    currentRuntimeUser,
    currentChannel,
    availableChannels,
    currentChannelUsers,
    selectedChannelId,
    activeChannelId,
    initialized,
    isAuthenticated,
    isAdmin,
    loadSession,
    login,
    updateSelectedChannel,
    logout,
  }
})
