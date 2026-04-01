import { ENV } from '@/config/env'
import type { BuildConfig } from './buildConfig'
import { buildSessionHeaders } from '@/utils/sessionToken'

interface RequestError extends Error {
  status?: number
  code?: number
}

export interface UserChannelBindingConfig {
  enabled: boolean
  feishu: {
    dramaListTableId: string
    dramaStatusTableId: string
    accountTableId: string
  }
  materialPreview: {
    enabled: boolean
    intervalMinutes: number
    buildTimeWindowStart: number
    buildTimeWindowEnd: number
  }
  permissions: {
    syncAccount: boolean
    webMenus: {
      overview: boolean
      report: boolean
    }
    desktopMenus: {
      download: boolean
      materialClip: boolean
      upload: boolean
      juliangUpload: boolean
      uploadBuild: boolean
      juliangBuild: boolean
    }
  }
  orderUserStats: {
    enabled: boolean
    sortMode: 'manual' | 'amount_desc'
    usernames: string[]
  }
  independentOrderStats: {
    enabled: boolean
  }
  douyinMaterialMatches: Array<{
    id: string
    douyinAccount: string
    douyinAccountId: string
    materialRange: string
    createdAt?: string
    updatedAt?: string
  }>
}

export interface DownloadCenterConfig {
  id: string
  name: string
  owner: string
  secretKey: string
  appId: string
  cookie: string
  distributorId: string
  adUserId: string
  rootAdUserId: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  id: string
  nickname: string
  account: string
  brandName: string
  userType: 'admin' | 'normal'
  channelIds: string[]
  defaultChannelId: string
  channelConfigs?: Record<string, UserChannelBindingConfig>
  feishu: {
    dramaListTableId: string
    dramaStatusTableId: string
    accountTableId: string
  }
  materialPreview: {
    enabled: boolean
    intervalMinutes: number
    buildTimeWindowStart: number
    buildTimeWindowEnd: number
  }
  permissions?: {
    syncAccount: boolean
    webMenus: {
      overview: boolean
      report: boolean
    }
    desktopMenus: {
      download: boolean
      materialClip: boolean
      upload: boolean
      juliangUpload: boolean
      uploadBuild: boolean
      juliangBuild: boolean
    }
  }
  orderUserStats?: {
    enabled: boolean
    sortMode: 'manual' | 'amount_desc'
    usernames: string[]
  }
  independentOrderStats?: {
    enabled: boolean
  }
  douyinMaterialMatches?: Array<{
    id: string
    douyinAccount: string
    douyinAccountId: string
    materialRange: string
  }>
  createdAt: string
  updatedAt: string
  channelNames?: string[]
  defaultChannelName?: string
  channelConfigEnabled?: boolean
}

export interface ChannelConfig {
  id: string
  name: string
  juliang: {
    cookie: string
    buildConfig: BuildConfig
  }
  changdu: {
    secretKey?: string
    cookie: string
    distributorId: string
    adUserId: string
    rootAdUserId: string
    appId: string
  }
  adx?: {
    cookie: string
  }
  createdAt: string
  updatedAt: string
}

export interface SchedulerOverviewTaskBase {
  key: 'autoSubmit' | 'buildWorkflow' | 'materialPreview'
  title: string
  enabled: boolean
  running: boolean
  isAbnormal: boolean
  abnormalReasons: string[]
  nextRunTime: string | null
  nextRunTimeText: string | null
  lastRunTime: string | null
  lastRunTimeText: string | null
  currentTask: {
    status: string
    startTime: string | null
    dramaName?: string
  } | null
}

export interface SchedulerOverviewAutoSubmitTask extends SchedulerOverviewTaskBase {
  key: 'autoSubmit'
  intervalMinutes: number
  onlyRedFlag: boolean
  progress: {
    current: number
    total: number
    currentDate: string
    currentDrama: string
  }
  stats: {
    totalProcessed: number
    successCount: number
    failCount: number
    skipCount: number
  }
  taskHistory: Array<{
    timestamp: string
    status: 'completed' | 'error'
    processed?: number
    success?: number
    fail?: number
    skip?: number
    error?: string
  }>
}

export interface SchedulerOverviewBuildWorkflowTask extends SchedulerOverviewTaskBase {
  key: 'buildWorkflow'
  intervalMinutes: number
  tableId: string | null
  stats: {
    totalBuilt: number
    successCount: number
    failCount: number
  }
  taskHistory: Array<{
    dramaName: string
    status: 'success' | 'failed' | 'skipped'
    rating?: string | null
    date?: number | null
    publishTime?: number | null
    error?: string
    completedAt: string
  }>
}

export interface SchedulerOverviewMaterialPreviewTask extends SchedulerOverviewTaskBase {
  key: 'materialPreview'
  intervalMinutes: number
  buildTimeWindowStart: number
  buildTimeWindowEnd: number
  lastStatus: 'success' | 'failed' | null
  lastError: string
  stats: {
    totalProcessed: number
    totalPreviewed: number
    totalDeleted: number
    successCount: number
    failCount: number
  }
}

export interface SchedulerOverviewItem {
  userId: string
  runtimeUserName: string
  account: string
  channelId: string
  channelName: string
  tasks: {
    autoSubmit: SchedulerOverviewAutoSubmitTask
    buildWorkflow: SchedulerOverviewBuildWorkflowTask
    materialPreview: SchedulerOverviewMaterialPreviewTask
  }
  summary: {
    total: number
    enabledCount: number
    runningCount: number
    abnormalCount: number
    hasAbnormal: boolean
  }
}

export interface SchedulerOverviewResponse {
  updatedAt: string
  summary: {
    totalGroups: number
    abnormalGroups: number
    runningGroups: number
    enabledTasks: number
  }
  items: SchedulerOverviewItem[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ENV.BASE_URL}${path}`, {
    ...init,
    headers: buildSessionHeaders({
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    }),
  })

  const result = await response.json()
  if (!response.ok || (result.code !== undefined && result.code !== 0)) {
    const error = new Error(result.message || '请求失败') as RequestError
    error.status = response.status
    error.code = result.code
    throw error
  }

  return result.data as T
}

export function login(account: string, password: string) {
  return request<{
    token: string
    user: UserProfile
    channel: { id: string; name: string } | null
  }>('/session/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  })
}

export function logout() {
  return request<void>('/session/logout', {
    method: 'POST',
  })
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<void>('/session/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  })
}

export function getCurrentSession() {
  return request<{
    user: UserProfile
    runtimeUser: UserProfile | null
    channel: { id: string; name: string } | null
    availableChannels: Array<{ id: string; name: string }>
    feishu: {
      dramaListTableId: string
      dramaStatusTableId: string
      accountTableId: string
    }
    materialPreview: UserChannelBindingConfig['materialPreview']
    orderUserStats: UserChannelBindingConfig['orderUserStats']
    downloadCenterConfig: DownloadCenterConfig | null
    buildConfig: BuildConfig
  }>('/session/me')
}

export function getAdminOverview() {
  return request<{
    userCount: number
    channelCount: number
    adminCount: number
    normalCount: number
  }>('/admin/overview')
}

export function getSchedulerOverview() {
  return request<SchedulerOverviewResponse>('/admin/scheduler-overview')
}

export function listUsers() {
  return request<UserProfile[]>('/admin/users')
}

export function getUser(id: string) {
  return request<UserProfile>(`/admin/users/${id}`)
}

export function createUser(payload: Partial<UserProfile> & { password: string }) {
  return request<UserProfile>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUser(id: string, payload: Partial<UserProfile> & { password?: string }) {
  return request<UserProfile>(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteUser(id: string) {
  return request<void>(`/admin/users/${id}`, {
    method: 'DELETE',
  })
}

export function listChannels() {
  return request<ChannelConfig[]>('/admin/channels')
}

export function getChannel(id: string) {
  return request<ChannelConfig>(`/admin/channels/${id}`)
}

export function createChannel(payload: Partial<ChannelConfig>) {
  return request<ChannelConfig>('/admin/channels', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateChannel(id: string, payload: Partial<ChannelConfig>) {
  return request<ChannelConfig>(`/admin/channels/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function reorderChannels(channelIds: string[]) {
  return request<ChannelConfig[]>('/admin/channels/reorder', {
    method: 'PUT',
    body: JSON.stringify({ channelIds }),
  })
}

export function deleteChannel(id: string) {
  return request<void>(`/admin/channels/${id}`, {
    method: 'DELETE',
  })
}

export function listDownloadCenterConfigs() {
  return request<DownloadCenterConfig[]>('/admin/download-center-configs')
}

export function getDefaultDownloadCenterConfig() {
  return request<DownloadCenterConfig | null>('/admin/download-center-configs/default')
}

export function getSessionDefaultDownloadCenterConfig() {
  return request<DownloadCenterConfig | null>('/session/download-center-config/default')
}

export function createDownloadCenterConfig(payload: Partial<DownloadCenterConfig>) {
  return request<DownloadCenterConfig>('/admin/download-center-configs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateDownloadCenterConfig(id: string, payload: Partial<DownloadCenterConfig>) {
  return request<DownloadCenterConfig>(`/admin/download-center-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteDownloadCenterConfig(id: string) {
  return request<void>(`/admin/download-center-configs/${id}`, {
    method: 'DELETE',
  })
}
