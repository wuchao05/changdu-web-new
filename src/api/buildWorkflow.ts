import { ENV } from '@/config/env'
import { buildSessionHeaders } from '@/utils/sessionToken'

export function reportClientWorkflowLog(params: {
  message: string
  level?: 'log' | 'info' | 'warn' | 'error'
  context?: Record<string, unknown>
}) {
  return fetch(`${ENV.BASE_URL}/build-workflow/client-log`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })
}

/**
 * 创建推广链接
 */
export async function createPromotionLink(params: {
  book_id: string
  drama_name: string
  promotion_name?: string
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/create-promotion-link`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`创建推广链接失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 200) {
    throw new Error(result.message || '创建推广链接失败')
  }

  return result
}

/**
 * 查询小程序
 */
export async function queryMicroApp(accountId: string): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/query-microapp`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ account_id: accountId }),
  })

  if (!response.ok) {
    throw new Error(`查询小程序失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 查询被共享的已审核通过的小程序（search_type=2）
 * 用于优化资产化流程，优先使用被共享的已审核通过的小程序
 */
export async function queryApprovedMicroApp(accountId: string): Promise<{
  code: number
  message: string
  data: {
    found: boolean
    micro_app: {
      instance_id: string
      micro_app_instance_id: string
      app_id: string
      name: string
      status: number
      [key: string]: any
    } | null
  }
}> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/query-approved-microapp`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ account_id: accountId }),
  })

  if (!response.ok) {
    throw new Error(`查询被共享的已审核通过的小程序失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 查询小程序资产列表
 */
export async function listMicroAppAssets(accountId: string): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/list-assets`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ account_id: accountId }),
  })

  if (!response.ok) {
    throw new Error(`查询小程序资产失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 创建小程序资产
 */
export async function createMicroAppAsset(params: {
  account_id: string
  micro_app_instance_id: string
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/create-asset`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`创建小程序资产失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || result.error || result.message || '创建小程序资产失败')
  }

  return result
}

/**
 * 添加付费事件
 */
export async function addPaymentEvent(params: {
  account_id: string
  assets_id: string | number
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/add-event`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`添加付费事件失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || result.error || result.message || '添加付费事件失败')
  }

  return result
}

/**
 * 查询事件状态
 */
export async function checkEventStatus(params: {
  account_id: string
  assets_id: string | number
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/check-event`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`查询事件状态失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 上传头像图片
 */
export async function uploadAvatarImage(accountId: string): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/upload-avatar-image`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ account_id: accountId }),
  })

  if (!response.ok) {
    throw new Error(`上传头像图片失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 200) {
    throw new Error(result.message || '上传头像图片失败')
  }

  return result
}

/**
 * 保存头像
 */
export async function saveAvatar(params: {
  account_id: string
  web_uri: string
  width: number
  height: number
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/save-avatar`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`保存头像失败: ${response.statusText}`)
  }

  const result = await response.json()
  // code 200 表示成功，后端已经将 410001（没有任何修改）转换为 200
  if (result.code !== 200) {
    throw new Error(result.message || '保存头像失败')
  }

  return result
}

/**
 * 获取小程序详情
 */
export async function getMicroAppDetail(params: {
  account_id: string
  micro_app_instance_id: string
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/get-microapp-detail`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`获取小程序详情失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || result.error || result.message || '获取小程序详情失败')
  }

  return result
}

/**
 * 上传主图
 */
export async function uploadProductImage(accountId: string): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/upload-product-image`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ account_id: accountId }),
  })

  if (!response.ok) {
    throw new Error(`上传主图失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || result.error || result.message || '上传主图失败')
  }

  return result
}

/**
 * 清理当前账户下的历史项目
 */
export async function clearExistingProjects(accountId: string): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/clear-existing-projects`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ account_id: accountId }),
  })

  if (!response.ok) {
    throw new Error(`清理历史项目失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || result.error || result.message || '清理历史项目失败')
  }

  return result
}

/**
 * 创建项目
 */
export async function createProject(params: {
  account_id: string
  drama_name: string
  douyin_account_name?: string
  assets_id: string | number
  micro_app_instance_id: string
  project_name?: string
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/create-project`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`创建项目失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || result.error || result.message || '创建项目失败')
  }

  return result
}

/**
 * 获取抖音号信息
 */
export async function getDouyinAccountInfo(params: {
  account_id: string
  douyin_account_id: string
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/get-douyin-account-info`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`获取抖音号信息失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || result.error || result.message || '获取抖音号信息失败')
  }

  return result
}

/**
 * 获取素材列表
 */
export async function getMaterialList(params: {
  account_id: string
  aweme_id: string
  aweme_account: string
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/get-material-list`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`获取素材列表失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || result.error || result.message || '获取素材列表失败')
  }

  return result
}

/**
 * 创建广告
 */
export async function createPromotion(params: {
  account_id: string
  project_id: string | number
  ad_name: string
  drama_name: string
  ies_core_user_id: string
  materials: any[] // 素材数组（所有筛选出的素材）
  app_id: string
  start_page?: string
  app_type?: number
  start_params?: string
  link?: string
  product_image_uri: string
  product_image_width?: number
  product_image_height?: number
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/create-promotion`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`创建广告失败: ${response.statusText}`)
  }

  const result = await response.json()
  // 不要在这里抛出异常，直接返回结果，让调用方判断 code
  // 这样可以支持名称重复时的自动重试逻辑
  return result
}

/**
 * 创建小程序
 */
export async function createMicroApp(params: {
  account_id: string
  app_id: string
  path: string
  query: string
  remark: string
  link: string
}): Promise<any> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/create-microapp`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`创建小程序失败: ${response.statusText}`)
  }

  const result = await response.json()

  // 检查业务错误码
  if (result.code !== 0 && result.code !== 200) {
    throw new Error(result.msg || result.error || result.message || '创建小程序失败')
  }

  return result
}

// ========== 智能调度相关接口 ==========

const SMART_SCHEDULER_BASE_URL = 'https://ad-runner.cxyy.top'

/**
 * 智能调度任务类型
 */
export interface SmartSchedulerTask {
  taskId: string
  dramaName: string
  date: string
  mediaAccount: string
  status: string
  releaseTime?: string
  buildTime: string
  createTime: string
  endTime: string
  error?: string
}

/**
 * 智能调度器状态响应类型
 */
export interface SmartSchedulerStatus {
  user: string
  interval: number
  enabled: boolean
  runCount: number
  lastRun: string | null
  taskId: string
  status: string
  nextRun?: string
  taskList?: SmartSchedulerTask[]
}

/**
 * 查询智能调度器状态
 */
export async function getSmartSchedulerStatus(params: { user: string }): Promise<{
  schedulers: SmartSchedulerStatus[]
  total: number
}> {
  const url = new URL(`${SMART_SCHEDULER_BASE_URL}/smart-scheduler/status`)
  url.searchParams.append('user', params.user)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
  })

  if (!response.ok) {
    throw new Error(`查询智能调度器状态失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 启动智能调度器
 */
export async function startSmartScheduler(params: { interval: number; user: string }): Promise<{
  message: string
  user: string
  interval: number
  nextRun: string
}> {
  const response = await fetch(`${SMART_SCHEDULER_BASE_URL}/smart-scheduler/start`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`启动智能调度器失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 停止智能调度器
 */
export async function stopSmartScheduler(params: { user: string }): Promise<{
  message: string
  user: string
  runCount: number
  lastRun: string
}> {
  const response = await fetch(`${SMART_SCHEDULER_BASE_URL}/smart-scheduler/stop`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`停止智能调度器失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 触发智能调度器立即执行搭建任务
 */
export async function triggerSmartScheduler(params: { user: string }): Promise<{
  message: string
  user: string
  triggerTime: string
}> {
  const response = await fetch(`${SMART_SCHEDULER_BASE_URL}/smart-scheduler/trigger`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`触发智能调度器失败: ${response.statusText}`)
  }

  return response.json()
}

// ========== 搭建工作流后台调度器接口 ==========

/**
 * 后台调度器任务历史类型
 */
export interface BackgroundSchedulerTaskHistory {
  dramaName: string
  status: 'success' | 'failed' | 'skipped'
  rating?: string | null
  date?: number | null
  publishTime?: number | null
  error?: string
  completedAt: string
}

/**
 * 后台调度器当前任务类型
 */
export interface BackgroundSchedulerCurrentTask {
  status: 'running' | 'building'
  dramaName?: string
  startTime: string
}

/**
 * 后台调度器状态类型
 */
export interface BackgroundSchedulerStatus {
  enabled: boolean
  intervalMinutes: number | null
  tableId: string | null
  nextRunTime: string | null
  lastRunTime: string | null
  stats: {
    totalBuilt: number
    successCount: number
    failCount: number
  }
  currentTask: BackgroundSchedulerCurrentTask | null
  taskHistory: BackgroundSchedulerTaskHistory[]
}

/**
 * 启动搭建工作流后台调度器
 * @param intervalMinutes 轮询间隔（分钟）
 */
export async function startBackgroundScheduler(
  intervalMinutes: number,
  tableId?: string
): Promise<{
  code: number
  message: string
  data: BackgroundSchedulerStatus
}> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/scheduler/start`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ intervalMinutes, table_id: tableId }),
  })

  if (!response.ok) {
    throw new Error(`启动后台调度器失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.message || '启动后台调度器失败')
  }

  return result
}

/**
 * 停止搭建工作流后台调度器
 */
export async function stopBackgroundScheduler(): Promise<{
  code: number
  message: string
  data: BackgroundSchedulerStatus
}> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/scheduler/stop`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
  })

  if (!response.ok) {
    throw new Error(`停止后台调度器失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.message || '停止后台调度器失败')
  }

  return result
}

/**
 * 查询搭建工作流后台调度器状态
 */
export async function getBackgroundSchedulerStatus(): Promise<{
  code: number
  message: string
  data: BackgroundSchedulerStatus
}> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/scheduler/status`, {
    method: 'GET',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
  })

  if (!response.ok) {
    throw new Error(`查询后台调度器状态失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.message || '查询后台调度器状态失败')
  }

  return result
}

/**
 * 触发后台调度器立即执行一次搭建
 * @param params 参数
 * @param params.dramaId 可选，指定要搭建的剧集ID
 * @param params.tableId 可选，覆盖更新飞书状态时使用的表格ID
 */
export async function triggerBackgroundSchedulerBuild(params: {
  dramaId?: string
  tableId?: string
}): Promise<{
  code: number
  message: string
  data: BackgroundSchedulerStatus
}> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/scheduler/trigger`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      dramaId: params.dramaId,
      table_id: params.tableId,
    }),
  })

  if (!response.ok) {
    throw new Error(`触发后台搭建失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.message || '触发后台搭建失败')
  }

  return result
}

/**
 * 验证并创建小程序（带重试机制）
 *
 * 使用场景：在新增待下载/待剪辑时，先验证账户的小程序审核状态
 *
 * @param params.drama_name 剧名
 * @param params.book_id 剧集ID
 * @param params.account_candidates 候选账户ID数组
 * @returns 验证结果，包含最终使用的账户和相关信息
 */
export async function validateAndCreateMicroapp(params: {
  drama_name: string
  book_id: string
  account_candidates: string[]
}): Promise<{
  success: boolean
  account_id: string
  message: string
  microapp_status?: number
  attempts_used: number
  attempts?: Array<{
    account_id: string
    status: number | null
    message: string
  }>
  microapp_info?: any
  skip_create?: boolean
  force_use?: boolean
}> {
  const response = await fetch(`${ENV.BASE_URL}/build-workflow/validate-and-create-microapp`, {
    method: 'POST',
    headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`验证并创建小程序失败: ${response.statusText}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || '验证并创建小程序失败')
  }

  return result
}
