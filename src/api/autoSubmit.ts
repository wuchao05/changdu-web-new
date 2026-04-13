/**
 * 自动提交下载 API
 * 调用服务端的当前渠道自动提交调度器
 */
import httpInstance from './http'

export interface AutoSubmitStatus {
  channelId: string
  channelName: string
  enabled: boolean
  running: boolean
  intervalMinutes: number | null
  onlyRedFlag: boolean
  runOnce: boolean
  submitRangeDays: 1 | 2 | 3
  nextRunTime: string | null
  lastRunTime: string | null
  stats: {
    totalProcessed: number
    successCount: number
    failCount: number
    skipCount: number
  }
  progress: {
    current: number
    total: number
    currentDate: string
    currentDrama: string
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

export interface AutoSubmitResponse {
  code: number
  message: string
  data?: AutoSubmitStatus
}

export interface StartAutoSubmitParams {
  intervalMinutes?: number
  onlyRedFlag?: boolean
  runOnce?: boolean
  submitRangeDays?: 1 | 2 | 3
}

export function startAutoSubmit(params: StartAutoSubmitParams): Promise<AutoSubmitResponse> {
  return httpInstance.post('/auto-submit/start', params).then(res => res.data)
}

export function stopAutoSubmit(): Promise<AutoSubmitResponse> {
  return httpInstance.post('/auto-submit/stop', {}).then(res => res.data)
}

export function getAutoSubmitStatus(): Promise<{
  code: number
  message: string
  data: AutoSubmitStatus
}> {
  return httpInstance.get('/auto-submit/status').then(res => res.data)
}

export function triggerAutoSubmit(): Promise<AutoSubmitResponse> {
  return httpInstance.post('/auto-submit/trigger', {}).then(res => res.data)
}

export function resetAutoSubmitStats(): Promise<AutoSubmitResponse> {
  return httpInstance.post('/auto-submit/reset-stats', {}).then(res => res.data)
}
