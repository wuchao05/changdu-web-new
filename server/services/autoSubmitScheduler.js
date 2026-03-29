/**
 * 自动提交下载后台调度服务
 * 将前端的自动提交下载功能迁移到服务端，支持定时轮询、状态持久化
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { FEISHU_CONFIG } from '../config/feishu.js'
import { AUTO_SUBMIT_CONFIG } from '../config/autoSubmit.js'
import { buildChangduGetHeaders } from '../utils/changduSign.js'
import { CHANGDU_BASE_URL, CHANGDU_DISTRIBUTOR_ID, CHANGDU_SECRET_KEY } from '../config/changdu.js'
import {
  getChannelLabel,
  normalizeChannelRuntime,
  resolveChannelRuntimeById,
} from '../utils/channelRuntime.js'
import { normalizeRuntimeInstanceKey } from '../utils/runtimeInstance.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 将 ISO 时间字符串转换为北京时间格式
 * @param {string | null} isoString - ISO 格式的时间字符串
 * @returns {string | null} 北京时间格式 "YYYY-MM-DD HH:mm:ss"
 */
function toBeijingTime(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  // 转换为北京时间（UTC+8）
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = beijingDate.getUTCFullYear()
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingDate.getUTCDate()).padStart(2, '0')
  const hours = String(beijingDate.getUTCHours()).padStart(2, '0')
  const minutes = String(beijingDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(beijingDate.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 抖音素材配置文件路径（与 douyinMaterial 路由保持一致）
const isProduction = process.env.NODE_ENV === 'production'
/**
 * 安全解析 JSON 响应
 */
async function safeJsonParse(response, context = '') {
  const status = response.status
  const text = await response.text()
  if (!text || text.trim() === '') {
    console.error(`[自动提交] ${context} 响应为空, HTTP状态: ${status}, URL: ${response.url}`)
    throw new Error(`${context ? context + ': ' : ''}响应为空 (HTTP ${status})`)
  }
  try {
    return JSON.parse(text)
  } catch (e) {
    console.error(
      `[自动提交] JSON解析失败 ${context}, HTTP状态: ${status}:`,
      text.substring(0, 500)
    )
    throw new Error(`${context ? context + ': ' : ''}JSON解析失败 - ${e.message}`)
  }
}

// 状态文件路径（按渠道分离）
function getStateFilePath(instanceKey) {
  const fileName = `auto-submit-scheduler-state-${normalizeRuntimeInstanceKey(instanceKey)}.json`
  return isProduction
    ? `/data/changdu-web/${fileName}`
    : path.join(__dirname, `../data/${fileName}`)
}

// 旧状态文件路径（用于迁移）
const OLD_STATE_FILE_PATH = isProduction
  ? '/data/changdu-web/auto-submit-scheduler-state.json'
  : path.join(__dirname, '../data/auto-submit-scheduler-state.json')

// 创建默认状态对象
function createDefaultState() {
  return {
    instanceKey: '',
    userId: '',
    runtimeUserName: '',
    channelId: '',
    channelName: '',
    channelRuntime: null,
    runtimeUserConfig: {
      feishu: {
        dramaListTableId: '',
        dramaStatusTableId: '',
        accountTableId: '',
      },
      douyinMaterialMatches: [],
    },
    enabled: false,
    intervalMinutes: 5,
    nextRunTime: null,
    lastRunTime: null,
    running: false,
    onlyRedFlag: false,
    stats: {
      totalProcessed: 0,
      successCount: 0,
      failCount: 0,
      skipCount: 0,
    },
    currentTask: null,
    progress: {
      current: 0,
      total: 0,
      currentDate: '',
      currentDrama: '',
    },
    taskHistory: [],
  }
}

const schedulers = Object.create(null)

async function listPersistedInstanceKeys() {
  try {
    const fileNames = await fs.readdir(
      isProduction ? '/data/changdu-web' : path.join(__dirname, '../data')
    )
    return fileNames
      .filter(
        fileName =>
          fileName.startsWith('auto-submit-scheduler-state-') && fileName.endsWith('.json')
      )
      .map(fileName => fileName.slice('auto-submit-scheduler-state-'.length, -'.json'.length))
  } catch {
    return []
  }
}

function ensureSchedulerEntry(instanceKey = '') {
  const normalizedInstanceKey = normalizeRuntimeInstanceKey(instanceKey) || 'default'
  if (!schedulers[normalizedInstanceKey]) {
    schedulers[normalizedInstanceKey] = {
      state: {
        ...createDefaultState(),
        instanceKey: normalizedInstanceKey,
      },
      timer: null,
    }
  }
  return schedulers[normalizedInstanceKey]
}

function normalizeRuntimeUserConfig(runtimeContext = {}) {
  const runtimeUser = runtimeContext.runtimeUser || runtimeContext.runtimeUserConfig || {}
  return {
    feishu: {
      dramaListTableId: String(runtimeUser.feishu?.dramaListTableId || '').trim(),
      dramaStatusTableId: String(runtimeUser.feishu?.dramaStatusTableId || '').trim(),
      accountTableId: String(runtimeUser.feishu?.accountTableId || '').trim(),
    },
    douyinMaterialMatches: Array.isArray(runtimeUser.douyinMaterialMatches)
      ? runtimeUser.douyinMaterialMatches.map(item => ({
          douyinAccount: String(item?.douyinAccount || '').trim(),
          douyinAccountId: String(item?.douyinAccountId || '').trim(),
          materialRange: String(item?.materialRange || '').trim(),
        }))
      : [],
  }
}

function getSchedulerRuntime(instanceKey) {
  return normalizeChannelRuntime(ensureSchedulerEntry(instanceKey).state.channelRuntime || {})
}

function getSchedulerProfile(instanceKey) {
  const entry = ensureSchedulerEntry(instanceKey)
  const runtime = getSchedulerRuntime(instanceKey)
  const runtimeUserConfig = entry.state.runtimeUserConfig || createDefaultState().runtimeUserConfig
  return {
    instanceKey: entry.state.instanceKey,
    userId: entry.state.userId,
    runtimeUserName: entry.state.runtimeUserName,
    channelId: entry.state.channelId,
    channelName: runtime.channelName || entry.state.channelName || entry.state.channelId,
    dramaListTableId:
      runtimeUserConfig.feishu?.dramaListTableId || FEISHU_CONFIG.table_ids.drama_list,
    dramaStatusTableId:
      runtimeUserConfig.feishu?.dramaStatusTableId || FEISHU_CONFIG.table_ids.drama_status,
    accountTableId: runtimeUserConfig.feishu?.accountTableId || FEISHU_CONFIG.table_ids.account,
    douyinMaterialMatches: Array.isArray(runtimeUserConfig.douyinMaterialMatches)
      ? runtimeUserConfig.douyinMaterialMatches
      : [],
  }
}

async function ensureSchedulerRuntime(instanceKey, runtimeContext = null) {
  const entry = ensureSchedulerEntry(instanceKey)

  if (runtimeContext?.channelRuntime) {
    const normalizedRuntime = normalizeChannelRuntime(runtimeContext.channelRuntime)
    entry.state.instanceKey = normalizeRuntimeInstanceKey(instanceKey)
    entry.state.userId = String(runtimeContext.runtimeUser?.id || entry.state.userId || '').trim()
    entry.state.runtimeUserName = String(
      runtimeContext.runtimeUser?.nickname || entry.state.runtimeUserName || ''
    ).trim()
    entry.state.channelId = normalizedRuntime.channelId || entry.state.channelId
    entry.state.channelName = normalizedRuntime.channelName
    entry.state.channelRuntime = normalizedRuntime
    entry.state.runtimeUserConfig = normalizeRuntimeUserConfig(runtimeContext)
    return normalizedRuntime
  }

  if (entry.state.channelRuntime) {
    return getSchedulerRuntime(instanceKey)
  }

  const resolvedRuntime = await resolveChannelRuntimeById(entry.state.channelId)
  entry.state.channelId = resolvedRuntime.channelId || entry.state.channelId
  entry.state.channelName = resolvedRuntime.channelName
  entry.state.channelRuntime = resolvedRuntime
  return resolvedRuntime
}

function getRuntimeJuliangConfig(instanceKey) {
  const runtime = getSchedulerRuntime(instanceKey)
  return {
    cookie: String(runtime.juliang.cookie || '').trim(),
    csrfToken: String(runtime.juliang.csrfToken || '').trim(),
  }
}

function getRuntimeChangduHeaders(instanceKey) {
  const runtime = getSchedulerRuntime(instanceKey)
  return {
    cookie: String(runtime.changdu.cookie || '').trim(),
    appId: String(runtime.changdu.appId || '40012555').trim(),
    appType: String(runtime.changdu.appType || '7').trim(),
    adUserId: String(runtime.changdu.adUserId || '380892546610362').trim(),
    rootAdUserId: String(
      runtime.changdu.rootAdUserId || runtime.changdu.adUserId || '380892546610362'
    ).trim(),
    distributorId: String(runtime.changdu.distributorId || '1842236883646506').trim(),
    agwJsConv: String(runtime.changdu.agwJsConv || 'str').trim(),
  }
}

function getOpenApiChannelConfig(channelId) {
  const runtime = getSchedulerRuntime(channelId)
  const runtimeDistributorId = String(runtime.changdu.distributorId || '').trim()
  const runtimeSecretKey = String(
    runtime.changdu.secretKey || runtime.buildConfig.secretKey || ''
  ).trim()

  if (runtimeDistributorId && runtimeSecretKey) {
    return {
      distributorId: runtimeDistributorId,
      secretKey: runtimeSecretKey,
    }
  }

  return {
    distributorId: CHANGDU_DISTRIBUTOR_ID,
    secretKey: CHANGDU_SECRET_KEY,
  }
}

// ============== 工具函数 ==============

/**
 * 延时函数
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 获取北京时间的今天/明天/后天日期
 */
function getDateRanges() {
  const now = new Date()
  // 转换为北京时间 (UTC+8)
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijingNow = new Date(now.getTime() + beijingOffset)

  const todayStart = new Date(beijingNow)
  todayStart.setUTCHours(0, 0, 0, 0)

  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const dayAfterTomorrowStart = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000)
  const dayAfterTomorrowEnd = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)

  return {
    today: todayStart,
    tomorrow: tomorrowStart,
    dayAfterTomorrow: dayAfterTomorrowStart,
    dayAfterTomorrowEnd: dayAfterTomorrowEnd,
    // 用于API请求的时间戳（秒）
    startTime: Math.floor((todayStart.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000),
    endTime: Math.floor(dayAfterTomorrowEnd.getTime() / 1000),
  }
}

/**
 * 判断两个日期是否是同一天（北京时间）
 */
function isSameDay(date1, date2) {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  )
}

/**
 * 格式化日期为可读字符串
 */
function formatDate(date) {
  const d = new Date(date)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// ============== 状态持久化 ==============

/**
 * 保存状态到文件
 */
async function saveState(channelId) {
  try {
    const entry = ensureSchedulerEntry(channelId)
    const stateFilePath = getStateFilePath(channelId)
    const dir = path.dirname(stateFilePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(stateFilePath, JSON.stringify(entry.state, null, 2))
  } catch (error) {
    console.error(`[自动提交-${channelId}] 保存状态失败:`, error.message)
  }
}

/**
 * 加载状态
 */
async function loadState(channelId) {
  try {
    const entry = ensureSchedulerEntry(channelId)
    const stateFilePath = getStateFilePath(channelId)
    const data = await fs.readFile(stateFilePath, 'utf-8')
    const savedState = JSON.parse(data)
    entry.state = { ...entry.state, ...savedState }
    console.log(`[自动提交-${channelId}] 已加载保存的状态`)
  } catch {
    console.log(`[自动提交-${channelId}] 未找到状态文件，使用默认状态`)
  }
}

/**
 * 迁移旧状态文件到新的按渠道实例分离的文件
 */
async function migrateOldState() {
  try {
    const data = await fs.readFile(OLD_STATE_FILE_PATH, 'utf-8')
    const oldState = JSON.parse(data)
    const channelId = String(oldState.channelId || 'default').trim() || 'default'
    const entry = ensureSchedulerEntry(channelId)
    entry.state = { ...entry.state, ...oldState, channelId }
    await saveState(channelId)
    console.log(`[自动提交] 已迁移旧状态文件到渠道 ${channelId}`)

    await fs.unlink(OLD_STATE_FILE_PATH)
    console.log('[自动提交] 已删除旧状态文件')
  } catch {
    // 旧文件不存在或读取失败，忽略
  }
}

/**
 * 添加任务历史记录
 */
function addTaskHistory(channelId, record) {
  const entry = ensureSchedulerEntry(channelId)
  entry.state.taskHistory.unshift({
    ...record,
    timestamp: new Date().toISOString(),
  })
  // 只保留最近50条
  if (entry.state.taskHistory.length > 50) {
    entry.state.taskHistory = entry.state.taskHistory.slice(0, 50)
  }
}

// ============== 飞书 API ==============

/**
 * 获取飞书 access token
 */
async function getFeishuAccessToken() {
  const response = await fetch(`${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.token_endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: FEISHU_CONFIG.app_id,
      app_secret: FEISHU_CONFIG.app_secret,
    }),
  })

  const data = await safeJsonParse(response, '获取飞书token')
  if (data.code !== 0) {
    throw new Error(`获取飞书 access token 失败: ${data.msg}`)
  }
  return data.tenant_access_token
}

/**
 * 搜索飞书剧集清单
 */
async function searchDramaList(channelId, dramaName) {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerProfile(channelId)

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${profile.dramaListTableId}/records/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        field_names: ['剧名', '上架时间'],
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: '剧名',
              operator: 'contains',
              value: [dramaName],
            },
          ],
        },
        page_size: 20,
      }),
    }
  )

  return safeJsonParse(response, '搜索剧集清单')
}
async function createDramaRecord(channelId, dramaName, publishTime, bookId, rating) {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerProfile(channelId)

  const fields = { 剧名: dramaName }

  if (bookId) {
    fields['短剧ID'] = bookId
  }

  if (publishTime) {
    try {
      const timestamp = new Date(publishTime).getTime()
      if (!isNaN(timestamp)) {
        fields['上架时间'] = timestamp
      }
    } catch {}
  }

  if (rating) {
    fields['评级'] = rating
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${profile.dramaListTableId}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields }),
    }
  )

  const result = await safeJsonParse(response, '创建剧集清单记录')
  if (result.code !== 0) {
    throw new Error(`创建剧集清单记录失败: ${result.msg}`)
  }
  return result
}

/**
 * 查询可用的虎鱼账户
 */
async function getAvailableChannelAccounts(channelId) {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerProfile(channelId)

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${profile.accountTableId}/records/search?ignore_consistency_check=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        field_names: ['账户', '是否已用'],
        page_size: 1000,
      }),
    }
  )

  const result = await safeJsonParse(response, '查询账户列表')
  if (result.code !== 0) {
    throw new Error(`查询账户列表失败: ${result.msg}`)
  }

  // 过滤出未使用的账户
  const accounts = result.data?.items || []
  const availableAccounts = accounts.filter(item => {
    const isUsed = item.fields?.['是否已用']
    // 未使用的账户：字段为空、为"否"或不存在
    return !isUsed || isUsed === '否' || (Array.isArray(isUsed) && isUsed.length === 0)
  })

  return availableAccounts
}

/**
 * 获取抖音素材配置（根据当前渠道）
 * @returns {string} 格式化后的抖音素材配置字符串
 */
async function getDouyinMaterialConfig(channelId) {
  const profile = getSchedulerProfile(channelId)
  return profile.douyinMaterialMatches
    .filter(match => match.douyinAccount && match.douyinAccountId && match.materialRange)
    .map(match => `${match.douyinAccount} ${match.douyinAccountId} ${match.materialRange}`)
    .join('\n')
}

/**
 * 获取第一个可用账户
 */
async function getFirstAvailableAccount(channelId) {
  const accounts = await getAvailableChannelAccounts(channelId)
  if (accounts.length === 0) {
    return null
  }

  const first = accounts[0]
  // 飞书返回的账户字段可能是数组格式 [{text: "xxx", type: "text"}] 或字符串
  const accountField = first.fields?.['账户']
  let accountValue = ''
  if (typeof accountField === 'string') {
    accountValue = accountField
  } else if (Array.isArray(accountField) && accountField[0]?.text) {
    accountValue = accountField[0].text
  }

  return {
    account: accountValue,
    recordId: first.record_id,
  }
}

/**
 * 创建剧集状态记录
 */
async function createDramaStatusRecord(channelId, params) {
  const { dramaName, publishTime, account, status, douyinMaterial, rating } = params
  const profile = getSchedulerProfile(channelId)
  const accessToken = await getFeishuAccessToken()

  // 计算日期时间戳（与前端逻辑一致）
  // 将首发时间转换为当天00:00:00的13位时间戳
  let dateTimestamp = Date.now()
  if (publishTime) {
    try {
      const dateOnly = publishTime.split(' ')[0] // 提取日期部分 YYYY-MM-DD
      const publishDateAtMidnight = new Date(`${dateOnly} 00:00:00`)

      // 获取今天00:00:00的时间戳
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTimestamp = today.getTime()

      // 如果首发时间早于今天00:00:00，则使用今天00:00:00的时间戳
      dateTimestamp =
        publishDateAtMidnight.getTime() < todayTimestamp
          ? todayTimestamp
          : publishDateAtMidnight.getTime()
    } catch {
      // 解析失败则使用当前时间
    }
  }

  const fields = {
    剧名: dramaName,
    当前状态: status || '待提交',
    日期: dateTimestamp,
  }

  if (account) {
    fields['账户'] = account
  }

  if (publishTime) {
    try {
      const timestamp = new Date(publishTime).getTime()
      if (!isNaN(timestamp)) {
        fields['上架时间'] = timestamp
      }
    } catch {}
  }

  if (douyinMaterial) {
    fields['抖音素材'] = douyinMaterial
  }

  if (rating) {
    fields['评级'] = rating
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${profile.dramaStatusTableId}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields }),
    }
  )

  const result = await safeJsonParse(response, '创建剧集状态记录')
  if (result.code !== 0) {
    console.error(`[自动提交-${channelId}] 创建剧集状态记录失败，请求字段:`, JSON.stringify(fields))
    console.error(`[自动提交-${channelId}] 飞书返回:`, JSON.stringify(result))
    throw new Error(`创建剧集状态记录失败: ${result.msg}`)
  }
  return result
}

/**
 * 更新账户使用状态
 */
async function updateAccountUsedStatus(channelId, recordId) {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerProfile(channelId)

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${profile.accountTableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fields: {
          是否已用: '是',
        },
      }),
    }
  )

  const result = await safeJsonParse(response, '更新账户状态')
  if (result.code !== 0) {
    throw new Error(`更新账户状态失败: ${result.msg}`)
  }
  return result
}

// ============== 常读平台 API ==============

/**
 * 获取新剧列表 - 使用常读开放平台 API（签名认证）
 * @param {Object} params - 请求参数
 * @param {number} params.pageIndex - 页码
 * @param {number} params.pageSize - 每页数量
 * @param {string} params.channelId - 当前渠道 ID
 */
async function getNewDramaList(params = {}) {
  const { pageIndex = 0, pageSize = 100, channelId, dramaListTableId } = params

  const { distributorId, secretKey } = getOpenApiChannelConfig(channelId)

  // 构建请求参数（与手动刷新一致）
  const requestParams = {
    distributor_id: distributorId,
    page_index: pageIndex,
    page_size: pageSize,
  }

  // 添加飞书清单表 ID（用于判断剧集是否已存在）
  if (dramaListTableId) {
    requestParams.drama_list_table_id = dramaListTableId
  }

  // 添加授权状态过滤
  if (AUTO_SUBMIT_CONFIG.filter.permissionStatuses) {
    requestParams.permission_statuses = AUTO_SUBMIT_CONFIG.filter.permissionStatuses
  }

  // 生成签名头部
  const { headers: signHeaders } = buildChangduGetHeaders(
    requestParams,
    undefined,
    distributorId,
    secretKey
  )

  // 构建查询字符串
  const queryString = new URLSearchParams(
    Object.entries(requestParams).map(([k, v]) => [k, String(v)])
  ).toString()

  // 请求常读开放平台 API（与手动刷新使用相同的 API）
  const apiUrl = `${CHANGDU_BASE_URL}/content/series/list/v1/?${queryString}`

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      ...signHeaders,
      'Content-Type': 'application/json',
    },
  })

  // 检查 HTTP 状态码
  if (!response.ok) {
    const text = await response.text()
    console.error(`[自动提交] 获取新剧列表 HTTP ${response.status}:`, text.substring(0, 200))
    throw new Error(`获取新剧列表: HTTP ${response.status} - ${response.statusText}`)
  }

  const apiResult = await safeJsonParse(response, '获取新剧列表')

  // 转换数据格式以保持兼容性
  // 新 API 返回: { code: 200, message, total, data: [] }
  // 转换为: { code: 0, data: { data: [], total } }
  if (apiResult.code === 200) {
    const transformedData = (apiResult.data || []).map(item => {
      const seriesInfo = item.series_info || {}
      return {
        ...seriesInfo,
        media_config: item.media_config,
        book_paywall: item.book_paywall,
        series_paywall: item.series_paywall,
        free_series_paywall: item.free_series_paywall,
        free_book_paywall: item.free_book_paywall,
        price_changed: item.price_changed,
        unit_price: item.unit_price,
        start_chapter: item.start_chapter,
        ad_episode: item.ad_episode,
        ad_word_number: item.ad_word_number,
        short_book_ad_episode: item.short_book_ad_episode,
      }
    })

    return {
      code: 0,
      message: apiResult.message || 'success',
      data: {
        data: transformedData,
        total: apiResult.total || 0,
      },
    }
  } else {
    // API 返回错误
    return {
      code: apiResult.code,
      message: apiResult.message || '请求失败',
      data: {
        data: [],
        total: 0,
      },
    }
  }
}

/**
 * 带重试的获取新剧列表
 */
async function getNewDramaListWithRetry(
  params,
  retries = AUTO_SUBMIT_CONFIG.pagination.maxRetries
) {
  try {
    const result = await getNewDramaList(params)

    // 检查是否是速率限制错误（兼容新旧 API 的错误码）
    const isRateLimited =
      (result.code === 500 || result.code === 429) &&
      (result.message?.includes('访问速度过快') || result.message?.includes('rate limit'))

    if (isRateLimited && retries > 0) {
      console.log(`[自动提交] 请求被限速，${AUTO_SUBMIT_CONFIG.pagination.retryDelay}ms后重试...`)
      await wait(AUTO_SUBMIT_CONFIG.pagination.retryDelay)
      return getNewDramaListWithRetry(params, retries - 1)
    }

    return result
  } catch (error) {
    // 网络错误等异常情况下的重试
    if (retries > 0) {
      console.log(
        `[自动提交] 请求失败: ${error.message}，${AUTO_SUBMIT_CONFIG.pagination.retryDelay}ms后重试...`
      )
      await wait(AUTO_SUBMIT_CONFIG.pagination.retryDelay)
      return getNewDramaListWithRetry(params, retries - 1)
    }
    throw error
  }
}

/**
 * 获取下载任务列表
 */
async function getDownloadTaskList(channelId, startTime, endTime) {
  const queryParams = new URLSearchParams({
    start_time: String(startTime),
    end_time: String(endTime),
    page_index: '0',
    page_size: '20000',
  })

  // 使用代理服务器
  const url = `https://www.changdunovel.com/node/api/platform/distributor/download_center/task_list/?${queryParams.toString()}`

  await ensureSchedulerRuntime(channelId)
  const changduHeaders = getRuntimeChangduHeaders(channelId)
  const cookie = changduHeaders.cookie

  const headerConfig = {
    Appid: changduHeaders.appId,
    Apptype: changduHeaders.appType,
    Aduserid: changduHeaders.adUserId,
    Rootaduserid: changduHeaders.rootAdUserId,
    Distributorid: changduHeaders.distributorId,
  }

  console.log(`[自动提交-${channelId}] task_list 请求头:`, {
    Distributorid: headerConfig.Distributorid,
    cookieLength: cookie.length,
  })

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...headerConfig,
      Cookie: cookie,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  return safeJsonParse(response, '获取下载任务列表')
}

// ============== 巨量 API ==============

/**
 * 更新巨量账户备注
 */
async function editJuliangAccountRemark(channelId, accountId, remark) {
  const juliangConfig = getRuntimeJuliangConfig(channelId)
  const response = await fetch(
    'https://business.oceanengine.com/nbs/api/bm/promotion/edit_account_remark',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: juliangConfig.cookie,
        'X-CSRFToken': juliangConfig.csrfToken,
      },
      body: JSON.stringify({ account_id: accountId, remark }),
    }
  )

  return safeJsonParse(response, '更新巨量账户备注')
}

// ============== 核心业务逻辑 ==============

/**
 * 获取并过滤今天/明天/后天的剧集
 */
async function fetchAutoSubmitDramas(channelId) {
  await ensureSchedulerRuntime(channelId)
  const dateRanges = getDateRanges()

  console.log(`[自动提交-${channelId}] ========== 获取剧集 ==========`)
  console.log(`[自动提交-${channelId}] 今天:`, formatDate(dateRanges.today))
  console.log(`[自动提交-${channelId}] 明天:`, formatDate(dateRanges.tomorrow))
  console.log(`[自动提交-${channelId}] 后天:`, formatDate(dateRanges.dayAfterTomorrow))

  const dramaListTableId = getSchedulerProfile(channelId).dramaListTableId
  const { batchSize, batchDelay, totalPages } = AUTO_SUBMIT_CONFIG.pagination

  // 并发获取下载任务列表
  const downloadResult = await getDownloadTaskList(
    channelId,
    dateRanges.startTime,
    dateRanges.endTime
  )
  const downloadList = downloadResult.data || []
  console.log(`[自动提交-${channelId}] 下载任务列表:`, downloadList.length, '条')

  // 分批获取剧集列表
  const dramaResults = []
  for (let batchStart = 0; batchStart < totalPages; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, totalPages)
    const batchPromises = Array.from({ length: batchEnd - batchStart }, (_, i) =>
      getNewDramaListWithRetry({
        pageIndex: batchStart + i,
        pageSize: 100,
        channelId,
        dramaListTableId,
      })
    )
    const batchResults = await Promise.all(batchPromises)
    dramaResults.push(...batchResults)

    if (batchEnd < totalPages) {
      await wait(batchDelay)
    }
  }

  // 合并并去重
  const allDramaData = dramaResults.flatMap(result => result.data?.data || [])
  const uniqueDramas = allDramaData.reduce((acc, drama) => {
    if (!acc.find(item => item.book_id === drama.book_id)) {
      acc.push(drama)
    }
    return acc
  }, [])

  console.log(`[自动提交-${channelId}] 去重后的剧集总数:`, uniqueDramas.length)

  // 过滤剧集
  const filteredDramas = uniqueDramas.filter(drama => {
    if (drama.dy_audit_status !== AUTO_SUBMIT_CONFIG.filter.dyAuditStatus) return false
    if (drama.episode_amount && drama.episode_amount < AUTO_SUBMIT_CONFIG.filter.minEpisodeAmount)
      return false
    return true
  })

  console.log(`[自动提交-${channelId}] 过滤后的剧集总数:`, filteredDramas.length)

  // 按日期分组
  const todayDramas = []
  const tomorrowDramas = []
  const dayAfterTomorrowDramas = []

  for (const drama of filteredDramas) {
    if (!drama.publish_time) continue

    const publishTime = new Date(drama.publish_time)

    if (isSameDay(publishTime, dateRanges.today)) {
      todayDramas.push(drama)
    } else if (isSameDay(publishTime, dateRanges.tomorrow)) {
      tomorrowDramas.push(drama)
    } else if (isSameDay(publishTime, dateRanges.dayAfterTomorrow)) {
      dayAfterTomorrowDramas.push(drama)
    }
  }

  console.log(`[自动提交-${channelId}] 今天的剧集数:`, todayDramas.length)
  console.log(`[自动提交-${channelId}] 明天的剧集数:`, tomorrowDramas.length)
  console.log(`[自动提交-${channelId}] 后天的剧集数:`, dayAfterTomorrowDramas.length)

  const newDramaSet = new Set()

  return {
    today: todayDramas,
    tomorrow: tomorrowDramas,
    dayAfterTomorrow: dayAfterTomorrowDramas,
    downloadList,
    newDramaSet,
  }
}

/**
 * 根据剧名获取下载数据
 */
function getDownloadDataForDrama(downloadList, dramaName) {
  const name = dramaName?.trim()
  if (!name) return null
  return downloadList.find(item => item.book_name?.trim() === name) || null
}

/**
 * 按优先级排序剧集
 */
function sortDramasByPriority(dramas, downloadList, newDramaSet) {
  return [...dramas].sort((a, b) => {
    // 优先级 1：红标剧（增剧）
    const aIsNew = newDramaSet.has(a.book_id)
    const bIsNew = newDramaSet.has(b.book_id)
    if (aIsNew !== bIsNew) return aIsNew ? -1 : 1

    // 优先级 2：飞书清单中不存在 && 下载中心有完成的任务
    const aDownloadData = getDownloadDataForDrama(downloadList, a.series_name)
    const bDownloadData = getDownloadDataForDrama(downloadList, b.series_name)
    const aCanAdd = !a.feishu_downloaded && !a.feishu_exists && aDownloadData?.task_status === 2
    const bCanAdd = !b.feishu_downloaded && !b.feishu_exists && bDownloadData?.task_status === 2
    if (aCanAdd !== bCanAdd) return aCanAdd ? -1 : 1

    return 0
  })
}

/**
 * 处理单部剧的提交
 */
async function processDrama(channelId, drama, downloadList, newDramaSet, options = {}) {
  await ensureSchedulerRuntime(channelId)
  const dramaName = drama.series_name
  const manualRedFlag = options.manualRedFlag === true

  try {
    // 1. 检查可用账户
    const availableAccount = await getFirstAvailableAccount(channelId)
    if (!availableAccount) {
      console.log(`[自动提交-${channelId}] 无可用账户，跳过: ${dramaName}`)
      return { success: false, reason: 'no_account' }
    }

    // 2. 搜索飞书剧集清单，检查是否已存在
    const searchResult = await searchDramaList(channelId, dramaName)
    if (searchResult.data && searchResult.data.total > 0) {
      const existingDrama = searchResult.data.items.find(item => {
        const itemDramaName = item.fields['剧名']?.[0]?.text
        return itemDramaName === dramaName
      })

      if (existingDrama) {
        console.log(`[自动提交-${channelId}] 剧集已存在，跳过: ${dramaName}`)
        return { success: false, reason: 'already_exists' }
      }
    }

    // 3. 确定评级
    const isRedFlagDrama = manualRedFlag || newDramaSet.has(drama.book_id)
    const rating = isRedFlagDrama ? '红标' : undefined

    // 4. 创建飞书剧集清单记录
    await createDramaRecord(channelId, dramaName, drama.publish_time, drama.book_id, rating)
    console.log(`[自动提交-${channelId}] 创建剧集清单记录成功: ${dramaName}`)

    // 5. 根据下载状态确定飞书状态
    const downloadData = getDownloadDataForDrama(downloadList, dramaName)
    const taskStatus = downloadData?.task_status
    const readyStatuses = AUTO_SUBMIT_CONFIG.taskStatus.readyStatuses
    const feishuStatus =
      taskStatus !== undefined && readyStatuses.includes(taskStatus) ? '待下载' : '待提交'

    // 6. 获取抖音素材配置（根据当前渠道）
    const douyinMaterial = await getDouyinMaterialConfig(channelId)

    // 7. 创建剧集状态记录
    await createDramaStatusRecord(channelId, {
      dramaName,
      publishTime: drama.publish_time,
      account: availableAccount.account,
      status: feishuStatus,
      douyinMaterial: douyinMaterial || undefined, // 如果为空字符串则传 undefined
      rating, // 传递评级参数
    })
    console.log(
      `[自动提交-${channelId}] 创建剧集状态记录成功，分配账户: ${availableAccount.account}`
    )

    // 9. 更新账户使用状态
    await updateAccountUsedStatus(channelId, availableAccount.recordId)

    // 10. 更新巨量账户备注
    if (availableAccount.account) {
      try {
        const remark = `小红-${dramaName}`
        await editJuliangAccountRemark(channelId, availableAccount.account, remark)
        console.log(`[自动提交-${channelId}] 更新巨量账户备注成功: ${availableAccount.account}`)
      } catch (juliangError) {
        console.error(`[自动提交-${channelId}] 更新巨量账户备注失败:`, juliangError.message)
      }
    }

    return { success: true }
  } catch (error) {
    console.error(`[自动提交-${channelId}] 处理失败: ${dramaName}`, error.message)
    return { success: false, reason: 'error', error: error.message }
  }
}

/**
 * 执行自动提交流程
 */
async function runAutoSubmitCycle(channelId) {
  const entry = ensureSchedulerEntry(channelId)
  const state = entry.state

  if (!state.enabled) return
  if (state.running) {
    console.log(`[自动提交-${channelId}] 上一轮仍在运行，跳过本次`)
    return
  }

  state.running = true
  state.currentTask = {
    startTime: new Date().toISOString(),
    status: 'running',
  }
  await saveState(channelId)

  try {
    console.log(`[自动提交-${channelId}] ========== 开始自动提交流程 ==========`)

    // 1. 获取并过滤剧集
    const { today, tomorrow, dayAfterTomorrow, downloadList, newDramaSet } =
      await fetchAutoSubmitDramas(channelId)

    // 2. 按日期分组处理
    const dateGroups = [
      { date: '今天', dramas: today },
      { date: '明天', dramas: tomorrow },
      { date: '后天', dramas: dayAfterTomorrow },
    ]

    let processedCount = 0
    let successCount = 0
    let failCount = 0
    let skipCount = 0

    for (const dateGroup of dateGroups) {
      if (!state.enabled) {
        console.log(`[自动提交-${channelId}] 已停止`)
        break
      }

      state.progress.currentDate = dateGroup.date

      // 3. 过滤符合条件的剧
      const eligibleDramas = dateGroup.dramas.filter(d => {
        // 条件1: 飞书清单中不存在
        if (d.feishu_downloaded || d.feishu_exists) return false

        // 条件2: 下载中心有完成的任务
        const downloadData = getDownloadDataForDrama(downloadList, d.series_name)
        if (!downloadData || downloadData.task_status !== 2) return false

        if (state.onlyRedFlag && !newDramaSet.has(d.book_id)) return false

        return true
      })

      if (eligibleDramas.length === 0) {
        console.log(`[自动提交-${channelId}] ${dateGroup.date}没有需要处理的剧集`)
        continue
      }

      // 4. 排序
      const sortedDramas = sortDramasByPriority(eligibleDramas, downloadList, newDramaSet)

      const filterMode = state.onlyRedFlag ? '仅红标剧' : '所有剧'
      console.log(
        `[自动提交-${channelId}] 开始处理${dateGroup.date}的剧集，共 ${sortedDramas.length} 部（筛选模式：${filterMode}）`
      )

      // 5. 依次处理
      state.progress.total = sortedDramas.length
      for (let i = 0; i < sortedDramas.length; i++) {
        if (!state.enabled) {
          console.log(`[自动提交-${channelId}] 已停止`)
          break
        }

        const drama = sortedDramas[i]
        state.progress.current = i + 1
        state.progress.currentDrama = drama.series_name
        await saveState(channelId)

        const redFlagLabel = newDramaSet.has(drama.book_id) ? ' [红标]' : ''
        console.log(
          `[自动提交-${channelId}] 处理第 ${i + 1}/${sortedDramas.length} 部：${drama.series_name}${redFlagLabel}`
        )

        const result = await processDrama(channelId, drama, downloadList, newDramaSet)
        processedCount++

        if (result.success) {
          successCount++
          console.log(`[自动提交-${channelId}] ✓ ${drama.series_name} 处理成功`)
        } else if (result.reason === 'already_exists' || result.reason === 'no_account') {
          skipCount++
        } else {
          failCount++
          console.log(
            `[自动提交-${channelId}] ✗ ${drama.series_name} 处理失败: ${result.error || result.reason}`
          )
        }

        // 等待 1 秒
        await wait(1000)
      }

      console.log(`[自动提交-${channelId}] ${dateGroup.date}的剧集处理完成`)
    }

    // 更新统计
    state.stats.totalProcessed += processedCount
    state.stats.successCount += successCount
    state.stats.failCount += failCount
    state.stats.skipCount += skipCount

    // 记录历史
    addTaskHistory(channelId, {
      status: 'completed',
      processed: processedCount,
      success: successCount,
      fail: failCount,
      skip: skipCount,
    })

    console.log(`[自动提交-${channelId}] ========== 自动提交流程完成 ==========`)
    console.log(
      `[自动提交-${channelId}] 本轮统计: 处理 ${processedCount}, 成功 ${successCount}, 失败 ${failCount}, 跳过 ${skipCount}`
    )
  } catch (error) {
    console.error(`[自动提交-${channelId}] 执行失败:`, error.message)
    addTaskHistory(channelId, {
      status: 'error',
      error: error.message,
    })
  } finally {
    state.running = false
    state.lastRunTime = new Date().toISOString()
    state.currentTask = null
    state.progress = { current: 0, total: 0, currentDate: '', currentDrama: '' }

    // 如果还启用，设置下次运行
    if (state.enabled) {
      scheduleNextRun(channelId)
    }

    await saveState(channelId)
  }
}

/**
 * 调度下次运行
 */
function scheduleNextRun(channelId) {
  const entry = ensureSchedulerEntry(channelId)
  const state = entry.state
  const intervalMs = state.intervalMinutes * 60 * 1000
  state.nextRunTime = new Date(Date.now() + intervalMs).toISOString()

  console.log(`[自动提交-${channelId}] 下次运行时间: ${state.nextRunTime}`)

  if (entry.timer) {
    clearTimeout(entry.timer)
  }

  entry.timer = setTimeout(() => {
    runAutoSubmitCycle(channelId)
  }, intervalMs)
}

// ============== 导出的控制函数 ==============

/**
 * 启动调度器
 */
export async function startScheduler(channelId, options = {}, runtimeContext = null) {
  const { intervalMinutes = 5, onlyRedFlag = false } = options

  const entry = ensureSchedulerEntry(channelId)
  const state = entry.state
  const runtime = await ensureSchedulerRuntime(channelId, runtimeContext)

  if (state.enabled) {
    console.log(`[自动提交-${channelId}] 调度器已经在运行`)
    return { success: false, message: '调度器已经在运行' }
  }

  state.enabled = true
  state.intervalMinutes = intervalMinutes
  state.onlyRedFlag = onlyRedFlag

  console.log(
    `[自动提交-${channelId}] 启动调度器，渠道: ${getChannelLabel(runtime)}，轮询间隔: ${intervalMinutes} 分钟`
  )
  console.log(`[自动提交-${channelId}] 仅红标: ${onlyRedFlag}`)

  await saveState(channelId)

  // 立即执行一次
  runAutoSubmitCycle(channelId)

  return { success: true, message: '调度器已启动' }
}

/**
 * 停止调度器
 */
export async function stopScheduler(channelId) {
  console.log(`[自动提交-${channelId}] 停止调度器`)

  const entry = ensureSchedulerEntry(channelId)
  const state = entry.state

  state.enabled = false
  state.running = false
  state.nextRunTime = null
  state.currentTask = null
  state.progress = { current: 0, total: 0, currentDate: '', currentDrama: '' }

  if (entry.timer) {
    clearTimeout(entry.timer)
    entry.timer = null
  }

  await saveState(channelId)

  return { success: true, message: '调度器已停止' }
}

/**
 * 获取调度器状态
 */
export function getSchedulerStatus(channelId) {
  const state = ensureSchedulerEntry(channelId).state
  return {
    instanceKey: state.instanceKey,
    userId: state.userId,
    runtimeUserName: state.runtimeUserName,
    channelId: state.channelId,
    channelName: state.channelName,
    enabled: state.enabled,
    running: state.running,
    intervalMinutes: state.intervalMinutes,
    onlyRedFlag: state.onlyRedFlag,
    nextRunTime: toBeijingTime(state.nextRunTime),
    lastRunTime: toBeijingTime(state.lastRunTime),
    stats: state.stats,
    progress: state.progress,
    taskHistory: state.taskHistory.slice(0, 10).map(task => ({
      ...task,
      timestamp: toBeijingTime(task.timestamp),
    })),
  }
}

/**
 * 手动触发一次执行
 */
export async function triggerManualRun(channelId, runtimeContext = null) {
  const runtime = await ensureSchedulerRuntime(channelId, runtimeContext)
  const entry = ensureSchedulerEntry(channelId)
  const state = entry.state

  if (state.running) {
    return { success: false, message: '当前正在运行中' }
  }

  console.log(`[自动提交-${channelId}] 手动触发执行，渠道: ${getChannelLabel(runtime)}`)

  // 临时启用以执行一次
  const wasEnabled = state.enabled
  state.enabled = true

  await runAutoSubmitCycle(channelId)

  // 如果之前未启用，恢复状态
  if (!wasEnabled) {
    state.enabled = false
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
  }

  return { success: true, message: '手动执行完成' }
}

/**
 * 重置统计数据
 */
export async function resetStats(channelId) {
  const state = ensureSchedulerEntry(channelId).state

  state.stats = {
    totalProcessed: 0,
    successCount: 0,
    failCount: 0,
    skipCount: 0,
  }
  state.taskHistory = []
  await saveState(channelId)
  return { success: true, message: '统计已重置' }
}

/**
 * 初始化调度器（服务启动时调用）
 */
export async function initScheduler() {
  // 尝试迁移旧状态文件
  await migrateOldState()
  const keys = await listPersistedInstanceKeys()
  await Promise.all(keys.map(instanceKey => loadState(instanceKey)))

  for (const instanceKey of Object.keys(schedulers)) {
    const entry = ensureSchedulerEntry(instanceKey)
    await ensureSchedulerRuntime(instanceKey)
    entry.state.running = false
    entry.state.progress = { current: 0, total: 0, currentDate: '', currentDrama: '' }

    if (entry.state.enabled) {
      console.log(`[自动提交-${instanceKey}] 恢复之前的调度状态`)
      scheduleNextRun(instanceKey)
    }
  }
}

/**
 * 批量提交剧集（购物车使用）- 实际执行函数
 * @param {Array} items - 剧集列表
 */
async function executeBatchSubmit(items, runtimeContext = null) {
  console.log(`[批量提交] 开始处理 ${items.length} 部剧集`)

  const results = []
  let successCount = 0
  let failedCount = 0

  // 获取下载任务列表（用于判断下载状态）
  const dateRanges = getDateRanges()
  const channelId = runtimeContext?.channelRuntime?.channelId || 'default'
  const downloadListCache = {}

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const dramaName = item.series_name

    try {
      console.log(`[批量提交] 处理第 ${i + 1}/${items.length} 部：${dramaName}`)

      await ensureSchedulerRuntime(channelId, runtimeContext)

      if (!downloadListCache[channelId]) {
        const downloadResult = await getDownloadTaskList(
          channelId,
          dateRanges.startTime,
          dateRanges.endTime
        )
        downloadListCache[channelId] = downloadResult.data || []
      }

      const downloadList = downloadListCache[channelId]

      // 构造剧集对象
      const drama = {
        book_id: item.book_id,
        series_name: item.series_name,
        publish_time: item.publish_time,
      }

      // 调用处理单部剧的函数
      const result = await processDrama(channelId, drama, downloadList, new Set(), {
        manualRedFlag: item.manualRedFlag,
      })

      if (result.success) {
        successCount++
        results.push({
          book_id: item.book_id,
          series_name: item.series_name,
          success: true,
        })
        console.log(`[批量提交] ✓ ${dramaName} 提交成功`)
      } else {
        failedCount++
        results.push({
          book_id: item.book_id,
          series_name: item.series_name,
          success: false,
          error: result.reason || result.error || '提交失败',
        })
        console.log(`[批量提交] ✗ ${dramaName} 提交失败: ${result.reason || result.error}`)
      }

      // 每个剧集之间等待 1 秒
      if (i < items.length - 1) {
        await wait(1000)
      }
    } catch (error) {
      failedCount++
      results.push({
        book_id: item.book_id,
        series_name: item.series_name,
        success: false,
        error: error.message,
      })
      console.error(`[批量提交] ✗ ${dramaName} 处理异常:`, error.message)
    }
  }

  console.log(
    `[批量提交] 完成！总计 ${items.length} 部，成功 ${successCount} 部，失败 ${failedCount} 部`
  )

  return {
    total: items.length,
    success: successCount,
    failed: failedCount,
    results,
  }
}

/**
 * 批量提交剧集（购物车使用）- 立即返回，后台异步执行
 * @param {Array} items - 剧集列表
 * @returns {Object} 任务ID和状态
 */
export function batchSubmitDramas(items, runtimeContext = null) {
  const taskId = `batch-${Date.now()}`

  console.log(`[批量提交] 创建任务 ${taskId}，共 ${items.length} 部剧集`)

  // 异步执行，不等待结果
  executeBatchSubmit(items, runtimeContext)
    .then(result => {
      console.log(`[批量提交] 任务 ${taskId} 完成:`, result)
    })
    .catch(error => {
      console.error(`[批量提交] 任务 ${taskId} 失败:`, error)
    })

  // 立即返回任务信息
  return {
    taskId,
    status: 'processing',
    total: items.length,
    message: '任务已提交，正在后台处理',
  }
}
