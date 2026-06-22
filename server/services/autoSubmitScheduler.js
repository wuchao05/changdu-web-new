/**
 * 自动提交下载后台调度服务
 * 将前端的自动提交下载功能迁移到服务端，支持定时轮询、状态持久化
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { AsyncLocalStorage } from 'async_hooks'
import { FEISHU_CONFIG } from '../config/feishu.js'
import { AUTO_SUBMIT_CONFIG } from '../config/autoSubmit.js'
import { buildChangduGetHeaders } from '../utils/changduSign.js'
import { CHANGDU_BASE_URL, CHANGDU_DISTRIBUTOR_ID, CHANGDU_SECRET_KEY } from '../config/changdu.js'
import { requestChangduInternalApi } from '../utils/changduInternalApi.js'
import {
  getChannelLabel,
  normalizeChannelRuntime,
  resolveChannelRuntimeById,
} from '../utils/channelRuntime.js'
import {
  buildRuntimeInstanceKey,
  normalizeRuntimeInstanceKey,
  parseRuntimeInstanceKey,
  patchRuntimeIdentityFromInstanceKey,
} from '../utils/runtimeInstance.js'
import { resolveDownloadCenterRequestHeaders } from '../utils/downloadCenterHeaders.js'
import { createScopedConsole } from '../utils/serviceLogger.js'
import { findUsersByChannelId } from '../utils/studioData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const autoSubmitLogContext = new AsyncLocalStorage()

function runWithAutoSubmitLogContext(context, runner) {
  return autoSubmitLogContext.run(context || {}, runner)
}

function buildAutoSubmitLogContext(instanceKey = '', runtimeContext = null) {
  return {
    instanceKey: String(instanceKey || runtimeContext?.channelRuntime?.channelId || '').trim(),
    runtimeUserName: String(runtimeContext?.runtimeUser?.nickname || '').trim(),
    userId: String(runtimeContext?.runtimeUser?.id || '').trim(),
    channelName: String(runtimeContext?.channelRuntime?.channelName || '').trim(),
    channelId: String(runtimeContext?.channelRuntime?.channelId || '').trim(),
  }
}

function parseInstanceKeyFromLogArgs(args = []) {
  const firstArg = args[0]
  if (typeof firstArg !== 'string') {
    return ''
  }

  const match = firstArg.match(/^\[(?:自动提交|批量提交)-([^\]]+)\]/)
  return String(match?.[1] || '').trim()
}

function resolveLogProfileFromContext(args = []) {
  const context = autoSubmitLogContext.getStore() || {}
  const instanceKey = String(context.instanceKey || parseInstanceKeyFromLogArgs(args) || '').trim()
  let profile = {}

  if (instanceKey) {
    const schedulerProfile = getSchedulerProfile(instanceKey)
    profile = {
      runtimeUserName: schedulerProfile.runtimeUserName,
      userId: schedulerProfile.userId,
      channelName: schedulerProfile.channelName,
      channelId: schedulerProfile.channelId,
    }
  }

  return {
    runtimeUserName: profile.runtimeUserName || context.runtimeUserName || '',
    userId: profile.userId || context.userId || '',
    channelName: profile.channelName || context.channelName || '',
    channelId: profile.channelId || context.channelId || '',
  }
}

function resolveLogScope(args = []) {
  const firstArg = args[0]
  if (typeof firstArg === 'string' && firstArg.startsWith('[批量提交')) {
    return '批量提交'
  }
  return '自动提交'
}

const serviceConsole = createScopedConsole(
  '自动提交',
  args => resolveLogProfileFromContext(args),
  args => resolveLogScope(args)
)
const ALL_FEISHU_TABLE_GROUP_ID = '__all__'
const AUTO_RED_FLAG_START_HOUR = 0
const AUTO_RED_FLAG_END_HOUR = 1
const FEISHU_DRAMA_STATUS_CHUNK_SIZE = 40
const CHANGDU_INTERNAL_NEW_DRAMA_PATH = '/novelsale/distributor/content/series/list/v1/'

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

function getBeijingPublishHour(publishTime) {
  if (!publishTime) return null

  const publishText = String(publishTime).trim()
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(publishText)

  if (hasExplicitTimezone) {
    const date = new Date(publishText)
    if (Number.isNaN(date.getTime())) return null

    const hourText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date)
    return Number(hourText)
  }

  const timeMatch = publishText.match(/(?:T|\s)(\d{1,2}):\d{2}(?::\d{2})?/)
  if (!timeMatch) return null

  return Number(timeMatch[1])
}

function isAutoRedFlagPublishTime(publishTime) {
  const publishHour = getBeijingPublishHour(publishTime)
  if (!Number.isInteger(publishHour)) return false

  return publishHour >= AUTO_RED_FLAG_START_HOUR && publishHour <= AUTO_RED_FLAG_END_HOUR
}

function isRedFlagDrama(drama, newDramaSet = new Set(), options = {}) {
  return (
    options.manualRedFlag === true ||
    options.autoRedFlag === true ||
    drama?.auto_red_flag === true ||
    newDramaSet.has(drama?.book_id) ||
    isAutoRedFlagPublishTime(drama?.publish_time)
  )
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
    serviceConsole.error(
      `[自动提交] ${context} 响应为空, HTTP状态: ${status}, URL: ${response.url}`
    )
    throw new Error(`${context ? context + ': ' : ''}响应为空 (HTTP ${status})`)
  }
  try {
    return JSON.parse(text)
  } catch (e) {
    serviceConsole.error(
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
      feishuTableGroups: [],
      brandName: '小红',
      douyinMaterialMatches: [],
    },
    enabled: false,
    intervalMinutes: 5,
    nextRunTime: null,
    lastRunTime: null,
    running: false,
    onlyRedFlag: false,
    runOnce: false,
    submitRangeDays: 3,
    feishuTableGroupId: '',
    nextFeishuTableGroupIndex: 0,
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
  const feishuTableGroups = Array.isArray(runtimeUser.feishuTableGroups)
    ? runtimeUser.feishuTableGroups
        .map((group, index) => ({
          id: String(group?.id || (index === 0 ? 'default' : `group-${index + 1}`)).trim(),
          name: String(group?.name || (index === 0 ? '默认表格' : `表格组 ${index + 1}`)).trim(),
          enabled: group?.enabled !== false,
          feishu: {
            dramaListTableId: String(group?.feishu?.dramaListTableId || '').trim(),
            dramaStatusTableId: String(group?.feishu?.dramaStatusTableId || '').trim(),
            accountTableId: String(group?.feishu?.accountTableId || '').trim(),
          },
          douyinMaterialMatches: Array.isArray(group?.douyinMaterialMatches)
            ? group.douyinMaterialMatches.map(item => ({
                douyinAccount: String(item?.douyinAccount || '').trim(),
                douyinAccountId: String(item?.douyinAccountId || '').trim(),
                materialRange: String(item?.materialRange || '').trim(),
              }))
            : [],
        }))
        .filter(group => group.enabled)
    : []

  return {
    feishu: {
      dramaListTableId: String(runtimeUser.feishu?.dramaListTableId || '').trim(),
      dramaStatusTableId: String(runtimeUser.feishu?.dramaStatusTableId || '').trim(),
      accountTableId: String(runtimeUser.feishu?.accountTableId || '').trim(),
    },
    feishuTableGroups,
    brandName: String(runtimeUser.brandName || '小红').trim() || '小红',
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

function getSchedulerFeishuTableGroups(instanceKey) {
  const entry = ensureSchedulerEntry(instanceKey)
  const runtimeUserConfig = entry.state.runtimeUserConfig || createDefaultState().runtimeUserConfig
  const groups = Array.isArray(runtimeUserConfig.feishuTableGroups)
    ? runtimeUserConfig.feishuTableGroups.filter(group => group.enabled !== false)
    : []

  if (groups.length > 0) {
    return groups.map((group, index) => ({
      id: group.id || (index === 0 ? 'default' : `group-${index + 1}`),
      name: group.name || (index === 0 ? '默认表格' : `表格组 ${index + 1}`),
      dramaListTableId: group.feishu?.dramaListTableId || FEISHU_CONFIG.table_ids.drama_list,
      dramaStatusTableId: group.feishu?.dramaStatusTableId || FEISHU_CONFIG.table_ids.drama_status,
      accountTableId: group.feishu?.accountTableId || FEISHU_CONFIG.table_ids.account,
      douyinMaterialMatches: Array.isArray(group.douyinMaterialMatches)
        ? group.douyinMaterialMatches
        : [],
    }))
  }

  const profile = getSchedulerProfile(instanceKey)
  return [
    {
      id: 'default',
      name: '默认表格',
      dramaListTableId: profile.dramaListTableId,
      dramaStatusTableId: profile.dramaStatusTableId,
      accountTableId: profile.accountTableId,
      douyinMaterialMatches: profile.douyinMaterialMatches,
    },
  ]
}

function getSchedulerFeishuTableGroupProfile(instanceKey, tableGroupId = '') {
  const groups = getSchedulerFeishuTableGroups(instanceKey)
  const normalizedGroupId = String(tableGroupId || '').trim()
  return groups.find(group => group.id === normalizedGroupId) || groups[0]
}

function isAllFeishuTableGroupTarget(tableGroupId = '') {
  return String(tableGroupId || '').trim() === ALL_FEISHU_TABLE_GROUP_ID
}

function getSchedulerFeishuTableGroupById(instanceKey, tableGroupId = '') {
  const normalizedGroupId = String(tableGroupId || '').trim()
  return (
    getSchedulerFeishuTableGroups(instanceKey).find(group => group.id === normalizedGroupId) || null
  )
}

async function ensureSchedulerRuntime(instanceKey, runtimeContext = null) {
  const entry = ensureSchedulerEntry(instanceKey)
  patchRuntimeIdentityFromInstanceKey(entry.state, instanceKey)

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
    buildConfig: runtime.buildConfig || {},
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

async function getDownloadCenterTaskListHeaders(channelId) {
  await ensureSchedulerRuntime(channelId)
  const runtimeHeaders = getRuntimeChangduHeaders(channelId)
  return resolveDownloadCenterRequestHeaders({
    appid: runtimeHeaders.appId,
    apptype: runtimeHeaders.appType,
    distributorid: runtimeHeaders.distributorId,
    Aduserid: runtimeHeaders.adUserId,
    Rootaduserid: runtimeHeaders.rootAdUserId,
    Cookie: runtimeHeaders.cookie,
  })
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

function buildSchedulerInternalRequestContext(channelId) {
  const entry = ensureSchedulerEntry(channelId)
  const runtime = getSchedulerRuntime(channelId)

  return {
    state: {
      authContext: {
        channel: {
          id: runtime.channelId,
          name: runtime.channelName,
          changdu: {
            cookie: runtime.changdu.cookie,
            distributorId: runtime.changdu.distributorId,
            adUserId: runtime.changdu.adUserId,
            rootAdUserId: runtime.changdu.rootAdUserId,
            appId: runtime.changdu.appId,
            appType: runtime.changdu.appType,
            agwJsConv: runtime.changdu.agwJsConv,
          },
          juliang: {
            cookie: runtime.juliang.cookie,
            buildConfig: runtime.buildConfig,
          },
        },
        runtimeUser: entry.state.runtimeUserConfig,
      },
    },
    get(headerName) {
      if (String(headerName || '').toLowerCase() === 'x-studio-channel-id') {
        return runtime.channelId
      }
      return ''
    },
  }
}

function getSchedulerBrandName(channelId) {
  return (
    String(ensureSchedulerEntry(channelId).state.runtimeUserConfig?.brandName || '小红').trim() ||
    '小红'
  )
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
function getDateRanges(submitRangeDays = 3) {
  const normalizedRangeDays = [1, 2, 3].includes(Number(submitRangeDays))
    ? Number(submitRangeDays)
    : 3
  const now = new Date()
  // 转换为北京时间 (UTC+8)
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijingNow = new Date(now.getTime() + beijingOffset)

  const todayStart = new Date(beijingNow)
  todayStart.setUTCHours(0, 0, 0, 0)

  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const dayAfterTomorrowStart = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000)
  const dayAfterTomorrowEnd = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)
  const rangeEnd =
    normalizedRangeDays === 1
      ? tomorrowStart
      : normalizedRangeDays === 2
        ? dayAfterTomorrowStart
        : dayAfterTomorrowEnd

  return {
    today: todayStart,
    tomorrow: tomorrowStart,
    dayAfterTomorrow: dayAfterTomorrowStart,
    dayAfterTomorrowEnd: dayAfterTomorrowEnd,
    submitRangeDays: normalizedRangeDays,
    // 用于API请求的时间戳（秒）
    startTime: Math.floor((todayStart.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000),
    endTime: Math.floor(rangeEnd.getTime() / 1000),
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
    serviceConsole.error(`[自动提交-${channelId}] 保存状态失败:`, error.message)
  }
}

async function removeStateFile(instanceKey) {
  try {
    await fs.unlink(getStateFilePath(instanceKey))
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
}

async function stateFileExists(instanceKey) {
  try {
    await fs.access(getStateFilePath(instanceKey))
    return true
  } catch {
    return false
  }
}

function selectLegacyStateOwner(users = [], channelId = '') {
  const normalizedChannelId = String(channelId || '').trim()
  const defaultChannelUsers = users.filter(
    user => String(user.defaultChannelId || '').trim() === normalizedChannelId
  )
  const nonAdminDefaultUsers = defaultChannelUsers.filter(user => user.userType !== 'admin')
  if (nonAdminDefaultUsers.length === 1) {
    return nonAdminDefaultUsers[0]
  }
  if (defaultChannelUsers.length === 1) {
    return defaultChannelUsers[0]
  }

  const nonAdminUsers = users.filter(user => user.userType !== 'admin')
  if (nonAdminUsers.length === 1) {
    return nonAdminUsers[0]
  }
  if (users.length === 1) {
    return users[0]
  }

  return null
}

async function resolvePersistedInstanceKey(instanceKey, savedState = {}) {
  const normalizedInstanceKey = normalizeRuntimeInstanceKey(instanceKey)
  const parsedIdentity = parseRuntimeInstanceKey(normalizedInstanceKey)
  const stateUserId = String(savedState.userId || '').trim()
  const stateChannelId = String(savedState.channelId || parsedIdentity.channelId || '').trim()

  if (parsedIdentity.userId && parsedIdentity.userId !== 'anonymous' && stateChannelId) {
    return normalizedInstanceKey
  }

  if (stateUserId && stateChannelId) {
    return buildRuntimeInstanceKey({
      userId: stateUserId,
      channelId: stateChannelId,
    })
  }

  if (!stateChannelId) {
    return normalizedInstanceKey
  }

  const matchedUsers = await findUsersByChannelId(stateChannelId)
  const owner = selectLegacyStateOwner(matchedUsers, stateChannelId)
  if (!owner) {
    return normalizedInstanceKey
  }

  return buildRuntimeInstanceKey({
    userId: owner.id,
    channelId: stateChannelId,
  })
}

/**
 * 加载状态
 */
async function loadState(instanceKey) {
  return runWithAutoSubmitLogContext({ instanceKey }, async () => {
    try {
      const stateFilePath = getStateFilePath(instanceKey)
      const data = await fs.readFile(stateFilePath, 'utf-8')
      const savedState = JSON.parse(data)
      const resolvedInstanceKey = await resolvePersistedInstanceKey(instanceKey, savedState)

      if (resolvedInstanceKey !== normalizeRuntimeInstanceKey(instanceKey)) {
        const resolvedStateExists = await stateFileExists(resolvedInstanceKey)
        if (resolvedStateExists) {
          await removeStateFile(instanceKey)
          return loadState(resolvedInstanceKey)
        }
      }

      const entry = ensureSchedulerEntry(resolvedInstanceKey)
      entry.state = {
        ...entry.state,
        ...savedState,
        instanceKey: normalizeRuntimeInstanceKey(resolvedInstanceKey),
      }
      patchRuntimeIdentityFromInstanceKey(entry.state, resolvedInstanceKey)
      await ensureSchedulerRuntime(resolvedInstanceKey)

      if (resolvedInstanceKey !== normalizeRuntimeInstanceKey(instanceKey)) {
        await saveState(resolvedInstanceKey)
        await removeStateFile(instanceKey)
        serviceConsole.log(
          `[自动提交-${resolvedInstanceKey}] 已迁移旧实例状态: ${instanceKey} -> ${resolvedInstanceKey}`
        )
      }

      serviceConsole.log(`[自动提交-${resolvedInstanceKey}] 已加载保存的状态`)
    } catch {
      serviceConsole.log(`[自动提交-${instanceKey}] 未找到状态文件，使用默认状态`)
    }
  })
}

/**
 * 迁移旧状态文件到新的按渠道实例分离的文件
 */
async function migrateOldState() {
  try {
    const data = await fs.readFile(OLD_STATE_FILE_PATH, 'utf-8')
    const oldState = JSON.parse(data)
    const channelId = String(oldState.channelId || 'default').trim() || 'default'
    await runWithAutoSubmitLogContext(buildAutoSubmitLogContext(channelId), async () => {
      const entry = ensureSchedulerEntry(channelId)
      entry.state = { ...entry.state, ...oldState, channelId }
      await saveState(channelId)
      serviceConsole.log(`[自动提交-${channelId}] 已迁移旧状态文件到渠道 ${channelId}`)

      await fs.unlink(OLD_STATE_FILE_PATH)
      serviceConsole.log(`[自动提交-${channelId}] 已删除旧状态文件`)
    })
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
async function searchDramaList(channelId, dramaName, tableGroupId = '') {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerFeishuTableGroupProfile(channelId, tableGroupId)

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

function normalizeDramaName(name) {
  return String(name || '').trim()
}

function getFeishuTextFieldValue(field) {
  if (typeof field === 'string') {
    return field.trim()
  }

  if (Array.isArray(field)) {
    return field
      .map(item => String(item?.text || ''))
      .join('')
      .trim()
  }

  if (field?.value) {
    if (typeof field.value === 'string') {
      return field.value.trim()
    }

    if (Array.isArray(field.value)) {
      return field.value
        .map(item => String(item?.text || ''))
        .join('')
        .trim()
    }
  }

  return ''
}

function isFeishuDownloadedField(field) {
  return getFeishuTextFieldValue(field) === '是'
}

function normalizeFeishuStatusDramas(dramas = []) {
  const seenBookIds = new Set()

  return (Array.isArray(dramas) ? dramas : [])
    .map(item => ({
      book_id: String(item?.book_id || '').trim(),
      series_name: normalizeDramaName(item?.series_name || item?.book_name),
    }))
    .filter(item => item.book_id && item.series_name)
    .filter(item => {
      if (seenBookIds.has(item.book_id)) {
        return false
      }
      seenBookIds.add(item.book_id)
      return true
    })
}

async function searchFeishuDramaListByNames(accessToken, tableId, dramaNames) {
  const names = dramaNames.map(normalizeDramaName).filter(Boolean)
  if (names.length === 0) {
    return []
  }

  let pageToken = ''
  const items = []

  do {
    const searchUrl = new URL(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${tableId}/records/search`
    )
    if (pageToken) {
      searchUrl.searchParams.set('page_token', pageToken)
    }

    const response = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        field_names: ['剧名', '是否已下载'],
        filter: {
          conjunction: 'or',
          conditions: names.map(name => ({
            field_name: '剧名',
            operator: 'contains',
            value: [name],
          })),
        },
        page_size: 500,
      }),
    })

    const result = await safeJsonParse(response, '批量查询飞书剧集清单')
    if (result.code !== 0) {
      throw new Error(result.msg || result.message || '批量查询飞书剧集清单失败')
    }

    items.push(...(Array.isArray(result.data?.items) ? result.data.items : []))
    pageToken = String(result.data?.page_token || '')
  } while (pageToken)

  return items
}

async function queryFeishuDramaStatusByNames(tableId, dramas) {
  const normalizedDramas = normalizeFeishuStatusDramas(dramas)
  if (!tableId || normalizedDramas.length === 0) {
    return []
  }

  const accessToken = await getFeishuAccessToken()
  const statusByName = new Map()
  const uniqueNames = [...new Set(normalizedDramas.map(item => item.series_name))]

  for (let index = 0; index < uniqueNames.length; index += FEISHU_DRAMA_STATUS_CHUNK_SIZE) {
    const chunkNames = uniqueNames.slice(index, index + FEISHU_DRAMA_STATUS_CHUNK_SIZE)
    const items = await searchFeishuDramaListByNames(accessToken, tableId, chunkNames)

    items.forEach(item => {
      const dramaName = normalizeDramaName(getFeishuTextFieldValue(item.fields?.['剧名']))
      if (!dramaName || !chunkNames.includes(dramaName)) {
        return
      }

      const current = statusByName.get(dramaName) || {
        feishu_exists: false,
        feishu_downloaded: false,
      }

      statusByName.set(dramaName, {
        feishu_exists: true,
        feishu_downloaded:
          current.feishu_downloaded || isFeishuDownloadedField(item.fields?.['是否已下载']),
      })
    })
  }

  return normalizedDramas.map(drama => {
    const status = statusByName.get(drama.series_name)

    return {
      book_id: drama.book_id,
      series_name: drama.series_name,
      feishu_exists: status?.feishu_exists === true,
      feishu_downloaded: status?.feishu_downloaded === true,
    }
  })
}

async function hydrateAutoSubmitFeishuStatus(channelId, dramas, feishuTableGroupId = '') {
  const normalizedDramas = normalizeFeishuStatusDramas(dramas)
  if (normalizedDramas.length === 0) {
    return dramas
  }

  const groups = isAllFeishuTableGroupTarget(feishuTableGroupId)
    ? getSchedulerFeishuTableGroups(channelId)
    : feishuTableGroupId
      ? [getSchedulerFeishuTableGroupById(channelId, feishuTableGroupId)].filter(Boolean)
      : getSchedulerFeishuTableGroups(channelId)

  if (groups.length === 0) {
    return dramas
  }

  const statusResults = await Promise.all(
    groups.map(async group => ({
      group,
      statuses: await queryFeishuDramaStatusByNames(group.dramaListTableId, normalizedDramas),
    }))
  )

  const statusMapByGroup = statusResults.map(({ statuses }) => {
    const map = new Map()
    statuses.forEach(status => {
      map.set(status.book_id, status)
    })
    return map
  })

  const hydratedDramas = dramas.map(drama => {
    const bookId = String(drama?.book_id || '').trim()
    const statuses = statusMapByGroup
      .map(map => map.get(bookId))
      .filter(status => status?.series_name === normalizeDramaName(drama?.series_name))

    if (statuses.length === 0) {
      return {
        ...drama,
        feishu_exists: false,
        feishu_downloaded: false,
      }
    }

    const existsFlags = statuses.map(status => status.feishu_exists === true)
    const downloadedFlags = statuses.map(status => status.feishu_downloaded === true)
    const shouldFilterWhenExists = isAllFeishuTableGroupTarget(feishuTableGroupId)
      ? existsFlags.length === groups.length && existsFlags.every(Boolean)
      : existsFlags.some(Boolean)

    return {
      ...drama,
      feishu_exists: shouldFilterWhenExists,
      feishu_downloaded: downloadedFlags.some(Boolean),
    }
  })

  const skippedCount = hydratedDramas.filter(drama => drama.feishu_exists).length
  serviceConsole.log(
    `[自动提交-${channelId}] 飞书状态前置过滤: 已存在 ${skippedCount} 部，剩余 ${hydratedDramas.length - skippedCount} 部`
  )

  return hydratedDramas
}
async function createDramaRecord(
  channelId,
  dramaName,
  publishTime,
  bookId,
  rating,
  tableGroupId = ''
) {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerFeishuTableGroupProfile(channelId, tableGroupId)

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
async function getAvailableChannelAccounts(channelId, tableGroupId = '') {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerFeishuTableGroupProfile(channelId, tableGroupId)

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

function isAccountRecycleEnabled(channelId) {
  return Boolean(getSchedulerRuntime(channelId).buildConfig?.recycleAccountsWhenExhausted)
}

async function resetAllChannelAccountsUnused(channelId, tableGroupId = '') {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerFeishuTableGroupProfile(channelId, tableGroupId)

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${profile.accountTableId}/records/search?ignore_consistency_check=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        field_names: ['是否已用'],
        page_size: 1000,
      }),
    }
  )

  const result = await safeJsonParse(response, '查询账户列表')
  if (result.code !== 0) {
    throw new Error(`查询账户列表失败: ${result.msg}`)
  }

  const accounts = Array.isArray(result.data?.items) ? result.data.items : []
  if (accounts.length === 0) {
    return { resetCount: 0 }
  }

  const records = accounts.map(item => ({
    record_id: item.record_id,
    fields: {
      是否已用: '否',
    },
  }))

  const chunkSize = 200
  for (let index = 0; index < records.length; index += chunkSize) {
    const batchResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${profile.accountTableId}/records/batch_update?ignore_consistency_check=true`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          records: records.slice(index, index + chunkSize),
        }),
      }
    )

    const batchResult = await safeJsonParse(batchResponse, '批量重置账户状态')
    if (batchResult.code !== 0) {
      throw new Error(`批量重置账户状态失败: ${batchResult.msg}`)
    }
  }

  serviceConsole.log(`[自动提交-${channelId}] 账户池已回收，共重置 ${records.length} 个账户`)
  return { resetCount: records.length }
}

/**
 * 获取抖音素材配置（根据当前渠道）
 * @returns {string} 格式化后的抖音素材配置字符串
 */
async function getDouyinMaterialConfig(channelId, tableGroupId = '') {
  const profile = getSchedulerFeishuTableGroupProfile(channelId, tableGroupId)
  return profile.douyinMaterialMatches
    .filter(match => match.douyinAccount && match.douyinAccountId && match.materialRange)
    .map(match => `${match.douyinAccount} ${match.douyinAccountId} ${match.materialRange}`)
    .join('\n')
}

/**
 * 获取第一个可用账户
 */
async function getFirstAvailableAccount(channelId, tableGroupId = '') {
  let accounts = await getAvailableChannelAccounts(channelId, tableGroupId)
  if (accounts.length === 0 && isAccountRecycleEnabled(channelId)) {
    await resetAllChannelAccountsUnused(channelId, tableGroupId)
    accounts = await getAvailableChannelAccounts(channelId, tableGroupId)
  }

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

async function dramaExistsInAnyFeishuTableGroup(channelId, dramaName) {
  const groups = getSchedulerFeishuTableGroups(channelId)
  const results = await Promise.all(
    groups.map(group => dramaExistsInFeishuTableGroup(channelId, dramaName, group.id))
  )

  return results.some(Boolean)
}

async function dramaExistsInFeishuTableGroup(channelId, dramaName, tableGroupId = '') {
  const result = await searchDramaList(channelId, dramaName, tableGroupId)
  return (result.data?.items || []).some(item => item.fields?.['剧名']?.[0]?.text === dramaName)
}

function isAutoSubmitCandidateDrama(drama, downloadList) {
  if (!drama) {
    return false
  }

  if (drama.feishu_downloaded || drama.feishu_exists) {
    return false
  }

  const downloadData = getDownloadDataForDrama(downloadList, drama)
  if (!downloadData || downloadData.task_status !== 2) {
    return false
  }

  const dramaName = String(drama.series_name || drama.book_name || '').trim()
  if (!dramaName) {
    return false
  }

  return true
}

async function selectFeishuTableGroupWithAccount(channelId, preferredGroupId = '') {
  const entry = ensureSchedulerEntry(channelId)
  const groups = getSchedulerFeishuTableGroups(channelId)
  if (!groups.length) {
    return null
  }

  const preferredGroup = preferredGroupId
    ? groups.find(group => group.id === preferredGroupId) || null
    : null
  const candidateGroups = preferredGroup
    ? [preferredGroup]
    : groups.map((_, index) => {
        const startIndex = Number(entry.state.nextFeishuTableGroupIndex || 0)
        return groups[(startIndex + index) % groups.length]
      })

  for (const group of candidateGroups) {
    const availableAccount = await getFirstAvailableAccount(channelId, group.id)
    if (availableAccount) {
      if (!preferredGroup) {
        const groupIndex = groups.findIndex(item => item.id === group.id)
        entry.state.nextFeishuTableGroupIndex = (groupIndex + 1) % groups.length
      }
      return { group, availableAccount }
    }
  }

  return null
}

/**
 * 创建剧集状态记录
 */
async function createDramaStatusRecord(channelId, params) {
  const { dramaName, publishTime, account, status, douyinMaterial, rating, tableGroupId } = params
  const profile = getSchedulerFeishuTableGroupProfile(channelId, tableGroupId)
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
    serviceConsole.error(
      `[自动提交-${channelId}] 创建剧集状态记录失败，请求字段:`,
      JSON.stringify(fields)
    )
    serviceConsole.error(`[自动提交-${channelId}] 飞书返回:`, JSON.stringify(result))
    throw new Error(`创建剧集状态记录失败: ${result.msg}`)
  }
  return result
}

function resolveDramaRating(drama, newDramaSet, options = {}) {
  const fromSearchResult = options.fromSearchResult === true

  if (isRedFlagDrama(drama, newDramaSet, options)) {
    return '红标'
  }

  if (fromSearchResult) {
    return '绿标'
  }

  return '黄标'
}

/**
 * 更新账户使用状态
 */
async function updateAccountUsedStatus(channelId, recordId, tableGroupId = '') {
  const accessToken = await getFeishuAccessToken()
  const profile = getSchedulerFeishuTableGroupProfile(channelId, tableGroupId)

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
  const requestParams = {
    permission_statuses: AUTO_SUBMIT_CONFIG.filter.permissionStatuses || '3,4',
    aweme_user_new_version: 'false',
    page_index: pageIndex,
    page_size: pageSize,
    sort_type: 1,
    sort_field: 3,
  }

  if (dramaListTableId) {
    requestParams.drama_list_table_id = dramaListTableId
  }

  try {
    const directResult = await requestChangduInternalApi({
      method: 'GET',
      pathname: CHANGDU_INTERNAL_NEW_DRAMA_PATH,
      query: requestParams,
      ctx: buildSchedulerInternalRequestContext(channelId),
    })
    const apiResult = directResult.data

    if (apiResult.code === 0) {
      return {
        code: 0,
        message: apiResult.message || 'success',
        data: {
          data: Array.isArray(apiResult.data?.data) ? apiResult.data.data : [],
          total: apiResult.data?.total || 0,
        },
      }
    }

    serviceConsole.warn(
      `[自动提交-${channelId}] 内部新剧列表返回非成功，回退开放平台: ${apiResult.code} ${apiResult.message || ''}`
    )
  } catch (error) {
    serviceConsole.warn(
      `[自动提交-${channelId}] 内部新剧列表请求失败，回退开放平台: ${error.message}`
    )
  }

  return getNewDramaListFromOpenApi({ pageIndex, pageSize, channelId, dramaListTableId })
}

async function getNewDramaListFromOpenApi(params = {}) {
  const { pageIndex = 0, pageSize = 100, channelId, dramaListTableId } = params
  const { distributorId, secretKey } = getOpenApiChannelConfig(channelId)

  // 开放平台仅作为内部接口失败时的兜底。
  const requestParams = {
    distributor_id: distributorId,
    page_index: pageIndex,
    page_size: pageSize,
    sort_type: 1,
    sort_field: 3,
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
    serviceConsole.error(`[自动提交] 获取新剧列表 HTTP ${response.status}:`, text.substring(0, 200))
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
      serviceConsole.log(
        `[自动提交] 请求被限速，${AUTO_SUBMIT_CONFIG.pagination.retryDelay}ms后重试...`
      )
      await wait(AUTO_SUBMIT_CONFIG.pagination.retryDelay)
      return getNewDramaListWithRetry(params, retries - 1)
    }

    return result
  } catch (error) {
    // 网络错误等异常情况下的重试
    if (retries > 0) {
      serviceConsole.log(
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

  const headerConfig = await getDownloadCenterTaskListHeaders(channelId)

  serviceConsole.log(`[自动提交-${channelId}] task_list 请求头:`, {
    Distributorid: headerConfig.distributorid,
    Appid: headerConfig.appid,
    Aduserid: headerConfig.Aduserid,
    Rootaduserid: headerConfig.Rootaduserid,
    cookieLength: headerConfig.Cookie.length,
  })

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...headerConfig,
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
  const useNewJuliangFlow = Boolean(juliangConfig.buildConfig?.useNewMicroAppAssetFlow)
  const ebpid = String(juliangConfig.buildConfig?.ebpid || '').trim()

  if (useNewJuliangFlow && !ebpid) {
    throw new Error('当前渠道已启用新版巨量，但未配置 ebpid')
  }

  const requestUrl = useNewJuliangFlow
    ? `https://business.oceanengine.com/api/ebp/promotion/common/edit_account_remark?ebpid=${ebpid}`
    : 'https://business.oceanengine.com/nbs/api/bm/promotion/edit_account_remark'
  const requestHeaders = useNewJuliangFlow
    ? {
        Cookie: juliangConfig.cookie,
        'Content-Type': 'application/json',
      }
    : {
        'Content-Type': 'application/json',
        Cookie: juliangConfig.cookie,
        'X-CSRFToken': juliangConfig.csrfToken,
      }
  const requestBody = useNewJuliangFlow ? { accountId, remark } : { account_id: accountId, remark }

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
  })

  return safeJsonParse(response, '更新巨量账户备注')
}

// ============== 核心业务逻辑 ==============

/**
 * 获取并过滤今天/明天/后天的剧集
 */
async function fetchAutoSubmitDramas(channelId, submitRangeDays = 3, feishuTableGroupId = '') {
  await ensureSchedulerRuntime(channelId)
  const dateRanges = getDateRanges(submitRangeDays)

  serviceConsole.log(`[自动提交-${channelId}] ========== 获取剧集 ==========`)
  serviceConsole.log(`[自动提交-${channelId}] 今天:`, formatDate(dateRanges.today))
  serviceConsole.log(`[自动提交-${channelId}] 明天:`, formatDate(dateRanges.tomorrow))
  serviceConsole.log(`[自动提交-${channelId}] 后天:`, formatDate(dateRanges.dayAfterTomorrow))

  const dramaListTableId = getSchedulerFeishuTableGroupProfile(
    channelId,
    isAllFeishuTableGroupTarget(feishuTableGroupId) ? '' : feishuTableGroupId
  ).dramaListTableId
  const { batchSize, batchDelay, totalPages } = AUTO_SUBMIT_CONFIG.pagination

  // 并发获取下载任务列表
  const downloadResult = await getDownloadTaskList(
    channelId,
    dateRanges.startTime,
    dateRanges.endTime
  )
  const downloadList = downloadResult.data || []
  serviceConsole.log(`[自动提交-${channelId}] 下载任务列表:`, downloadList.length, '条')

  // 分批获取剧集列表
  const dramaResults = []
  for (let batchStart = 0; batchStart < totalPages; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, totalPages)
    const batchPromises = Array.from({ length: batchEnd - batchStart }, (_, i) =>
      getNewDramaListWithRetry({
        pageIndex: batchStart + i + 1,
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

  serviceConsole.log(`[自动提交-${channelId}] 去重后的剧集总数:`, uniqueDramas.length)

  // 过滤剧集
  const filteredDramas = uniqueDramas.filter(drama => {
    if (drama.dy_audit_status !== AUTO_SUBMIT_CONFIG.filter.dyAuditStatus) return false
    if (drama.episode_amount && drama.episode_amount < AUTO_SUBMIT_CONFIG.filter.minEpisodeAmount)
      return false
    return true
  })

  serviceConsole.log(`[自动提交-${channelId}] 过滤后的剧集总数:`, filteredDramas.length)

  const dramasWithFeishuStatus = await hydrateAutoSubmitFeishuStatus(
    channelId,
    filteredDramas,
    feishuTableGroupId
  )

  const candidateDramas = dramasWithFeishuStatus.filter(drama =>
    isAutoSubmitCandidateDrama(drama, downloadList)
  )

  serviceConsole.log(
    `[自动提交-${channelId}] 可新增待下载候选剧集数: ${candidateDramas.length}（已按目标飞书清单和下载完成状态前置过滤）`
  )

  // 按日期分组
  const todayDramas = []
  const tomorrowDramas = []
  const dayAfterTomorrowDramas = []

  for (const drama of candidateDramas) {
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

  const dateLogLabel = '候选剧集数'
  serviceConsole.log(`[自动提交-${channelId}] 今天的${dateLogLabel}:`, todayDramas.length)
  serviceConsole.log(`[自动提交-${channelId}] 明天的${dateLogLabel}:`, tomorrowDramas.length)
  serviceConsole.log(
    `[自动提交-${channelId}] 后天的${dateLogLabel}:`,
    dayAfterTomorrowDramas.length
  )

  const newDramaSet = new Set()

  return {
    today: todayDramas,
    tomorrow: tomorrowDramas,
    dayAfterTomorrow: dayAfterTomorrowDramas,
    downloadList,
    newDramaSet,
  }
}

function selectBestDownloadTask(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return null
  }

  const statusPriority = { 2: 1, 1: 2, 4: 3, 3: 4, 0: 5 }

  return [...tasks].sort((a, b) => {
    const statusDiff = (statusPriority[a.task_status] || 5) - (statusPriority[b.task_status] || 5)
    if (statusDiff !== 0) {
      return statusDiff
    }

    if (a.task_status === 2 && b.task_status === 2) {
      return String(b.task_name || '').length - String(a.task_name || '').length
    }

    return 0
  })[0]
}

/**
 * 根据短剧ID/剧名获取下载数据
 */
function getDownloadDataForDrama(downloadList, drama) {
  if (!Array.isArray(downloadList) || downloadList.length === 0 || !drama) {
    return null
  }

  const dramaBookId =
    typeof drama === 'object' && drama !== null ? String(drama.book_id || '').trim() : ''
  const dramaName =
    typeof drama === 'string'
      ? drama.trim()
      : String(drama.series_name || drama.book_name || '').trim()

  if (dramaName) {
    const matchedByName = downloadList.filter(
      item => String(item.book_name || '').trim() === dramaName
    )
    const bestByName = selectBestDownloadTask(matchedByName)
    if (bestByName) {
      return bestByName
    }
  }

  if (dramaBookId) {
    const matchedByBookId = downloadList.filter(
      item => String(item.book_id || '').trim() === dramaBookId
    )
    return selectBestDownloadTask(matchedByBookId)
  }

  return null
}

/**
 * 按优先级排序剧集
 */
function sortDramasByPriority(dramas, downloadList, newDramaSet) {
  return [...dramas].sort((a, b) => {
    // 优先级 1：红标剧（增剧或首发时间命中 0 点至 1 点）
    const aIsRedFlag = isRedFlagDrama(a, newDramaSet)
    const bIsRedFlag = isRedFlagDrama(b, newDramaSet)
    if (aIsRedFlag !== bIsRedFlag) return aIsRedFlag ? -1 : 1

    // 优先级 2：飞书清单中不存在 && 下载中心有完成的任务
    const aDownloadData = getDownloadDataForDrama(downloadList, a)
    const bDownloadData = getDownloadDataForDrama(downloadList, b)
    const aCanAdd = !a.feishu_downloaded && !a.feishu_exists && aDownloadData?.task_status === 2
    const bCanAdd = !b.feishu_downloaded && !b.feishu_exists && bDownloadData?.task_status === 2
    if (aCanAdd !== bCanAdd) return aCanAdd ? -1 : 1

    return 0
  })
}

/**
 * 处理单部剧的提交
 */
async function processDramaInFeishuTableGroup(
  channelId,
  drama,
  downloadList,
  newDramaSet,
  group,
  options = {}
) {
  const dramaName = drama.series_name
  const logScope = options.logScope === '批量提交' ? '批量提交' : '自动提交'
  const logPrefix = `[${logScope}-${channelId}]`

  try {
    if (!options.skipDuplicateCheck) {
      const alreadyExists = await dramaExistsInFeishuTableGroup(channelId, dramaName, group.id)
      if (alreadyExists) {
        serviceConsole.log(`${logPrefix} 剧集已存在，跳过表格组 ${group.name}: ${dramaName}`)
        return {
          success: false,
          reason: 'already_exists',
          groupId: group.id,
          groupName: group.name,
        }
      }
    }

    const availableAccount =
      options.availableAccount || (await getFirstAvailableAccount(channelId, group.id))
    if (!availableAccount) {
      serviceConsole.log(`${logPrefix} 表格组 ${group.name} 无可用账户，跳过: ${dramaName}`)
      return { success: false, reason: 'no_account', groupId: group.id, groupName: group.name }
    }

    // 1. 确定评级
    const rating = resolveDramaRating(drama, newDramaSet, options)

    // 2. 创建飞书剧集清单记录
    await createDramaRecord(
      channelId,
      dramaName,
      drama.publish_time,
      drama.book_id,
      rating,
      group.id
    )
    serviceConsole.log(`${logPrefix} 创建剧集清单记录成功: ${dramaName} -> ${group.name}`)

    // 3. 根据下载状态确定飞书状态
    const downloadData = getDownloadDataForDrama(downloadList, drama)
    const taskStatus = downloadData?.task_status
    const readyStatuses = AUTO_SUBMIT_CONFIG.taskStatus.readyStatuses
    const feishuStatus =
      taskStatus !== undefined && readyStatuses.includes(taskStatus) ? '待下载' : '待提交'

    // 4. 获取抖音素材配置（根据当前表格组）
    const douyinMaterial = await getDouyinMaterialConfig(channelId, group.id)

    // 5. 创建剧集状态记录
    await createDramaStatusRecord(channelId, {
      dramaName,
      publishTime: drama.publish_time,
      account: availableAccount.account,
      status: feishuStatus,
      douyinMaterial: douyinMaterial || undefined,
      rating,
      tableGroupId: group.id,
    })
    serviceConsole.log(
      `${logPrefix} 创建剧集状态记录成功，表格组: ${group.name}，分配账户: ${availableAccount.account}`
    )

    // 6. 更新账户使用状态
    await updateAccountUsedStatus(channelId, availableAccount.recordId, group.id)

    // 7. 更新巨量账户备注
    if (availableAccount.account) {
      try {
        const remark = `${getSchedulerBrandName(channelId)}-${dramaName}`
        await editJuliangAccountRemark(channelId, availableAccount.account, remark)
        serviceConsole.log(`${logPrefix} 更新巨量账户备注成功: ${availableAccount.account}`)
      } catch (juliangError) {
        serviceConsole.error(`${logPrefix} 更新巨量账户备注失败:`, juliangError.message)
      }
    }

    return { success: true, groupId: group.id, groupName: group.name }
  } catch (error) {
    serviceConsole.error(`${logPrefix} 表格组 ${group.name} 处理失败: ${dramaName}`, error.message)
    return {
      success: false,
      reason: 'error',
      error: error.message,
      groupId: group.id,
      groupName: group.name,
    }
  }
}

async function processDrama(channelId, drama, downloadList, newDramaSet, options = {}) {
  await ensureSchedulerRuntime(channelId)
  const dramaName = drama.series_name
  const logScope = options.logScope === '批量提交' ? '批量提交' : '自动提交'
  const logPrefix = `[${logScope}-${channelId}]`
  const preferredGroupId = String(options.feishuTableGroupId || '').trim()

  try {
    if (isAllFeishuTableGroupTarget(preferredGroupId)) {
      const groups = getSchedulerFeishuTableGroups(channelId)
      if (!groups.length) {
        serviceConsole.log(`${logPrefix} 未配置可用飞书表格组，跳过: ${dramaName}`)
        return { success: false, reason: 'no_group' }
      }

      const groupResults = []
      for (const group of groups) {
        groupResults.push(
          await processDramaInFeishuTableGroup(
            channelId,
            drama,
            downloadList,
            newDramaSet,
            group,
            options
          )
        )
      }

      const successCount = groupResults.filter(result => result.success).length
      if (successCount > 0) {
        serviceConsole.log(
          `${logPrefix} ${dramaName} 已提交到 ${successCount}/${groups.length} 个飞书表格组`
        )
        return { success: true, successCount, groupResults }
      }

      const firstError = groupResults.find(result => result.error)
      if (groupResults.every(result => result.reason === 'already_exists')) {
        return { success: false, reason: 'already_exists', groupResults }
      }
      if (groupResults.every(result => ['already_exists', 'no_account'].includes(result.reason))) {
        return { success: false, reason: 'no_account', groupResults }
      }

      return {
        success: false,
        reason: 'error',
        error: firstError?.error,
        groupResults,
      }
    }

    if (preferredGroupId) {
      const preferredGroup = getSchedulerFeishuTableGroupById(channelId, preferredGroupId)
      if (!preferredGroup) {
        serviceConsole.log(`${logPrefix} 未找到目标飞书表格组，跳过: ${dramaName}`)
        return { success: false, reason: 'group_not_found' }
      }

      return processDramaInFeishuTableGroup(
        channelId,
        drama,
        downloadList,
        newDramaSet,
        preferredGroup,
        options
      )
    }

    // 未指定目标表格组时保留原策略：当前渠道任意表格已存在则跳过，再轮询选择可用账户组。
    const alreadyExists = await dramaExistsInAnyFeishuTableGroup(channelId, dramaName)
    if (alreadyExists) {
      serviceConsole.log(`${logPrefix} 剧集已存在，跳过: ${dramaName}`)
      return { success: false, reason: 'already_exists' }
    }

    const selectedGroup = await selectFeishuTableGroupWithAccount(channelId)
    if (!selectedGroup?.availableAccount) {
      serviceConsole.log(`${logPrefix} 无可用账户，跳过: ${dramaName}`)
      return { success: false, reason: 'no_account' }
    }

    return processDramaInFeishuTableGroup(
      channelId,
      drama,
      downloadList,
      newDramaSet,
      selectedGroup.group,
      {
        ...options,
        availableAccount: selectedGroup.availableAccount,
        skipDuplicateCheck: true,
      }
    )
  } catch (error) {
    serviceConsole.error(`${logPrefix} 处理失败: ${dramaName}`, error.message)
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
    serviceConsole.log(`[自动提交-${channelId}] 上一轮仍在运行，跳过本次`)
    scheduleNextRun(channelId)
    return
  }

  state.running = true
  if (state.intervalMinutes) {
    state.nextRunTime = new Date(Date.now() + state.intervalMinutes * 60 * 1000).toISOString()
  }
  state.currentTask = {
    startTime: new Date().toISOString(),
    status: 'running',
  }
  state.progress = { current: 0, total: 0, currentDate: '筛选候选', currentDrama: '' }
  await saveState(channelId)

  try {
    serviceConsole.log(`[自动提交-${channelId}] ========== 开始自动提交流程 ==========`)

    // 1. 获取并过滤剧集
    const { today, tomorrow, dayAfterTomorrow, downloadList, newDramaSet } =
      await fetchAutoSubmitDramas(channelId, state.submitRangeDays, state.feishuTableGroupId)

    // 2. 按日期分组处理
    const dateGroups = [
      { date: '今天', dramas: today },
      { date: '明天', dramas: tomorrow },
      { date: '后天', dramas: dayAfterTomorrow },
    ].slice(0, state.submitRangeDays)

    let processedCount = 0
    let successCount = 0
    let failCount = 0
    let skipCount = 0

    for (const dateGroup of dateGroups) {
      if (!state.enabled) {
        serviceConsole.log(`[自动提交-${channelId}] 已停止`)
        break
      }

      state.progress.currentDate = dateGroup.date

      // 3. 过滤符合条件的剧
      const eligibleDramas = dateGroup.dramas.filter(d => {
        // 所有表格模式需要交给逐表写入逻辑判断，否则会被默认表的已存在标记提前过滤。
        if (
          !isAllFeishuTableGroupTarget(state.feishuTableGroupId) &&
          (d.feishu_downloaded || d.feishu_exists)
        ) {
          return false
        }

        // 条件2: 下载中心有完成的任务
        const downloadData = getDownloadDataForDrama(downloadList, d)
        if (!downloadData || downloadData.task_status !== 2) return false

        if (state.onlyRedFlag && !isRedFlagDrama(d, newDramaSet)) return false

        return true
      })

      if (eligibleDramas.length === 0) {
        serviceConsole.log(`[自动提交-${channelId}] ${dateGroup.date}没有需要处理的剧集`)
        continue
      }

      // 4. 排序
      const sortedDramas = sortDramasByPriority(eligibleDramas, downloadList, newDramaSet)

      const filterMode = state.onlyRedFlag ? '仅红标剧' : '所有剧'
      serviceConsole.log(
        `[自动提交-${channelId}] 开始处理${dateGroup.date}的剧集，共 ${sortedDramas.length} 部（筛选模式：${filterMode}）`
      )

      // 5. 依次处理
      state.progress.total = sortedDramas.length
      for (let i = 0; i < sortedDramas.length; i++) {
        if (!state.enabled) {
          serviceConsole.log(`[自动提交-${channelId}] 已停止`)
          break
        }

        const drama = sortedDramas[i]
        state.progress.current = i + 1
        state.progress.currentDrama = drama.series_name
        await saveState(channelId)

        const redFlagLabel = isRedFlagDrama(drama, newDramaSet) ? ' [红标]' : ''
        serviceConsole.log(
          `[自动提交-${channelId}] 处理第 ${i + 1}/${sortedDramas.length} 部：${drama.series_name}${redFlagLabel}`
        )

        const result = await processDrama(channelId, drama, downloadList, newDramaSet, {
          feishuTableGroupId: state.feishuTableGroupId,
        })
        processedCount++

        if (result.success) {
          successCount++
          serviceConsole.log(`[自动提交-${channelId}] ✓ ${drama.series_name} 处理成功`)
        } else if (result.reason === 'already_exists' || result.reason === 'no_account') {
          skipCount++
        } else {
          failCount++
          serviceConsole.log(
            `[自动提交-${channelId}] ✗ ${drama.series_name} 处理失败: ${result.error || result.reason}`
          )
        }

        // 等待 1 秒
        await wait(1000)
      }

      serviceConsole.log(`[自动提交-${channelId}] ${dateGroup.date}的剧集处理完成`)
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

    serviceConsole.log(`[自动提交-${channelId}] ========== 自动提交流程完成 ==========`)
    serviceConsole.log(
      `[自动提交-${channelId}] 本轮统计: 处理 ${processedCount}, 成功 ${successCount}, 失败 ${failCount}, 跳过 ${skipCount}`
    )
  } catch (error) {
    serviceConsole.error(`[自动提交-${channelId}] 执行失败:`, error.message)
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
      if (state.runOnce) {
        state.enabled = false
        state.nextRunTime = null
        const entry = ensureSchedulerEntry(channelId)
        if (entry.timer) {
          clearTimeout(entry.timer)
          entry.timer = null
        }
      } else {
        scheduleNextRun(channelId)
      }
    }

    await saveState(channelId)
  }
}

/**
 * 调度下次运行
 */
function scheduleNextRun(channelId, options = {}) {
  const entry = ensureSchedulerEntry(channelId)
  const state = entry.state
  if (!state.enabled || state.runOnce || !state.intervalMinutes) {
    state.nextRunTime = null
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
    void saveState(channelId)
    return
  }
  const intervalMs = state.intervalMinutes * 60 * 1000
  const nowMs = Date.now()
  const savedNextRunMs = Date.parse(String(state.nextRunTime || ''))
  const usePersistedTime = options.usePersistedTime === true
  const hasValidSavedNextRunTime = Number.isFinite(savedNextRunMs)
  const nextRunMs =
    usePersistedTime && hasValidSavedNextRunTime
      ? Math.max(savedNextRunMs, nowMs)
      : nowMs + intervalMs

  state.nextRunTime = new Date(nextRunMs).toISOString()

  serviceConsole.log(`[自动提交-${channelId}] 下次运行时间: ${state.nextRunTime}`)

  if (entry.timer) {
    clearTimeout(entry.timer)
  }

  entry.timer = setTimeout(
    () => {
      runWithAutoSubmitLogContext({ instanceKey: channelId }, () => runAutoSubmitCycle(channelId))
    },
    Math.max(0, nextRunMs - nowMs)
  )

  void saveState(channelId)
}

// ============== 导出的控制函数 ==============

/**
 * 启动调度器
 */
export async function startScheduler(channelId, options = {}, runtimeContext = null) {
  return runWithAutoSubmitLogContext(
    buildAutoSubmitLogContext(channelId, runtimeContext),
    async () => {
      const {
        intervalMinutes = 5,
        onlyRedFlag = false,
        runOnce = false,
        submitRangeDays = 3,
        feishuTableGroupId = '',
      } = options
      const normalizedRangeDays = [1, 2, 3].includes(Number(submitRangeDays))
        ? Number(submitRangeDays)
        : 3
      const normalizedFeishuTableGroupId = String(feishuTableGroupId || '').trim()

      const entry = ensureSchedulerEntry(channelId)
      const state = entry.state
      const runtime = await ensureSchedulerRuntime(channelId, runtimeContext)

      if (state.enabled) {
        serviceConsole.log(`[自动提交-${channelId}] 调度器已经在运行`)
        return { success: false, message: '调度器已经在运行' }
      }

      state.enabled = true
      state.intervalMinutes = runOnce ? null : intervalMinutes
      state.onlyRedFlag = onlyRedFlag
      state.runOnce = Boolean(runOnce)
      state.submitRangeDays = normalizedRangeDays
      state.feishuTableGroupId = normalizedFeishuTableGroupId
      state.nextRunTime = null

      serviceConsole.log(
        `[自动提交-${channelId}] 启动调度器，渠道: ${getChannelLabel(runtime)}，执行方式: ${runOnce ? '仅执行一次' : `${intervalMinutes} 分钟轮询`}`
      )
      serviceConsole.log(`[自动提交-${channelId}] 仅红标: ${onlyRedFlag}`)
      serviceConsole.log(`[自动提交-${channelId}] 提交范围: 近${normalizedRangeDays}天`)
      serviceConsole.log(
        `[自动提交-${channelId}] 飞书表格组: ${normalizedFeishuTableGroupId || '自动轮询'}`
      )

      await saveState(channelId)

      // 启动请求不等待整轮自动提交完成，避免前端弹窗一直停留在“启动中”。
      setTimeout(() => {
        runWithAutoSubmitLogContext(buildAutoSubmitLogContext(channelId), () =>
          runAutoSubmitCycle(channelId)
        ).catch(error => {
          serviceConsole.error(`[自动提交-${channelId}] 后台执行失败:`, error.message)
        })
      }, 0)

      return { success: true, message: runOnce ? '单次执行已启动' : '调度器已启动' }
    }
  )
}

/**
 * 停止调度器
 */
export async function stopScheduler(channelId) {
  return runWithAutoSubmitLogContext(buildAutoSubmitLogContext(channelId), async () => {
    serviceConsole.log(`[自动提交-${channelId}] 停止调度器`)

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
  })
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
    runOnce: Boolean(state.runOnce),
    submitRangeDays: [1, 2, 3].includes(Number(state.submitRangeDays))
      ? Number(state.submitRangeDays)
      : 3,
    feishuTableGroupId: String(state.feishuTableGroupId || '').trim(),
    nextRunTime: toBeijingTime(state.nextRunTime),
    lastRunTime: toBeijingTime(state.lastRunTime),
    currentTask: state.currentTask ? { ...state.currentTask } : null,
    stats: state.stats,
    progress: state.progress,
    taskHistory: state.taskHistory.slice(0, 10).map(task => ({
      ...task,
      timestamp: toBeijingTime(task.timestamp),
    })),
  }
}

export async function listSchedulerStatuses() {
  const persistedKeys = await listPersistedInstanceKeys()
  const instanceKeys = Array.from(new Set([...Object.keys(schedulers), ...persistedKeys]))

  for (const instanceKey of instanceKeys) {
    if (!schedulers[instanceKey]) {
      await loadState(instanceKey)
    }
  }

  return instanceKeys.map(instanceKey => getSchedulerStatus(instanceKey))
}

/**
 * 手动触发一次执行
 */
export async function triggerManualRun(channelId, runtimeContext = null) {
  return runWithAutoSubmitLogContext(
    buildAutoSubmitLogContext(channelId, runtimeContext),
    async () => {
      const runtime = await ensureSchedulerRuntime(channelId, runtimeContext)
      const entry = ensureSchedulerEntry(channelId)
      const state = entry.state

      if (state.running) {
        return { success: false, message: '当前正在运行中' }
      }

      serviceConsole.log(`[自动提交-${channelId}] 手动触发执行，渠道: ${getChannelLabel(runtime)}`)

      // 临时启用以执行一次
      const wasEnabled = state.enabled
      state.enabled = true

      await runAutoSubmitCycle(channelId)

      // 如果之前未启用，恢复状态
      if (!wasEnabled) {
        state.enabled = false
        state.nextRunTime = null
        if (entry.timer) {
          clearTimeout(entry.timer)
          entry.timer = null
        }
        await saveState(channelId)
      }

      return { success: true, message: '手动执行完成' }
    }
  )
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
  for (const instanceKey of keys) {
    await loadState(instanceKey)
  }

  for (const instanceKey of Object.keys(schedulers)) {
    await runWithAutoSubmitLogContext({ instanceKey }, async () => {
      const entry = ensureSchedulerEntry(instanceKey)
      await ensureSchedulerRuntime(instanceKey)
      const hasInterruptedTask = entry.state.running || Boolean(entry.state.currentTask)

      if (hasInterruptedTask) {
        serviceConsole.log(`[自动提交-${instanceKey}] 检测到发版前被中断的轮询任务，启动后立即补跑`)
        entry.state.nextRunTime = new Date().toISOString()
        entry.state.currentTask = null
      }

      entry.state.running = false
      entry.state.progress = { current: 0, total: 0, currentDate: '', currentDrama: '' }

      if (entry.state.enabled) {
        const savedNextRunMs = Date.parse(String(entry.state.nextRunTime || ''))
        if (Number.isFinite(savedNextRunMs) && savedNextRunMs <= Date.now()) {
          serviceConsole.log(`[自动提交-${instanceKey}] 检测到已过点任务，立即补跑`)
        } else {
          serviceConsole.log(
            `[自动提交-${instanceKey}] 恢复之前的调度状态，下次运行: ${entry.state.nextRunTime || ''}`
          )
        }
        scheduleNextRun(instanceKey, { usePersistedTime: true })
      } else if (entry.state.nextRunTime) {
        entry.state.nextRunTime = null
        await saveState(instanceKey)
      }
    })
  }
}

/**
 * 批量提交剧集（购物车使用）- 实际执行函数
 * @param {Array} items - 剧集列表
 */
async function executeBatchSubmit(items, runtimeContext = null) {
  serviceConsole.log(`[批量提交] 开始处理 ${items.length} 部剧集`)

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
      serviceConsole.log(`[批量提交] 处理第 ${i + 1}/${items.length} 部：${dramaName}`)

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
        autoRedFlag: item.autoRedFlag,
        fromSearchResult: item.fromSearchResult,
        feishuTableGroupId: item.feishuTableGroupId,
        logScope: '批量提交',
      })

      if (result.success) {
        successCount++
        results.push({
          book_id: item.book_id,
          series_name: item.series_name,
          success: true,
        })
        serviceConsole.log(`[批量提交] ✓ ${dramaName} 提交成功`)
      } else {
        failedCount++
        results.push({
          book_id: item.book_id,
          series_name: item.series_name,
          success: false,
          error: result.reason || result.error || '提交失败',
        })
        serviceConsole.log(`[批量提交] ✗ ${dramaName} 提交失败: ${result.reason || result.error}`)
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
      serviceConsole.error(`[批量提交] ✗ ${dramaName} 处理异常:`, error.message)
    }
  }

  serviceConsole.log(
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
  const channelId = runtimeContext?.channelRuntime?.channelId || 'default'
  const logContext = buildAutoSubmitLogContext(channelId, runtimeContext)

  runWithAutoSubmitLogContext(logContext, () => {
    serviceConsole.log(`[批量提交] 创建任务 ${taskId}，共 ${items.length} 部剧集`)
  })

  // 异步执行，不等待结果
  runWithAutoSubmitLogContext(logContext, () =>
    executeBatchSubmit(items, runtimeContext)
      .then(result => {
        serviceConsole.log(`[批量提交] 任务 ${taskId} 完成:`, result)
      })
      .catch(error => {
        serviceConsole.error(`[批量提交] 任务 ${taskId} 失败:`, error)
      })
  )

  // 立即返回任务信息
  return {
    taskId,
    status: 'processing',
    total: items.length,
    message: '任务已提交，正在后台处理',
  }
}
