import httpInstance from './http'

export interface MaterialPreviewStatus {
  instanceKey: string
  userId: string
  runtimeUserName: string
  channelId: string
  channelName: string
  enabled: boolean
  running: boolean
  intervalMinutes: number
  buildTimeWindowStart: number
  buildTimeWindowEnd: number
  nextRunTime: string | null
  lastRunTime: string | null
  lastStatus: 'success' | 'failed' | null
  lastError: string
  tableId: string
  awemeWhiteList: string[]
  stats: {
    totalProcessed: number
    totalPreviewed: number
    totalDeleted: number
    successCount: number
    failCount: number
  }
  lastRunTimeText: string | null
  nextRunTimeText: string | null
}

export interface MaterialPreviewControlParams {
  userId?: string
  channelId?: string
  intervalMinutes?: number
  buildTimeWindowStart?: number
  buildTimeWindowEnd?: number
}

export function startMaterialPreview(params: MaterialPreviewControlParams = {}) {
  return httpInstance.post('/material-preview/start', params).then(res => res.data)
}

export function stopMaterialPreview(params: Pick<MaterialPreviewControlParams, 'userId' | 'channelId'> = {}) {
  return httpInstance.post('/material-preview/stop', params).then(res => res.data)
}

export function updateMaterialPreview(params: MaterialPreviewControlParams = {}) {
  return httpInstance.post('/material-preview/update', params).then(res => res.data)
}

export function triggerMaterialPreview(params: Pick<MaterialPreviewControlParams, 'userId' | 'channelId'> = {}) {
  return httpInstance.post('/material-preview/trigger', params).then(res => res.data)
}

export function executeMaterialPreviewOnce(
  params: MaterialPreviewControlParams & { dryRun?: boolean; previewDelayMs?: number } = {}
) {
  return httpInstance.post('/material-preview/execute-once', params).then(res => res.data)
}

export function analyzeMaterialPreview(
  params: Pick<MaterialPreviewControlParams, 'userId' | 'channelId'> & {
    aadvid: string
    dramaName: string
  }
) {
  return httpInstance.post('/material-preview/analyze', params).then(res => res.data)
}

export function executeMaterialPreview(
  params: Pick<MaterialPreviewControlParams, 'userId' | 'channelId'> & {
    aadvid: string
    dramaName: string
    delayMs?: number
  }
) {
  return httpInstance.post('/material-preview/execute', params).then(res => res.data)
}

export function cleanupMaterialPreview(
  params: Pick<MaterialPreviewControlParams, 'userId' | 'channelId'> & {
    aadvid: string
    dramaName: string
    deleteAds?: boolean
  }
) {
  return httpInstance.post('/material-preview/cleanup', params).then(res => res.data)
}

export function getMaterialPreviewStatus(params: Pick<MaterialPreviewControlParams, 'userId' | 'channelId'> = {}) {
  return httpInstance.get('/material-preview/status', { params }).then(res => res.data)
}

export function listMaterialPreviewStatus(params: Pick<MaterialPreviewControlParams, 'userId' | 'channelId'> = {}) {
  return httpInstance.get('/material-preview/status/list', { params }).then(res => res.data)
}
