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

export const useSessionStore = defineStore('session', () => {
  const currentUser = ref<adminApi.UserProfile | null>(null)
  const currentRuntimeUser = ref<adminApi.UserProfile | null>(null)
  const currentChannel = ref<{ id: string; name: string } | null>(null)
  const availableChannels = ref<Array<{ id: string; name: string }>>([])
  const selectedChannelId = ref('')
  const initialized = ref(false)

  const isAuthenticated = computed(() => Boolean(currentUser.value))
  const isAdmin = computed(() => currentUser.value?.userType === 'admin')
  const activeChannelId = computed(() =>
    isAdmin.value ? selectedChannelId.value : currentChannel.value?.id || ''
  )

  async function syncAdminChannels() {
    const sessionData = await adminApi.getCurrentSession()
    currentUser.value = sessionData.user
    currentRuntimeUser.value = sessionData.runtimeUser
    currentChannel.value = sessionData.channel
    availableChannels.value = Array.isArray((sessionData as any).availableChannels)
      ? (sessionData as any).availableChannels
      : sessionData.channel
        ? [sessionData.channel]
        : []

    const savedChannelId = getSelectedChannelId()
    const fallbackChannelId =
      sessionData.channel?.id || sessionData.user.defaultChannelId || availableChannels.value[0]?.id || ''
    const nextChannelId = availableChannels.value.some(channel => channel.id === savedChannelId)
      ? savedChannelId
      : fallbackChannelId

    selectedChannelId.value = nextChannelId
    setSelectedChannelId(nextChannelId)
  }

  async function loadSession() {
    if (!getSessionToken()) {
      currentUser.value = null
      currentRuntimeUser.value = null
      currentChannel.value = null
      availableChannels.value = []
      selectedChannelId.value = ''
      initialized.value = true
      return
    }

    try {
      await syncAdminChannels()
    } catch {
      clearSessionToken()
      clearSelectedChannelId()
      currentUser.value = null
      currentRuntimeUser.value = null
      currentChannel.value = null
      availableChannels.value = []
      selectedChannelId.value = ''
    } finally {
      initialized.value = true
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
      selectedChannelId.value = ''
    }
  }

  return {
    currentUser,
    currentRuntimeUser,
    currentChannel,
    availableChannels,
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
