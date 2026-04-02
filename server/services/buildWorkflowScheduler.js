/**
 * 搭建工作流后台调度服务
 * 支持定时轮询搭建，状态持久化
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { AsyncLocalStorage } from 'async_hooks'
import { FEISHU_CONFIG } from '../config/feishu.js'
import { BUILD_WORKFLOW_CONFIG } from '../config/buildWorkflow.js'
import { buildChangduPostHeaders } from '../utils/changduSign.js'
import FormData from 'form-data'
import {
  parsePromotionUrl,
  generateMicroAppLink,
  extractAppIdFromParams,
  filterMaterials,
  sortMaterialsBySequence,
  sanitizeDramaName,
  generatePromotionName,
  generateSmartPromotionName,
  formatBuildDate,
  parseDouyinMaterialFromFeishu,
} from '../utils/buildWorkflowUtils.js'
import { clearExistingProjects } from '../utils/buildWorkflowProjectCleanup.js'
import {
  canBuildDramaNow,
  getDramaPublishTime,
  getEarliestBuildTime,
  selectHighestPriorityDrama,
} from '../utils/buildWorkflowRules.js'
import {
  getChannelLabel,
  normalizeChannelRuntime,
  resolveChannelRuntimeById,
} from '../utils/channelRuntime.js'
import {
  buildRuntimeInstanceKey,
  normalizeRuntimeInstanceKey,
  patchRuntimeIdentityFromInstanceKey,
} from '../utils/runtimeInstance.js'
import { buildServiceLogPrefix, createScopedConsole } from '../utils/serviceLogger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BUILD_RETRY_BASE_DELAY_MS = 2000
const BUILD_RETRY_MAX_DELAY_MS = 10000

// 状态文件路径
const isProduction = process.env.NODE_ENV === 'production'
const STATE_FILE_PREFIX = 'build-workflow-scheduler-state-'
const STATE_FILE_DIR = isProduction ? '/data/changdu-web' : path.join(__dirname, '../data')

function createDefaultSchedulerState() {
  return {
    instanceKey: '',
    userId: '',
    runtimeUserName: '',
    enabled: false,
    intervalMinutes: null,
    tableId: null,
    channelId: '',
    channelName: '',
    channelRuntime: null,
    runtimeUserConfig: {
      feishu: {
        dramaStatusTableId: '',
      },
      brandName: '小红',
    },
    nextRunTime: null,
    lastRunTime: null,
    stats: {
      totalBuilt: 0,
      successCount: 0,
      failCount: 0,
    },
    currentTask: null,
    taskHistory: [],
  }
}

const schedulerInstances = Object.create(null)
const schedulerContext = new AsyncLocalStorage()

function getBuildWorkflowLogProfile() {
  try {
    const state = getActiveSchedulerState()
    return {
      runtimeUserName: state.runtimeUserName,
      userId: state.userId,
      channelName: state.channelName,
      channelId: state.channelId,
    }
  } catch {
    return {}
  }
}

const buildConsole = createScopedConsole('后台搭建', getBuildWorkflowLogProfile)

function getStateFilePath(instanceKey) {
  return path.join(
    STATE_FILE_DIR,
    `${STATE_FILE_PREFIX}${normalizeRuntimeInstanceKey(instanceKey)}.json`
  )
}

function ensureSchedulerEntry(instanceKey) {
  const normalizedInstanceKey = normalizeRuntimeInstanceKey(instanceKey)
  if (!schedulerInstances[normalizedInstanceKey]) {
    schedulerInstances[normalizedInstanceKey] = {
      state: {
        ...createDefaultSchedulerState(),
        instanceKey: normalizedInstanceKey,
      },
      timer: null,
    }
  }
  return schedulerInstances[normalizedInstanceKey]
}

function getActiveInstanceKey() {
  const store = schedulerContext.getStore()
  return store?.instanceKey || ''
}

function getActiveSchedulerEntry() {
  const instanceKey = getActiveInstanceKey()
  if (!instanceKey) {
    throw new Error('缺少调度器实例上下文')
  }
  return ensureSchedulerEntry(instanceKey)
}

function getActiveSchedulerState() {
  return getActiveSchedulerEntry().state
}

function runWithSchedulerContext(instanceKey, fn) {
  return schedulerContext.run({ instanceKey: normalizeRuntimeInstanceKey(instanceKey) }, fn)
}

function isRetryableBuildErrorMessage(messageText = '') {
  const normalizedMessage = String(messageText || '').toLowerCase()
  return (
    normalizedMessage.includes('服务器连接超时') ||
    normalizedMessage.includes('连接超时') ||
    normalizedMessage.includes('请求超时') ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('timed out') ||
    normalizedMessage.includes('econnreset') ||
    normalizedMessage.includes('econnaborted') ||
    normalizedMessage.includes('socket hang up') ||
    normalizedMessage.includes('network error') ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('502') ||
    normalizedMessage.includes('503') ||
    normalizedMessage.includes('504')
  )
}

function getBuildRetryDelayMs(retryCount) {
  return Math.min(BUILD_RETRY_BASE_DELAY_MS * 2 ** retryCount, BUILD_RETRY_MAX_DELAY_MS)
}

function formatAdvanceHoursDebugText(buildConfig = {}) {
  return `提前搭建配置(10点后=${String(buildConfig.advanceHoursAfterTen || '0')}, 10点前=${String(buildConfig.advanceHoursBeforeTen || '0')})`
}

async function listPersistedInstanceKeys() {
  try {
    const fileNames = await fs.readdir(STATE_FILE_DIR)
    return fileNames
      .filter(fileName => fileName.startsWith(STATE_FILE_PREFIX) && fileName.endsWith('.json'))
      .map(fileName => fileName.slice(STATE_FILE_PREFIX.length, -'.json'.length))
  } catch {
    return []
  }
}

function getSchedulerRuntime() {
  return normalizeChannelRuntime(getActiveSchedulerState().channelRuntime || {})
}

async function ensureSchedulerRuntime(channelRuntime = null, instanceKey = getActiveInstanceKey()) {
  const entry = ensureSchedulerEntry(instanceKey)
  const state = entry.state
  patchRuntimeIdentityFromInstanceKey(state, instanceKey)

  if (channelRuntime) {
    const normalizedRuntime = normalizeChannelRuntime(
      channelRuntime.channelRuntime || channelRuntime
    )
    state.instanceKey = normalizeRuntimeInstanceKey(instanceKey)
    state.userId = String(channelRuntime.runtimeUser?.id || state.userId || '').trim()
    state.runtimeUserName = String(
      channelRuntime.runtimeUser?.nickname || state.runtimeUserName || ''
    ).trim()
    state.channelId = normalizedRuntime.channelId
    state.channelName = normalizedRuntime.channelName
    state.channelRuntime = normalizedRuntime
    state.runtimeUserConfig = {
      feishu: {
        dramaStatusTableId: String(
          channelRuntime.runtimeUser?.feishu?.dramaStatusTableId ||
            channelRuntime.runtimeUserConfig?.feishu?.dramaStatusTableId ||
            ''
        ).trim(),
      },
      brandName: String(
        channelRuntime.runtimeUser?.brandName ||
          channelRuntime.runtimeUserConfig?.brandName ||
          '小红'
      ).trim(),
    }
    return normalizedRuntime
  }

  if (state.channelId) {
    const resolvedRuntime = await resolveChannelRuntimeById(state.channelId)
    state.channelId = resolvedRuntime.channelId
    state.channelName = resolvedRuntime.channelName
    state.channelRuntime = resolvedRuntime
    return resolvedRuntime
  }

  if (state.channelRuntime) {
    return normalizeChannelRuntime(state.channelRuntime)
  }

  const resolvedRuntime = await resolveChannelRuntimeById('')
  state.channelId = resolvedRuntime.channelId
  state.channelName = resolvedRuntime.channelName
  state.channelRuntime = resolvedRuntime
  return resolvedRuntime
}

function getDramaStatusTableId() {
  const state = getActiveSchedulerState()
  return (
    state.tableId ||
    state.runtimeUserConfig?.feishu?.dramaStatusTableId ||
    FEISHU_CONFIG.table_ids.drama_status
  )
}

/**
 * 安全解析 JSON 响应，避免 HTML 错误页导致日志不可定位
 */
async function parseJsonResponse(response, actionName) {
  const responseText = await response.text()
  const contentType = response.headers.get('content-type') || 'unknown'

  let result
  try {
    result = JSON.parse(responseText)
  } catch {
    const snippet = responseText.slice(0, 200).replace(/\s+/g, ' ').trim()
    throw new Error(
      `${actionName}返回非JSON响应: HTTP ${response.status} ${response.statusText}, Content-Type=${contentType}, URL=${response.url}, 响应片段=${snippet || 'empty'}`
    )
  }

  if (!response.ok) {
    const message =
      result?.message ||
      result?.msg ||
      result?.error ||
      `HTTP ${response.status} ${response.statusText}`
    throw new Error(
      `${actionName}请求失败: ${message}, HTTP ${response.status}, URL=${response.url}`
    )
  }

  return result
}

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

  const data = await response.json()
  if (data.code !== 0) {
    throw new Error(`获取飞书 access token 失败: ${data.msg}`)
  }
  return data.tenant_access_token
}

/**
 * 查询待搭建剧集（从飞书）
 */
async function getPendingSetupDramas() {
  const accessToken = await getFeishuAccessToken()
  const dramaStatusTableId = getDramaStatusTableId()

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${dramaStatusTableId}/records/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        field_names: [
          '剧名',
          '短剧ID',
          '账户',
          '日期',
          '当前状态',
          '上架时间',
          '评级',
          '抖音素材',
          '备注',
        ],
        page_size: 100,
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: '当前状态',
              operator: 'is',
              value: ['待搭建'],
            },
          ],
        },
      }),
    }
  )

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(`查询飞书待搭建剧集失败: ${result.msg}`)
  }

  // 为每条记录添加 _tableId 属性
  const items = result.data?.items || []
  items.forEach(item => {
    item._tableId = dramaStatusTableId
  })
  return items
}

/**
 * 更新飞书剧集状态
 * @param {string} recordId - 记录ID
 * @param {string} status - 新状态
 * @param {number} buildTime - 搭建时间
 * @param {string} tableId - 表ID（可选）
 * @param {string} remark - 备注（可选，用于记录失败或跳过原因）
 */
async function updateDramaStatus(recordId, status, buildTime, tableId, remark) {
  const accessToken = await getFeishuAccessToken()
  const targetTableId = tableId || getDramaStatusTableId()

  const fields = { 当前状态: status }
  if (buildTime) {
    fields['搭建时间'] = buildTime
  }
  if (remark !== undefined) {
    fields['备注'] = remark
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${targetTableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields }),
    }
  )

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(`更新飞书状态失败: ${result.msg}`)
  }

  return result
}

/**
 * 获取后台搭建更新状态时应使用的表格 ID
 * 优先级：调度器覆盖值 > 记录自带 _tableId > 当前运行时表格
 * @param {Object} drama 飞书记录
 * @returns {string} 表格 ID
 */
function getStatusUpdateTableId(drama) {
  return getActiveSchedulerState().tableId || drama?._tableId || getDramaStatusTableId()
}

/**
 * 获取抖音号配置列表
 * @param {Object} drama - 飞书记录对象，包含"抖音素材"字段
 * @returns {Array} 抖音号配置列表
 */
async function getDouyinConfigs(drama) {
  // 从飞书状态表的"抖音素材"字段解析配置
  // 飞书多行文本字段可能有多种格式：
  // 1. 数组格式: [{text: "...", type: "text"}]
  // 2. 直接字符串格式: "..."
  const rawField = drama?.fields?.['抖音素材']
  let douyinMaterialText = ''

  if (typeof rawField === 'string') {
    // 直接字符串格式
    douyinMaterialText = rawField
  } else if (Array.isArray(rawField) && rawField[0]?.text) {
    // 数组格式
    douyinMaterialText = rawField[0].text
  } else if (rawField && typeof rawField === 'object') {
    // 其他对象格式，尝试获取 text 或 value
    douyinMaterialText = rawField.text || rawField.value || ''
  }

  buildConsole.log(`[后台搭建] 抖音素材原始字段:`, JSON.stringify(rawField))
  // buildConsole.log(`[后台搭建] 抖音素材解析后文本:`, douyinMaterialText)

  const configs = parseDouyinMaterialFromFeishu(douyinMaterialText)
  buildConsole.log(`[后台搭建] 从飞书状态表解析到 ${configs.length} 个抖音号配置:`, configs)
  return configs
}

function toRechargeTemplateIdNumber(rawRechargeTemplateId) {
  const value = String(rawRechargeTemplateId || '').trim()
  if (!/^\d+$/.test(value)) {
    throw new Error('buildConfig.rechargeTemplateId 必须是数字')
  }

  return Number(value)
}

function toOptionalAdCallbackConfigIdNumber(rawAdCallbackConfigId) {
  const value = String(rawAdCallbackConfigId || '').trim()
  if (!value) {
    return null
  }
  if (!/^\d+$/.test(value)) {
    throw new Error('buildConfig.adCallbackConfigId 必须是数字')
  }

  return Number(value)
}

function getBuildConfig() {
  const buildConfig = getSchedulerRuntime().buildConfig || {}
  const useNewMicroAppAssetFlow = Boolean(buildConfig.useNewMicroAppAssetFlow)
  const requiredKeys = [
    'secretKey',
    'microAppName',
    'microAppId',
    'productId',
    'productPlatformId',
    'landingUrl',
    'rechargeTemplateId',
  ]

  if (useNewMicroAppAssetFlow) {
    requiredKeys.push('microAppInstanceId')
  } else {
    requiredKeys.push('ccId')
  }

  for (const key of requiredKeys) {
    if (!buildConfig[key]) {
      throw new Error(`缺少 buildConfig.${key} 配置`)
    }
  }

  return {
    secretKey: buildConfig.secretKey,
    useNewMicroAppAssetFlow,
    clearExistingProjectsBeforeBuild: Boolean(buildConfig.clearExistingProjectsBeforeBuild),
    ccId: buildConfig.ccId,
    microAppName: buildConfig.microAppName,
    microAppId: buildConfig.microAppId,
    microAppInstanceId: buildConfig.microAppInstanceId,
    source: buildConfig.source || BUILD_WORKFLOW_CONFIG.build.promotion.source,
    productId: buildConfig.productId,
    productPlatformId: buildConfig.productPlatformId,
    landingUrl: buildConfig.landingUrl,
    rechargeTemplateId: toRechargeTemplateIdNumber(buildConfig.rechargeTemplateId),
    adCallbackConfigId:
      typeof buildConfig.adCallbackConfigId === 'string'
        ? buildConfig.adCallbackConfigId.trim()
        : '',
  }
}

function getBuildRuleConfig() {
  return getBuildConfig()
}

function getJuliangCookie() {
  return String(getSchedulerRuntime().juliang.cookie || '').trim()
}

function getRuntimeBrandName() {
  return String(getActiveSchedulerState().runtimeUserConfig?.brandName || '小红').trim() || '小红'
}

function findConfiguredMicroAppAsset(assets = [], buildConfig = {}) {
  const microApps = Array.isArray(assets) ? assets : []
  const targetInstanceId = String(buildConfig.microAppInstanceId || '').trim()
  const targetMicroAppId = String(buildConfig.microAppId || '').trim()

  return (
    microApps.find(item => String(item?.micro_app_instance_id || '').trim() === targetInstanceId) ||
    microApps.find(item => String(item?.micro_app_id || '').trim() === targetMicroAppId) ||
    null
  )
}

function getChangduDistributorId() {
  return String(
    getSchedulerRuntime().changdu.distributorId || BUILD_WORKFLOW_CONFIG.changdu.distributorId
  ).trim()
}

function getChangduDistributorIdNumber() {
  const distributorId = getChangduDistributorId()
  if (!/^\d+$/.test(distributorId)) {
    throw new Error('changdu.distributorId 必须是数字')
  }

  return Number(distributorId)
}

// ============== API 调用函数 ==============

/**
 * 创建推广链接
 */
async function createPromotionLink(params) {
  const { book_id, drama_name, promotion_name } = params
  const finalPromotionName =
    promotion_name || generatePromotionName(drama_name, getRuntimeBrandName())
  const buildConfig = getBuildConfig()

  const requestBody = {
    distributor_id: getChangduDistributorIdNumber(),
    book_id: book_id,
    index: BUILD_WORKFLOW_CONFIG.promotion.index,
    promotion_name: finalPromotionName,
    recharge_template_id: buildConfig.rechargeTemplateId,
    media_source: BUILD_WORKFLOW_CONFIG.promotion.mediaSource,
    price: BUILD_WORKFLOW_CONFIG.promotion.price,
    start_chapter: BUILD_WORKFLOW_CONFIG.promotion.startChapter,
    ...(buildConfig.adCallbackConfigId
      ? {
          ad_callback_config_id: toOptionalAdCallbackConfigIdNumber(buildConfig.adCallbackConfigId),
        }
      : {}),
  }

  const { headers: signHeaders } = buildChangduPostHeaders(
    requestBody,
    undefined,
    getChangduDistributorId(),
    buildConfig.secretKey
  )

  const response = await fetch(`${BUILD_WORKFLOW_CONFIG.changdu.baseUrl}/promotion/create/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...signHeaders },
    body: JSON.stringify(requestBody),
  })

  const result = await parseJsonResponse(response, '创建推广链接')
  if (result.code !== 200) {
    throw new Error(result.message || '创建推广链接失败')
  }
  return result
}

/**
 * 查询小程序
 * 返回格式：{ hasValidMicroApp: boolean, result: any }
 */
async function queryMicroApp(accountId) {
  const buildConfig = getBuildConfig()

  const url = new URL('https://business.oceanengine.com/app_package/microapp/applet/list')
  url.searchParams.set('page_no', '1')
  url.searchParams.set('page_size', '10')
  url.searchParams.set('search_key', '')
  url.searchParams.set('search_type', '1')
  url.searchParams.set('status', '-1') // 查询所有状态的小程序
  url.searchParams.set('adv_id', accountId)
  url.searchParams.set('cc_id', buildConfig.ccId)
  url.searchParams.set('operator', buildConfig.ccId)
  url.searchParams.set('operation_type', '1')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-tt-hume-platform': 'bp',
      Cookie: getJuliangCookie(),
    },
  })

  const result = await response.json()
  const applets = result.data?.applets || []

  // ✅ 检查是否有 status === 1 的小程序
  const hasValidMicroApp = applets.some(applet => applet.status === 1)

  buildConsole.log('[查询小程序] 查询结果:')
  buildConsole.log('  - 小程序总��:', applets.length)
  buildConsole.log('  - status === 1 的数量:', applets.filter(a => a.status === 1).length)
  buildConsole.log('  - 是否有有效小程序:', hasValidMicroApp)

  if (applets.length > 0 && !hasValidMicroApp) {
    buildConsole.log(
      '[查询小程序] ⚠️ 小程序存在但 status 都不等于 1:',
      applets.map(a => ({ instance_id: a.instance_id, status: a.status }))
    )
  }

  const mappedApplets = applets.map(applet => ({
    ...applet,
    micro_app_instance_id: applet.instance_id,
  }))

  return {
    hasValidMicroApp,
    result: { ...result, data: { ...result.data, micro_app: mappedApplets } },
  }
}

/**
 * 查询被共享的已审核通过的小程序（search_type=2）
 * 用于优化资产化流程，优先使用被共享的已审核通过的小程序
 */
async function queryApprovedMicroApp(accountId) {
  const buildConfig = getBuildConfig()

  const url = new URL('https://business.oceanengine.com/app_package/microapp/applet/list')
  url.searchParams.set('page_no', '1')
  url.searchParams.set('page_size', '10')
  url.searchParams.set('search_key', '')
  url.searchParams.set('search_type', '2') // search_type=2 查询被共享的已审核通过的小程序
  url.searchParams.set('status', '-1')
  url.searchParams.set('adv_id', accountId)
  url.searchParams.set('cc_id', buildConfig.ccId)
  url.searchParams.set('operator', buildConfig.ccId)
  url.searchParams.set('operation_type', '1')

  buildConsole.log('[查询被共享的小程序] 开始查询 (search_type=2)...')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-tt-hume-platform': 'bp',
      Cookie: getJuliangCookie(),
    },
  })

  const result = await response.json()
  const applets = result.data?.applets || []

  // 找到 status=1 的小程序
  const approvedApplet =
    applets.find(
      applet => String(applet.app_id || '').trim() === buildConfig.microAppId && applet.status === 1
    ) || applets.find(applet => applet.status === 1)

  buildConsole.log('[查询被共享的小程序] 查询结果:')
  buildConsole.log('  - 小程序总数:', applets.length)
  buildConsole.log('  - 找到已审核通过的小程序:', approvedApplet ? '是' : '否')

  if (approvedApplet) {
    buildConsole.log(
      '[查询被共享的小程序] ✓ 找到被共享的已审核通过的小程序:',
      approvedApplet.instance_id
    )
    return {
      found: true,
      microApp: {
        ...approvedApplet,
        micro_app_instance_id: approvedApplet.instance_id,
      },
    }
  }

  buildConsole.log('[查询被共享的小程序] 未找到被共享的已审核通过的小程序')
  return {
    found: false,
    microApp: null,
  }
}

/**
 * 创建小程序
 */
async function createMicroApp(params) {
  const { account_id, app_id, path: appPath, query, remark, link } = params
  const buildConfig = getBuildConfig()

  const requestBody = {
    instance_id: '',
    adv_id: account_id,
    app_id: app_id,
    remark: '',
    schema_info: [
      {
        path: appPath,
        query: query,
        remark: remark,
        link: link,
        operate_type: '1',
      },
    ],
    data: {
      tag_info:
        '{"category_id":1050000000,"category_name":"小程序","categories":[{"category_id":1050100000,"category_name":"短剧","categories":[{"category_id":1050107001,"category_name":"其他"}]}]}',
    },
  }

  const url = `https://business.oceanengine.com/app_package/microapp/applet/create?cc_id=${buildConfig.ccId}&operator=${buildConfig.ccId}&operation_type=1`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: getJuliangCookie(),
      'x-tt-hume-platform': 'bp',
    },
    body: JSON.stringify(requestBody),
  })

  const result = await response.json()
  const isAlreadyExists =
    result.status === 1 && result.message && result.message.includes('账户内已存在相同AppId')

  if (result.status === 0 || isAlreadyExists) {
    return { code: 0, data: result, skipped: isAlreadyExists }
  }
  throw new Error(result.message || '创建小程序失败')
}

/**
 * 查询小程序资产列表
 */
async function listMicroAppAssets(accountId) {
  const response = await fetch(
    `https://ad.oceanengine.com/event_manager/v2/api/assets/ad/list?aadvid=${accountId}`,
    {
      method: 'POST',
      headers: {
        platform: 'ad',
        Cookie: getJuliangCookie(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assets_types: [1, 3, 2, 7, 4, 5],
        role: 1,
      }),
    }
  )
  return response.json()
}

/**
 * 创建小程序资产
 */
async function createMicroAppAsset(params) {
  const { account_id, micro_app_instance_id } = params
  const buildConfig = getBuildConfig()

  const response = await fetch(
    `https://ad.oceanengine.com/event_manager/api/assets/create?aadvid=${account_id}`,
    {
      method: 'POST',
      headers: {
        platform: 'ad',
        Cookie: getJuliangCookie(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assets_type: 4,
        micro_app: {
          assets_name: buildConfig.microAppName,
          micro_app_id: buildConfig.microAppId,
          micro_app_name: buildConfig.microAppName,
          micro_app_type: 1,
          micro_app_instance_id: micro_app_instance_id,
        },
      }),
    }
  )

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || '创建小程序资产失败')
  }
  return result
}

/**
 * 检查事件状态
 */
async function checkEventStatus(params) {
  const { account_id, assets_id } = params

  const response = await fetch(
    `https://ad.oceanengine.com/event_manager/v2/api/event/track/status/${assets_id}?aadvid=${account_id}`,
    {
      method: 'GET',
      headers: {
        platform: 'ad',
        Cookie: getJuliangCookie(),
      },
    }
  )

  const result = await response.json()
  const hasPaymentEvent = result.data?.track_status?.some(event => event.event_name === '付费')

  return { ...result, has_payment_event: hasPaymentEvent }
}

/**
 * 添加付费事件
 */
async function addPaymentEvent(params) {
  const { account_id, assets_id } = params

  const response = await fetch(
    `https://ad.oceanengine.com/event_manager/v2/api/event/config/create?aadvid=${account_id}`,
    {
      method: 'POST',
      headers: {
        platform: 'ad',
        Cookie: getJuliangCookie(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        link_name: BUILD_WORKFLOW_CONFIG.event.linkName,
        events: [
          {
            event_enum: BUILD_WORKFLOW_CONFIG.event.eventEnum,
            event_type: BUILD_WORKFLOW_CONFIG.event.eventType,
            event_name: BUILD_WORKFLOW_CONFIG.event.eventName,
            track_types: BUILD_WORKFLOW_CONFIG.event.trackTypes,
            statistical_method_type: BUILD_WORKFLOW_CONFIG.event.statisticalMethodType,
            discrimination_value: { value_type: 0, dimension: 0, groups: [] },
          },
        ],
        assets_id: assets_id,
      }),
    }
  )

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || '添加付费事件失败')
  }
  return result
}

/**
 * 上传头像图片
 */
async function uploadAvatarImage(accountId) {
  const imagePath = path.join(__dirname, '../assets/cover.png')
  const imageBuffer = await fs.readFile(imagePath)

  const formData = new FormData()
  formData.append('file', imageBuffer, { filename: 'cover.png', contentType: 'image/png' })
  formData.append('width', '300')
  formData.append('height', '300')

  const response = await fetch(
    `https://ad.oceanengine.com/aadv/api/account/upload_image_v2?aadvid=${accountId}`,
    {
      method: 'POST',
      headers: {
        Cookie: getJuliangCookie(),
        'content-type': formData.getHeaders()['content-type'],
      },
      body: formData.getBuffer(),
    }
  )

  const result = await response.json()
  if (result.code !== 200) {
    throw new Error(result.message || '上传头像图片失败')
  }
  return result
}

/**
 * 保存头像
 */
async function saveAvatar(params) {
  const { account_id, web_uri, width, height } = params

  const response = await fetch(
    `https://ad.oceanengine.com/account/api/v2/adv/saveAvatar?accountId=${account_id}&aadvid=${account_id}`,
    {
      method: 'POST',
      headers: {
        Cookie: getJuliangCookie(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarInfo: { webUri: web_uri, width: width || 300, height: height || 300 },
      }),
    }
  )

  const result = await response.json()
  if (result.code !== 200 && result.code !== 410001) {
    throw new Error(result.message || '保存头像失败')
  }
  return result
}

/**
 * 上传主图
 */
async function uploadProductImage(accountId) {
  const imagePath = path.join(__dirname, '../assets/cover.png')
  const imageBuffer = await fs.readFile(imagePath)

  const formData = new FormData()
  formData.append('fileData', imageBuffer, { filename: 'cover.png', contentType: 'image/png' })

  const response = await fetch(
    `https://ad.oceanengine.com/superior/api/v2/creative/material/picture/upload?aadvid=${accountId}`,
    {
      method: 'POST',
      headers: {
        Cookie: getJuliangCookie(),
        'content-type': formData.getHeaders()['content-type'],
      },
      body: formData.getBuffer(),
    }
  )

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(result.msg || '上传主图失败')
  }
  return result
}

/**
 * 创建项目
 */
async function createProject(params) {
  const {
    account_id,
    drama_name,
    douyin_account_name,
    assets_id,
    micro_app_instance_id,
    project_name,
  } = params
  const projectConfig = BUILD_WORKFLOW_CONFIG.build.project
  const buildConfig = getBuildConfig()

  const finalProjectName =
    project_name ||
    (douyin_account_name
      ? `${drama_name}-${getRuntimeBrandName()}-${douyin_account_name}`
      : drama_name)

  const requestBody = {
    track_url_group_info: {},
    track_url: [],
    action_track_url: [],
    first_frame: [],
    last_frame: [],
    effective_frame: [],
    track_url_send_type: '2',
    smart_bid_type: projectConfig.smart_bid_type,
    is_search_speed_phase_four: false,
    budget: projectConfig.budget,
    inventory_catalog: projectConfig.inventory_catalog,
    flow_control_mode: projectConfig.flow_control_mode,
    delivery_mode: 3,
    delivery_package: 0,
    landing_type: 16,
    delivery_related_num: 1,
    name: finalProjectName,
    schedule_type: 1,
    week_schedule_type: 0,
    pricing_type: 9,
    product_platform_id: buildConfig.productPlatformId,
    product_id: buildConfig.productId,
    district: 'all',
    gender: '0',
    age: [['0', '17']],
    retargeting_tags: [],
    platform: ['0'],
    hide_if_converted: '1',
    cdp_marketing_goal: 1,
    asset_ids: [assets_id.toString()],
    external_action: '14',
    budget_mode: projectConfig.budget_mode,
    campaign_type: 1,
    micro_promotion_type: 4,
    asset_name: '',
    smart_inventory: 3,
    auto_ad_type: 1,
    micro_app_instance_id: micro_app_instance_id,
    products: [],
    aigc_dynamic_creative_switch: 0,
    is_search_3_online: true,
  }

  const response = await fetch(
    `https://ad.oceanengine.com/superior/api/v2/project/create?aadvid=${account_id}`,
    {
      method: 'POST',
      headers: {
        Cookie: getJuliangCookie(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  )

  const result = await parseJsonResponse(response, '创建项目')
  if (result.code !== 0) {
    throw new Error(result.msg || '创建项目失败')
  }
  return result
}

/**
 * 获取抖音号原始ID
 */
async function getDouyinAccountInfo(params) {
  const { account_id, douyin_account_id } = params

  const requestBody = {
    page_index: 1,
    page_size: 100,
    uniq_id_or_short_id: douyin_account_id,
    need_limits_info: true,
    need_limit_scenes: [4],
    level: [1, 4, 5, 7],
    need_auth_extra_info: true,
    dpa_id: '',
  }

  const response = await fetch(
    `https://ad.oceanengine.com/superior/api/v2/ad/authorize/list?aadvid=${account_id}`,
    {
      method: 'POST',
      headers: {
        Cookie: getJuliangCookie(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  )

  return parseJsonResponse(response, '获取抖音号信息')
}

/**
 * 获取素材列表
 */
async function getMaterialList(params) {
  const { account_id, aweme_id, aweme_account } = params

  const queryParams = new URLSearchParams({
    aadvid: account_id,
    image_mode: '5,15',
    sort_type: 'desc',
    metric_names: 'create_time,stat_cost,ctr',
    aweme_id: aweme_id,
    aweme_account: aweme_account,
    'auth_level[]': '5',
    landing_type: '16',
    external_action: '14',
    page: '1',
    limit: '100',
    version: 'v2',
    operation_platform: '1',
  })

  const response = await fetch(
    `https://ad.oceanengine.com/superior/api/v2/video/list?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: { Cookie: getJuliangCookie() },
    }
  )

  return parseJsonResponse(response, '获取素材列表')
}

/**
 * 创建广告
 */
async function createPromotion(params) {
  const {
    account_id,
    project_id,
    ad_name,
    drama_name,
    ies_core_user_id,
    materials,
    app_id,
    start_page,
    app_type,
    start_params,
    link,
    product_image_uri,
    product_image_width,
    product_image_height,
  } = params

  const promotionConfig = BUILD_WORKFLOW_CONFIG.build.promotion
  const buildConfig = getBuildConfig()

  const videoMaterialInfo = materials.map(material => {
    let imageInfo
    if (
      material.image_info &&
      Array.isArray(material.image_info) &&
      material.image_info.length > 0
    ) {
      imageInfo = material.image_info.map(img => ({
        width: img.width || material.video_info?.width || 1080,
        height: img.height || material.video_info?.height || 1920,
        web_uri: img.web_uri || material.cover_uri || '',
        sign_url: img.sign_url || material.sign_url || '',
      }))
    } else {
      imageInfo = [
        {
          width: material.video_info?.width || 1080,
          height: material.video_info?.height || 1920,
          web_uri: material.image_info?.web_uri || material.cover_uri || '',
          sign_url: material.sign_url || '',
        },
      ]
    }

    return {
      image_info: imageInfo,
      video_info: {
        height: material.video_info?.height || 1920,
        width: material.video_info?.width || 1080,
        bitrate: material.video_info?.bitrate || 0,
        thumb_height: material.video_info?.thumb_height || 1920,
        thumb_width: material.video_info?.thumb_width || 1080,
        duration: material.video_info?.duration || 0,
        status: material.video_info?.status || 10,
        initial_size: material.video_info?.initial_size || 0,
        file_md5: material.video_info?.file_md5 || '',
        video_id: material.video_id,
        cover_uri: material.cover_uri || material.video_poster_uri || '',
        vid: material.video_id,
      },
      is_ebp_share: false,
      image_mode: 15,
      f_f_see_setting: 1,
      cover_type: 1,
    }
  })

  const requestBody = {
    promotion_data: {
      client_settings: { is_comment_disable: '0' },
      native_info: {
        is_feed_and_fav_see: 2,
        anchor_related_type: 0,
        ies_core_user_id: ies_core_user_id,
      },
      enable_personal_action: true,
      micro_app_info: {
        app_id: app_id,
        start_path: start_page || '',
        micro_app_type: app_type || 2,
        params: start_params || '',
        url: link || '',
      },
      source: buildConfig.source,
    },
    material_group: {
      playable_material_info: [],
      video_material_info: videoMaterialInfo,
      image_material_info: [],
      aweme_photo_material_info: [],
      external_material_info: [{ external_url: buildConfig.landingUrl }],
      component_material_info: [],
      call_to_action_material_info: [
        { call_to_action: promotionConfig.call_to_action, suggestion_usage_type: 0 },
      ],
      product_info: {
        product_name: { name: promotionConfig.product_name },
        product_images: [
          {
            image_uri: product_image_uri,
            width: product_image_width || 108,
            height: product_image_height || 108,
          },
        ],
        product_selling_points: [
          { selling_point: promotionConfig.selling_point, suggestion_usage_type: 0 },
        ],
      },
      title_material_info: [
        {
          title: `#短剧推荐#${drama_name}`,
          word_list: [],
          bidword_list: [],
          dpa_word_list: [],
          is_dynamic: 0,
          suggestion_usage_type: 0,
          request_id: '0',
        },
      ],
    },
    name: ad_name,
    project_id: project_id.toString(),
    check_hash: Date.now().toString(),
    is_auto_delivery_mode: false,
  }

  const response = await fetch(
    `https://ad.oceanengine.com/superior/api/v2/promotion/create_promotion?aadvid=${account_id}`,
    {
      method: 'POST',
      headers: {
        Cookie: getJuliangCookie(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  )

  return parseJsonResponse(response, '创建广告')
}

// ============== 搭建流程 ==============

/**
 * 执行资产化流程
 */
async function executeAssetization(drama) {
  const dramaName = drama.fields['剧名']?.[0]?.text
  const bookId = drama.fields['短剧ID']?.value?.[0]?.text
  const accountId = drama.fields['账户']?.[0]?.text
  const buildConfig = getBuildConfig()

  if (!dramaName || !bookId || !accountId) {
    throw new Error('剧集信息不完整')
  }

  buildConsole.log(`[后台搭建] 开始资产化: ${dramaName}`)

  // 步骤1: 上传账户头像
  buildConsole.log('[后台搭建] 步骤1: 上传账户头像')
  const avatarUploadResult = await uploadAvatarImage(accountId)
  await saveAvatar({
    account_id: accountId,
    web_uri: avatarUploadResult.data.image_info.web_uri,
    width: 300,
    height: 300,
  })

  // 步骤2: 创建推广链接（用于小程序资产）
  buildConsole.log('[后台搭建] 步骤2: 创建推广链接')
  const primaryDouyinConfig = await getDouyinConfigs(drama)
  if (primaryDouyinConfig.length === 0) {
    throw new Error('没有配置抖音号')
  }
  const assetPromotionName = generateSmartPromotionName(
    primaryDouyinConfig[0].douyinAccount,
    dramaName,
    accountId,
    getRuntimeBrandName()
  )
  const promotionResult = await createPromotionLink({
    book_id: bookId,
    drama_name: dramaName,
    promotion_name: assetPromotionName,
  })

  // 步骤3: 查询/创建小程序
  let microApp
  let assetMicroApp = null

  if (buildConfig.useNewMicroAppAssetFlow) {
    buildConsole.log('[后台搭建] 步骤3: 新版流程跳过查询/创建小程序，直接使用配置里的小程序实例')
    microApp = {
      micro_app_instance_id: buildConfig.microAppInstanceId,
      app_id: buildConfig.microAppId,
      start_page: '',
    }
  } else {
    buildConsole.log('[后台搭建] 步骤3: 查询/创建小程序')

    // 1. 首先查询账户自己的已审核通过的小程序（search_type=1）
    const microAppResult = await queryMicroApp(accountId)
    if (microAppResult.hasValidMicroApp) {
      // 找到账户自己的已审核通过的小程序，直接使用
      microApp = microAppResult.result.data.micro_app[0]
      buildConsole.log(
        '[后台搭建] ✓ 使用账户自己的已审核通过的小程序:',
        microApp.micro_app_instance_id
      )
    } else {
      // 2. 没有找到账户自己的小程序，查询被共享的已审核通过的小程序（search_type=2）
      buildConsole.log('[后台搭建] 未找到账户自己的已审核通过的小程序，查询被共享的小程序...')
      const approvedResult = await queryApprovedMicroApp(accountId)
      if (approvedResult.found && approvedResult.microApp) {
        // 找到被共享的已审核通过的小程序，直接使用
        microApp = approvedResult.microApp
        buildConsole.log(
          '[后台搭建] ✓ 使用被共享的已审核通过的小程序:',
          microApp.micro_app_instance_id
        )
      } else {
        // 3. 都没有找到，检查是否有未审核通过的小程序
        buildConsole.log('[后台搭建] 未找到被共享的小程序，检查是否需要创建...')
        const applets = microAppResult.result.data?.applets || []
        if (applets.length > 0) {
          // 有小程序但 status 都不等于 1，跳过这部剧
          buildConsole.log('[后台搭建] ⚠️ 小程序存在但未审核通过，跳过这部剧')
          buildConsole.log(
            '[后台搭建] 小程序详情:',
            applets.map(a => ({ instance_id: a.instance_id, status: a.status }))
          )
          const error = new Error('小程序未审核通过（status != 1），跳过此剧集的搭建')
          error.code = 'MICROAPP_NOT_APPROVED'
          throw error
        }
        // applets 为空，需要创建小程序
        buildConsole.log('[后台搭建] 小程序不存在，开始自动创建')
      }
    }

    // 如果没有有效小程序，则创建
    if (!microApp) {
      const parsed = parsePromotionUrl(promotionResult.promotion_url)
      const appId = extractAppIdFromParams(parsed.launchParams)

      if (!appId) {
        throw new Error('无法从推广链接参数中提取 app_id')
      }

      const cleanedParams = parsed.launchParams
        .split('&')
        .filter(param => !param.startsWith('app_id='))
        .join('&')

      const microAppLink = generateMicroAppLink({
        appId,
        startPage: parsed.launchPage,
        startParams: cleanedParams,
      })

      await createMicroApp({
        account_id: accountId,
        app_id: appId,
        path: parsed.launchPage,
        query: parsed.launchParams,
        remark: promotionResult.promotion_name,
        link: microAppLink,
      })

      buildConsole.log('[后台搭建] 小程序创建成功，等待30秒后查询...')
      await new Promise(resolve => setTimeout(resolve, 30000))

      let recheckResult = await queryMicroApp(accountId)

      if (!recheckResult.hasValidMicroApp) {
        buildConsole.log('[后台搭建] 第一次未查询到有效小程序，等待10秒后重试...')
        await new Promise(resolve => setTimeout(resolve, 10000))
        recheckResult = await queryMicroApp(accountId)

        if (!recheckResult.hasValidMicroApp) {
          throw new Error('小程序创建后查询失败（已重试2次）')
        }
      }

      microApp = recheckResult.result.data.micro_app[0]
    }
  }

  // 步骤4: 查询/创建小程序资产
  buildConsole.log('[后台搭建] 步骤4: 查询/创建小程序资产')
  const assetsListResult = await listMicroAppAssets(accountId)
  let assetsId

  if (buildConfig.useNewMicroAppAssetFlow) {
    assetMicroApp = findConfiguredMicroAppAsset(assetsListResult.data?.micro_app, buildConfig)
    if (assetMicroApp) {
      assetsId = assetMicroApp.assets_id
      buildConsole.log('[后台搭建] 新版小程序资产已存在:', assetsId)
    } else {
      buildConsole.log('[后台搭建] 新版小程序资产不存在，开始创建')
      await createMicroAppAsset({
        account_id: accountId,
        micro_app_instance_id: buildConfig.microAppInstanceId,
      })

      const createdAssetsListResult = await listMicroAppAssets(accountId)
      assetMicroApp = findConfiguredMicroAppAsset(
        createdAssetsListResult.data?.micro_app,
        buildConfig
      )
      if (!assetMicroApp) {
        throw new Error('新版小程序资产创建成功后，未查询到对应资产')
      }
      assetsId = assetMicroApp.assets_id
      microApp = {
        micro_app_instance_id:
          assetMicroApp.micro_app_instance_id || buildConfig.microAppInstanceId,
        app_id: assetMicroApp.micro_app_id || buildConfig.microAppId,
        start_page: '',
      }
    }
    if (assetMicroApp) {
      microApp = {
        micro_app_instance_id:
          assetMicroApp.micro_app_instance_id || buildConfig.microAppInstanceId,
        app_id: assetMicroApp.micro_app_id || buildConfig.microAppId,
        start_page: '',
      }
    }
  } else if (assetsListResult.data?.micro_app && assetsListResult.data.micro_app.length > 0) {
    assetsId = assetsListResult.data.micro_app[0].assets_id
    buildConsole.log('[后台搭建] 小程序资产已存在:', assetsId)
  } else {
    buildConsole.log('[后台搭建] 小程序资产不存在，开始创建')
    const assetResult = await createMicroAppAsset({
      account_id: accountId,
      micro_app_instance_id: microApp.micro_app_instance_id,
    })
    assetsId = assetResult.assets_id
  }

  // 步骤5: 检查并添加付费事件
  buildConsole.log('[后台搭建] 步骤5: 检查并添加付费事件')
  const eventStatusResult = await checkEventStatus({
    account_id: accountId,
    assets_id: assetsId,
  })

  if (eventStatusResult.has_payment_event) {
    buildConsole.log('[后台搭建] 付费事件已存在，跳过添加')
  } else {
    buildConsole.log('[后台搭建] 付费事件不存在，开始添加')
    await addPaymentEvent({ account_id: accountId, assets_id: assetsId })
  }

  // 上传主图
  buildConsole.log('[后台搭建] 上传主图')
  const uploadResult = await uploadProductImage(accountId)
  const imageInfo = uploadResult.data

  const initData = {
    assets_id: assetsId,
    micro_app_instance_id: microApp.micro_app_instance_id,
    app_id: microApp.app_id || '',
    start_page: microApp.start_page || '',
    app_type: 2,
    start_params: '',
    link: '',
    product_image_width: imageInfo.width,
    product_image_height: imageInfo.height,
    product_image_uri: imageInfo.web_uri,
  }

  buildConsole.log('[后台搭建] 资产化完成')
  return initData
}

/**
 * 为单个抖音号批次创建项目和广告
 */
async function buildBatchForDouyin(drama, config, initData, dramaName, accountId, buildTimestamp) {
  const bookId = drama.fields['短剧ID']?.value?.[0]?.text
  if (!bookId) {
    throw new Error('短剧ID不存在')
  }

  const cleanDramaName = sanitizeDramaName(dramaName)
  const promotionName = generateSmartPromotionName(
    config.douyinAccount,
    cleanDramaName,
    accountId,
    getRuntimeBrandName()
  )

  let promotionResult
  try {
    promotionResult = await createPromotionLink({
      book_id: bookId,
      drama_name: dramaName,
      promotion_name: promotionName,
    })
  } catch (error) {
    throw new Error(`[创建推广链接] ${error.message}`)
  }

  const parsed = parsePromotionUrl(promotionResult.promotion_url)
  const appId = extractAppIdFromParams(parsed.launchParams)
  if (!appId) {
    throw new Error('无法从推广链接参数中提取 app_id')
  }

  const cleanedParams = parsed.launchParams
    .split('&')
    .filter(param => !param.startsWith('app_id='))
    .join('&')

  const microAppLink = generateMicroAppLink({
    appId,
    startPage: parsed.launchPage,
    startParams: cleanedParams,
  })

  initData.app_id = appId
  initData.start_page = parsed.launchPage
  initData.start_params = cleanedParams
  initData.link = microAppLink
  initData.app_type = 2

  // 1. 创建项目
  const projectName = `${getRuntimeBrandName()}-${config.douyinAccount}-${dramaName}-${buildTimestamp}`
  let projectResult
  try {
    projectResult = await createProject({
      account_id: accountId,
      drama_name: dramaName,
      douyin_account_name: config.douyinAccount,
      assets_id: initData.assets_id,
      micro_app_instance_id: initData.micro_app_instance_id,
      project_name: projectName,
    })
  } catch (error) {
    throw new Error(`[创建项目] ${error.message}`)
  }

  const projectId = projectResult.data.id

  // 2. 获取抖音号原始ID
  let accountInfoResult
  try {
    accountInfoResult = await getDouyinAccountInfo({
      account_id: accountId,
      douyin_account_id: config.douyinAccountId,
    })
  } catch (error) {
    throw new Error(`[获取抖音号信息] ${error.message}`)
  }

  if (accountInfoResult.code !== 0) {
    throw new Error(accountInfoResult.msg || '获取抖音号信息失败')
  }

  const accountInfo = accountInfoResult.data?.[0]
  if (!accountInfo) {
    throw new Error(`找不到抖音号 ${config.douyinAccount} 的信息`)
  }

  const iesCoreUserId = accountInfo.ies_core_id

  // 3. 获取素材列表
  let materialsResult
  try {
    materialsResult = await getMaterialList({
      account_id: accountId,
      aweme_id: config.douyinAccountId,
      aweme_account: iesCoreUserId,
    })
  } catch (error) {
    throw new Error(`[获取素材列表] ${error.message}`)
  }

  if (materialsResult.code !== 0) {
    throw new Error(materialsResult.msg || '获取素材列表失败')
  }

  // 4. 过滤素材
  const allMaterials =
    materialsResult.data.videos?.map(video => ({
      ...video,
      filename: video.video_name || video.filename,
    })) || []

  let dateString
  const feishuDate = drama.fields['日期']
  if (feishuDate) {
    const date = new Date(feishuDate)
    dateString = `${date.getMonth() + 1}.${date.getDate()}`
  }

  const filteredMaterials = filterMaterials(
    allMaterials,
    dramaName,
    config.materialRange,
    dateString
  )
  const sortedMaterials = sortMaterialsBySequence(filteredMaterials)

  if (sortedMaterials.length === 0) {
    throw new Error(`素材不足：没有找到符合条件的素材（日期=${dateString || '不限'}）`)
  }

  // 5. 创建广告（服务器超时等错误使用退避重试）
  const adName = `${getRuntimeBrandName()}-${config.douyinAccount}-${dramaName}-${buildTimestamp}`
  let promotionCreateResult
  let retryCount = 0
  const maxRetries = 3

  while (retryCount <= maxRetries) {
    try {
      promotionCreateResult = await createPromotion({
        account_id: accountId,
        project_id: projectId,
        ad_name: adName,
        drama_name: dramaName,
        ies_core_user_id: iesCoreUserId,
        materials: sortedMaterials,
        app_id: initData.app_id,
        start_page: initData.start_page,
        app_type: initData.app_type,
        start_params: initData.start_params,
        link: initData.link,
        product_image_uri: initData.product_image_uri,
        product_image_width: initData.product_image_width,
        product_image_height: initData.product_image_height,
      })

      if (promotionCreateResult.code !== 0) {
        const resultMessage = String(promotionCreateResult.msg || '创建广告失败')
        const shouldRetry = isRetryableBuildErrorMessage(resultMessage)

        if (shouldRetry && retryCount < maxRetries) {
          const delayMs = getBuildRetryDelayMs(retryCount)
          buildConsole.warn(
            `[后台搭建] 创建广告返回失败，${Math.round(delayMs / 1000)} 秒后重试 ${retryCount + 1}/${maxRetries}: ${resultMessage}`
          )
          retryCount++
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }

        throw new Error(resultMessage)
      }

      break
    } catch (error) {
      const errorMessage = String(error?.message || '')
      const shouldRetry = isRetryableBuildErrorMessage(errorMessage)
      if (shouldRetry && retryCount < maxRetries) {
        const delayMs = getBuildRetryDelayMs(retryCount)
        buildConsole.warn(
          `[后台搭建] 创建广告失败，${Math.round(delayMs / 1000)} 秒后重试 ${retryCount + 1}/${maxRetries}: ${errorMessage}`
        )
        retryCount++
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }
      throw new Error(`[创建广告] ${errorMessage}`)
    }
  }

  return promotionCreateResult
}

/**
 * 执行搭建流程
 */
async function executeSetup(drama, initData) {
  const dramaName = drama.fields['剧名']?.[0]?.text
  const accountId = drama.fields['账户']?.[0]?.text
  const buildConfig = getBuildConfig()

  if (!dramaName || !accountId) {
    throw new Error('剧集信息不完整')
  }

  buildConsole.log(`[后台搭建] 开始搭建: ${dramaName}`)

  const douyinConfigs = await getDouyinConfigs(drama)
  if (douyinConfigs.length === 0) {
    throw new Error('没有配置抖音号')
  }

  if (buildConfig.clearExistingProjectsBeforeBuild) {
    await clearExistingProjects({
      accountId,
      cookie: getJuliangCookie(),
      logPrefix: buildServiceLogPrefix('后台搭建', getBuildWorkflowLogProfile()),
    })
  }

  const buildTimestamp = formatBuildDate()
  const skippedBatches = []
  let hasSuccessBatch = false

  for (const config of douyinConfigs) {
    try {
      buildConsole.log(`[后台搭建] 正在搭建抖音号: ${config.douyinAccount}`)
      await buildBatchForDouyin(
        drama,
        config,
        { ...initData },
        dramaName,
        accountId,
        buildTimestamp
      )
      hasSuccessBatch = true
      buildConsole.log(`[后台搭建] ✅ 抖音号 ${config.douyinAccount} 批次完成`)
    } catch (error) {
      buildConsole.warn(`[后台搭建] ⚠️ 抖音号 ${config.douyinAccount} 批次跳过: ${error.message}`)
      if (error?.stack) {
        buildConsole.warn(`[后台搭建] ⚠️ 抖音号 ${config.douyinAccount} 错误堆栈:\n${error.stack}`)
      }
      skippedBatches.push({ account: config.douyinAccount, reason: error.message })
    }
  }

  if (!hasSuccessBatch) {
    const skippedInfo = skippedBatches.map(b => `${b.account}: ${b.reason}`).join('; ')
    throw new Error(`所有抖音号批次均失败: ${skippedInfo}`)
  }

  buildConsole.log(
    `[后台搭建] 搭建完成，成功批次: ${douyinConfigs.length - skippedBatches.length}/${douyinConfigs.length}`
  )
  return { success: true, skippedBatches }
}

/**
 * 搭建单个剧集
 */
async function buildSingleDrama(drama) {
  const dramaName = drama.fields['剧名']?.[0]?.text || '未知'

  try {
    // 资产化
    const initData = await executeAssetization(drama)

    // 搭建
    await executeSetup(drama, initData)

    // 更新飞书状态
    const buildTime = Date.now()
    await updateDramaStatus(drama.record_id, '已完成', buildTime, getStatusUpdateTableId(drama), '')

    buildConsole.log(`[后台搭建] ✅ 剧集 ${dramaName} 完成`)
    return { success: true, dramaName }
  } catch (error) {
    buildConsole.error(`[后台搭建] ❌ 剧集 ${dramaName} 失败:`, error.message)
    throw error
  }
}

// ============== 调度器控制 ==============

/**
 * 保存状态到文件
 */
async function saveState(instanceKey = getActiveInstanceKey()) {
  try {
    const entry = ensureSchedulerEntry(instanceKey)
    const filePath = getStateFilePath(instanceKey)
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(entry.state, null, 2), 'utf-8')
  } catch (error) {
    buildConsole.error('[后台搭建] 保存状态失败:', error)
  }
}

/**
 * 从文件加载状态
 */
async function loadState(instanceKey) {
  try {
    const entry = ensureSchedulerEntry(instanceKey)
    const data = await fs.readFile(getStateFilePath(instanceKey), 'utf-8')
    const savedState = JSON.parse(data)
    entry.state = { ...entry.state, ...savedState }
    await runWithSchedulerContext(instanceKey, async () => {
      await ensureSchedulerRuntime(null, instanceKey)
    })
  } catch (error) {
    if (error.code !== 'ENOENT') {
      await runWithSchedulerContext(instanceKey, () => {
        buildConsole.error('[后台搭建] 加载状态失败:', error)
      })
    }
  }
}

/**
 * 执行一次轮询周期
 * 成功则结束本次轮询，失败或跳过则继续下一部
 */
async function executePollingCycle() {
  const entry = getActiveSchedulerEntry()
  const state = entry.state

  if (!state.enabled) return
  const runtime = await ensureSchedulerRuntime(null, state.instanceKey)
  const intervalMs = state.intervalMinutes * 60 * 1000

  // 防止并发执行：如果有任务正在执行，跳过本次轮询
  if (state.currentTask) {
    buildConsole.log('[后台搭建] 检测到任务正在执行，跳过本次轮询:', state.currentTask.dramaName)
    state.nextRunTime = new Date(Date.now() + intervalMs).toISOString()
    await saveState(state.instanceKey)
    // 仍然安排下次轮询
    scheduleNextPolling(state.instanceKey)
    return
  }

  buildConsole.log('[后台搭建] ========== 开始轮询周期 ==========')
  buildConsole.log(
    `[后台搭建] 当前运行时配置，渠道ID: ${runtime.channelId || '-'}，渠道: ${getChannelLabel(runtime)}，${formatAdvanceHoursDebugText(runtime.buildConfig)}`
  )

  // 在轮询开始时立即计算下次运行时间（固定间隔，从现在开始计算）
  const now = new Date()
  state.lastRunTime = now.toISOString()
  state.nextRunTime = new Date(now.getTime() + intervalMs).toISOString()
  await saveState(state.instanceKey)

  try {
    // 1. 查询待搭建剧集
    let dramas = await getPendingSetupDramas()
    buildConsole.log('[后台搭建] 查询到 ' + dramas.length + ' 部待搭建剧集')

    // 2. 循环处理，��到成功或没有剧集
    let dramaIndex = 0
    while (dramas.length > 0) {
      buildConsole.log(
        `[后台搭建] ====== 第 ${dramaIndex + 1} 次尝试，队列中还有 ${dramas.length} 部剧集 ======`
      )
      const selectedDrama = selectHighestPriorityDrama(dramas, {
        currentTime: now,
        buildConfig: getBuildRuleConfig(),
        onSkip: (drama, context) => {
          const dramaName = drama.fields['剧名']?.[0]?.text || '未知'
          buildConsole.log(
            `[优先级选择] 跳过 "${dramaName}"：上架时间 ${context.publishTime.format('YYYY-MM-DD HH:mm')}，最早可搭建时间 ${context.earliestBuildTime?.format('YYYY-MM-DD HH:mm') || '-'}（提前 ${context.advanceHours} 小时）`
          )
        },
      })

      if (!selectedDrama) {
        buildConsole.log('[后台搭建] 未找到符合条件的剧集，等待下次轮询')
        break
      }

      const dramaName = selectedDrama.fields['剧名']?.[0]?.text || '未知'
      // 提取评级、日期和上架时间用于任务历史记录
      const getRatingValue = drama => {
        const ratingField = drama.fields['评级']
        if (ratingField && typeof ratingField === 'object' && 'value' in ratingField) {
          if (Array.isArray(ratingField.value) && ratingField.value[0]) {
            return ratingField.value[0]
          }
        }
        if (Array.isArray(ratingField) && ratingField[0]?.text) {
          return ratingField[0].text
        }
        if (typeof ratingField === 'string') return ratingField
        return null
      }
      const rating = getRatingValue(selectedDrama)
      const date = selectedDrama.fields['日期'] || null
      const publishTime = selectedDrama.fields['上架时间']?.value?.[0] || null
      buildConsole.log(
        '[后台搭建] 选中剧集: ' + dramaName + ' (剩余 ' + (dramas.length - 1) + ' 部)'
      )
      state.currentTask = {
        status: 'building',
        dramaName,
        startTime: new Date().toISOString(),
      }
      await saveState(state.instanceKey)

      // 3. 搭建该剧集
      try {
        await buildSingleDrama(selectedDrama)

        // 成功：更新统计和历史
        state.stats.totalBuilt++
        state.stats.successCount++

        state.taskHistory.unshift({
          dramaName,
          status: 'success',
          rating,
          date,
          publishTime,
          completedAt: new Date().toISOString(),
        })
        if (state.taskHistory.length > 20) {
          state.taskHistory = state.taskHistory.slice(0, 20)
        }

        buildConsole.log('[后台搭建] ✅ 剧集 ' + dramaName + ' 完成，结束本次轮询')

        // 成功后结束本次轮询，等待下一个周期
        state.currentTask = null
        await saveState(state.instanceKey)
        scheduleNextPolling(state.instanceKey)
        return
      } catch (error) {
        // 失败或跳过：记录后继续下一部
        const isSkip = error.code === 'MICROAPP_NOT_APPROVED'
        const action = isSkip ? '跳过' : '失败'

        buildConsole.log('[后台搭建] ⚠️ 剧集 ' + dramaName + ' ' + action + ': ' + error.message)

        if (!isSkip) {
          state.stats.failCount++
        }

        // 更新飞书状态为失败/跳过，并记录原因到备注
        try {
          buildConsole.log('[后台搭建] 准备更新飞书状态...')
          await updateDramaStatus(
            selectedDrama.record_id,
            isSkip ? '跳过搭建' : '搭建失败',
            Date.now(),
            getStatusUpdateTableId(selectedDrama),
            error.message
          )
          buildConsole.log('[后台搭建] ✅ 已更新飞书状态为: ' + (isSkip ? '跳过搭建' : '搭建失败'))
        } catch (feishuError) {
          buildConsole.error('[后台搭建] ❌ 更新飞书状态失败:', feishuError.message)
        }

        buildConsole.log('[后台搭建] 准备更新任务历史...')
        try {
          state.taskHistory.unshift({
            dramaName,
            status: isSkip ? 'skipped' : 'failed',
            rating,
            date,
            publishTime,
            error: error.message,
            completedAt: new Date().toISOString(),
          })
          if (state.taskHistory.length > 20) {
            state.taskHistory = state.taskHistory.slice(0, 20)
          }
          buildConsole.log('[后台搭建] ✅ 任务历史已更新')
        } catch (historyError) {
          buildConsole.error('[后台搭建] ❌ 更新任务历史失败:', historyError.message)
        }

        // 从待处理列表中移除，继续下一部
        buildConsole.log('[后台搭建] 准备从列表移除失败剧集...')
        const beforeFilterCount = dramas.length
        const selectedRecordId = selectedDrama.record_id
        buildConsole.log(`[后台搭建] 待移除的剧集 record_id: ${selectedRecordId}`)
        dramas = dramas.filter(d => d.record_id !== selectedRecordId)
        const afterFilterCount = dramas.length
        buildConsole.log(
          `[后台搭建] 已从列表移除 ${dramaName}，移除前: ${beforeFilterCount} 部，移除后: ${afterFilterCount} 部`
        )
        buildConsole.log('[后台搭建] 继续尝试下一部剧集')
        await saveState(state.instanceKey) // 保存状态，确保 progress 不会丢失
        dramaIndex++ // 增加尝试计数
      }
    }

    state.currentTask = null
    await saveState(state.instanceKey)

    // 所有剧集都跳过/失败，安排下次轮询
    scheduleNextPolling(state.instanceKey)
  } catch (error) {
    buildConsole.error('[后台搭建] 轮询周期异常:', error.message)

    state.currentTask = null
    await saveState(state.instanceKey)

    // 继续下次轮询（不停止）
    scheduleNextPolling(state.instanceKey)
  }
}

/**
 * 安排下次轮询
 * 优先复用 state.nextRunTime，确保展示时间与真实触发时间一致
 */
function scheduleNextPolling(instanceKey = getActiveInstanceKey()) {
  const entry = ensureSchedulerEntry(instanceKey)
  const state = entry.state
  if (!state.intervalMinutes || !state.enabled) return

  const intervalMs = state.intervalMinutes * 60 * 1000
  const nowMs = Date.now()
  const savedNextRunMs = Date.parse(String(state.nextRunTime || ''))
  const hasValidSavedNextRunTime = Number.isFinite(savedNextRunMs)
  const nextRunMs = hasValidSavedNextRunTime ? Math.max(savedNextRunMs, nowMs) : nowMs + intervalMs

  if (entry.timer) {
    clearTimeout(entry.timer)
  }

  state.nextRunTime = new Date(nextRunMs).toISOString()
  entry.timer = setTimeout(
    () => {
      runWithSchedulerContext(instanceKey, () => executePollingCycle())
    },
    Math.max(0, nextRunMs - nowMs)
  )

  void saveState(instanceKey)
}

/**
 * 启动调度器
 */
export async function startScheduler(intervalMinutes, tableId = null, channelRuntime = null) {
  if (!intervalMinutes || intervalMinutes < 1) {
    throw new Error('轮询间隔必须大于等于1分钟')
  }

  const instanceKey = buildRuntimeInstanceKey(channelRuntime || {})
  return runWithSchedulerContext(instanceKey, async () => {
    const entry = ensureSchedulerEntry(instanceKey)
    const state = entry.state
    const runtime = await ensureSchedulerRuntime(channelRuntime, instanceKey)

    buildConsole.log(
      `[后台搭建] 启动调度器，实例: ${instanceKey}，渠道: ${getChannelLabel(runtime)}，轮询间隔: ${intervalMinutes} 分钟，状态更新表格: ${tableId || '默认'}`
    )
    buildConsole.log(
      `[后台搭建] 启动调度器配置快照，渠道ID: ${runtime.channelId || '-'}，${formatAdvanceHoursDebugText(runtime.buildConfig)}`
    )

    state.enabled = true
    state.intervalMinutes = intervalMinutes
    state.tableId = tableId || null
    state.stats = { totalBuilt: 0, successCount: 0, failCount: 0 }
    state.taskHistory = []

    await saveState(instanceKey)
    executePollingCycle()
    return getSchedulerStatus(instanceKey)
  })
}

/**
 * 停止调度器
 */
export async function stopScheduler(channelRuntime = null) {
  const instanceKey = buildRuntimeInstanceKey(channelRuntime || {})
  return runWithSchedulerContext(instanceKey, async () => {
    const entry = ensureSchedulerEntry(instanceKey)
    buildConsole.log('[后台搭建] 停止调度器', instanceKey)

    entry.state.enabled = false
    entry.state.nextRunTime = null

    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }

    await saveState(instanceKey)

    return getSchedulerStatus(instanceKey)
  })
}

/**
 * 获取调度器状态
 */
export function getSchedulerStatus(instanceKey) {
  const state = ensureSchedulerEntry(instanceKey).state
  return {
    instanceKey: state.instanceKey,
    userId: state.userId,
    runtimeUserName: state.runtimeUserName,
    channelId: state.channelId,
    channelName: state.channelName,
    enabled: state.enabled,
    intervalMinutes: state.intervalMinutes,
    tableId: state.tableId,
    nextRunTime: state.nextRunTime,
    lastRunTime: state.lastRunTime,
    stats: { ...state.stats },
    currentTask: state.currentTask ? { ...state.currentTask } : null,
    taskHistory: [...state.taskHistory],
  }
}

export async function listSchedulerStatuses() {
  const persistedKeys = await listPersistedInstanceKeys()
  const instanceKeys = Array.from(new Set([...Object.keys(schedulerInstances), ...persistedKeys]))

  for (const instanceKey of instanceKeys) {
    if (!schedulerInstances[instanceKey]) {
      await loadState(instanceKey)
    }
  }

  return instanceKeys.map(instanceKey => getSchedulerStatus(instanceKey))
}

/**
 * 初始化调度器（服务启动时调用）
 */
export async function initScheduler() {
  globalThis.console.log('[后台搭建] 初始化调度器...')
  const instanceKeys = await listPersistedInstanceKeys()

  for (const instanceKey of instanceKeys) {
    await runWithSchedulerContext(instanceKey, async () => {
      await loadState(instanceKey)
      const state = ensureSchedulerEntry(instanceKey).state

      if (state.currentTask) {
        buildConsole.log('[后台搭建] 检测到遗留任务:', instanceKey, state.currentTask.dramaName)
        buildConsole.log('[后台搭建] 检测到任务可能因发版重启被中断，启动后立即补跑')
        state.currentTask = null
        state.nextRunTime = new Date().toISOString()
        await saveState(instanceKey)
      }

      if (state.enabled && state.intervalMinutes) {
        const savedNextRunMs = Date.parse(String(state.nextRunTime || ''))
        if (Number.isFinite(savedNextRunMs) && savedNextRunMs <= Date.now()) {
          buildConsole.log('[后台搭建] 检测到已过点的轮询任务，立即补跑:', instanceKey)
        } else {
          buildConsole.log('[后台搭建] 恢复定时任务...', instanceKey, state.nextRunTime || '')
        }
        scheduleNextPolling(instanceKey)
      }

      buildConsole.log('[后台搭建] 调度器状态:', instanceKey, state.enabled ? '运行中' : '已停止')
    })
  }
}

/**
 * 触发立即���行一次搭建（手动触发）
 * @param {string} specificDramaId - 可选，指定要搭建的剧集ID
 */
export async function triggerSchedulerBuild(
  specificDramaId = null,
  tableId,
  channelRuntime = null
) {
  const instanceKey = buildRuntimeInstanceKey(channelRuntime || {})
  return runWithSchedulerContext(instanceKey, async () => {
    const entry = ensureSchedulerEntry(instanceKey)
    const state = entry.state
    const runtime = await ensureSchedulerRuntime(channelRuntime, instanceKey)
    buildConsole.log(
      '[后台搭建] 手动触发搭建任务',
      `实例: ${instanceKey}`,
      `渠道: ${getChannelLabel(runtime)}`,
      specificDramaId ? `指定剧集: ${specificDramaId}` : '',
      tableId ? `覆盖状态表格: ${tableId}` : ''
    )

    if (!state.enabled) {
      throw new Error('后台调度器未启动，无法手动触发搭建')
    }

    if (state.currentTask) {
      throw new Error(`已有任务正在执行: ${state.currentTask.dramaName}，请等待完成后再试`)
    }

    if (typeof tableId !== 'undefined') {
      state.tableId = tableId || null
      await saveState(instanceKey)
    }

    if (specificDramaId) {
      await buildSpecificDrama(specificDramaId)
    } else {
      await executePollingCycle()
    }

    return getSchedulerStatus(instanceKey)
  })
}

/**
 * 搭建指定的剧集
 * @param {string} dramaId - 剧集record_id
 */
async function buildSpecificDrama(dramaId) {
  const state = getActiveSchedulerState()
  buildConsole.log(`[后台搭建] 开始搭建指定剧集: ${dramaId}`)
  state.lastRunTime = new Date().toISOString()

  try {
    // 1. 查询待搭建剧集
    const dramas = await getPendingSetupDramas()
    buildConsole.log(`[后台搭建] 查询到 ${dramas.length} 部待搭建剧集`)

    // 2. 找到指定的剧集
    const targetDrama = dramas.find(d => d.record_id === dramaId)
    if (!targetDrama) {
      throw new Error(`找不到剧集ID: ${dramaId}`)
    }

    const dramaName = targetDrama.fields['剧名']?.[0]?.text || '未知'
    const publishTime = getDramaPublishTime(targetDrama)
    if (!publishTime) {
      throw new Error(`剧集 ${dramaName} 缺少上架时间，无法提交搭建`)
    }

    const buildRuleConfig = getBuildRuleConfig()
    const earliestBuildTime = getEarliestBuildTime(targetDrama, buildRuleConfig)
    if (!earliestBuildTime) {
      throw new Error(`剧集 ${dramaName} 缺少最早可搭建时间，无法提交搭建`)
    }

    if (!canBuildDramaNow(targetDrama, new Date(), buildRuleConfig)) {
      throw new Error(
        `剧集 ${dramaName} 未到可搭建时间，最早可在 ${earliestBuildTime.format('YYYY-MM-DD HH:mm')} 提交搭建`
      )
    }

    buildConsole.log(`[后台搭建] 找到指定剧集: ${dramaName}`)
    state.currentTask = {
      status: 'building',
      dramaName,
      startTime: new Date().toISOString(),
    }
    await saveState(state.instanceKey)

    // 3. 搭建该剧集
    await buildSingleDrama(targetDrama)

    // 4. 更新统计
    state.stats.totalBuilt++
    state.stats.successCount++

    // 5. 记录历史
    state.taskHistory.unshift({
      dramaName,
      status: 'success',
      completedAt: new Date().toISOString(),
    })
    if (state.taskHistory.length > 20) {
      state.taskHistory = state.taskHistory.slice(0, 20)
    }

    state.currentTask = null
    await saveState(state.instanceKey)
  } catch (error) {
    buildConsole.error('[后台搭建] 指定剧集搭建失败:', error.message)
    state.stats.failCount++

    const dramaName = state.currentTask?.dramaName || '未知'
    state.taskHistory.unshift({
      dramaName,
      status: 'failed',
      error: error.message,
      completedAt: new Date().toISOString(),
    })
    if (state.taskHistory.length > 20) {
      state.taskHistory = state.taskHistory.slice(0, 20)
    }

    state.currentTask = null
    await saveState(state.instanceKey)
    throw error
  }
}
