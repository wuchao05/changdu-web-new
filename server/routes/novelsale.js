import Router from '@koa/router'
import { createGetHandler } from '../utils/apiHandler.js'
import {
  buildRequestPath,
  generateChangduABogus,
  requestChangduInternalApi,
} from '../utils/changduInternalApi.js'
import { isMultiUserChannel, listUsers, resolveRuntimeContext } from '../utils/studioData.js'
import { getSessionUser } from '../utils/studioSession.js'

const router = new Router()
const SECONDS_PER_DAY = 24 * 60 * 60
const MAX_ORDER_RANGE_DAYS = 10
const AUTO_RED_FLAG_START_HOUR = 0
const AUTO_RED_FLAG_END_HOUR = 1
const FEISHU_DRAMA_STATUS_CHUNK_SIZE = 40
const feishuDramaStatusInflightMap = new Map()

function getPublishHour(publishTime) {
  if (!publishTime) return null

  const timeMatch = String(publishTime)
    .trim()
    .match(/(?:T|\s)(\d{1,2}):\d{2}(?::\d{2})?/)
  if (!timeMatch) return null

  return Number(timeMatch[1])
}

function isAutoRedFlagPublishTime(publishTime) {
  const publishHour = getPublishHour(publishTime)
  if (!Number.isInteger(publishHour)) return false

  return publishHour >= AUTO_RED_FLAG_START_HOUR && publishHour <= AUTO_RED_FLAG_END_HOUR
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

function buildFeishuDramaStatusKey(tableId, dramas) {
  const names = dramas.map(item => normalizeDramaName(item.series_name)).sort()
  return `${String(tableId || '').trim()}::${names.join('|')}`
}

async function getFeishuAccessToken() {
  const tokenResponse = await fetch(
    `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.token_endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: FEISHU_CONFIG.app_id,
        app_secret: FEISHU_CONFIG.app_secret,
      }),
    }
  )

  const tokenData = await tokenResponse.text()
  let tokenJson
  try {
    tokenJson = JSON.parse(tokenData)
  } catch {
    throw new Error('飞书 token 响应解析失败')
  }

  if (tokenJson.code !== 0) {
    throw new Error(tokenJson.msg || '获取飞书 access token 失败')
  }

  return tokenJson.tenant_access_token
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
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
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

    const text = await response.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error('飞书剧集清单响应解析失败')
    }

    if (json.code !== 0) {
      throw new Error(json.msg || json.message || '飞书剧集清单查询失败')
    }

    items.push(...(Array.isArray(json.data?.items) ? json.data.items : []))
    pageToken = String(json.data?.page_token || '')
  } while (pageToken)

  return items
}

async function queryFeishuDramaStatusByNames(tableId, dramas) {
  const normalizedDramas = normalizeFeishuStatusDramas(dramas)
  if (normalizedDramas.length === 0) {
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

async function queryFeishuDramaStatusShared(tableId, dramas) {
  const normalizedDramas = normalizeFeishuStatusDramas(dramas)
  const key = buildFeishuDramaStatusKey(tableId, normalizedDramas)
  const inflight = feishuDramaStatusInflightMap.get(key)

  if (inflight) {
    return inflight
  }

  const promise = queryFeishuDramaStatusByNames(tableId, normalizedDramas).finally(() => {
    feishuDramaStatusInflightMap.delete(key)
  })
  feishuDramaStatusInflightMap.set(key, promise)

  return promise
}

/**
 * 根据抖音号列表过滤订单数据，推广链包含任一抖音号即命中。
 * @param {Array} orders - 订单列表
 * @param {string} douyinAccountsStr - 逗号分隔的抖音号字符串
 * @returns {Array} 过滤后的订单列表
 */
function filterOrdersByDouyinAccounts(orders, douyinAccountsStr) {
  if (!douyinAccountsStr || !orders || !Array.isArray(orders)) {
    return orders
  }

  const accountsArray = douyinAccountsStr
    .split(',')
    .map(acc => acc.trim())
    .filter(Boolean)
  if (accountsArray.length === 0) {
    return orders
  }

  return orders.filter(order => {
    const promotionName = String(order?.promotion_name || '').trim()
    return accountsArray.some(account => promotionName.includes(account))
  })
}

function collectUserDouyinAccountNames(user = {}) {
  return Array.isArray(user?.douyinAccounts)
    ? user.douyinAccounts
        .map(item => String(item?.douyinAccount || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
    : []
}

function filterOrdersByPromotionAliases(orders = [], aliases = []) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return []
  }

  const normalizedAliases = Array.isArray(aliases)
    ? aliases.map(item => String(item || '').trim()).filter(Boolean)
    : []
  if (normalizedAliases.length === 0) {
    return []
  }

  return orders.filter(order => {
    return normalizedAliases.some(alias =>
      isPromotionNameMatchedByAlias(order?.promotion_name, alias)
    )
  })
}

function isPromotionNameMatchedByAlias(promotionName, alias) {
  const normalizedName = String(promotionName || '').trim()
  const normalizedAlias = String(alias || '').trim()
  if (!normalizedName || !normalizedAlias) {
    return false
  }

  return normalizedName.includes(normalizedAlias)
}

function normalizeOrderUserStatsConfig(config = {}) {
  const usernames = Array.isArray(config?.usernames)
    ? config.usernames
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
    : []
  const childUserIds = Array.isArray(config?.childUserIds)
    ? config.childUserIds
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
    : []

  return {
    enabled: Boolean(config?.enabled),
    usernames,
    childUserIds,
    matchTargets: usernames.map(username => ({
      username,
      aliases: [username],
    })),
  }
}

function normalizePromotionUserTargets(targets = []) {
  const targetMap = new Map()

  ;(Array.isArray(targets) ? targets : []).forEach(target => {
    const username = String(typeof target === 'string' ? target : target?.username || '').trim()
    if (!username) {
      return
    }

    const aliases = Array.isArray(target?.aliases)
      ? target.aliases.map(item => String(item || '').trim()).filter(Boolean)
      : [username]
    const current = targetMap.get(username) || {
      username,
      aliases: [],
    }

    aliases.forEach(alias => {
      if (!current.aliases.includes(alias)) {
        current.aliases.push(alias)
      }
    })
    targetMap.set(username, current)
  })

  return [...targetMap.values()]
}

function calculateRechargeAmount(orders = []) {
  return orders.reduce((sum, order) => {
    if (order?.pay_status === 0 && order?.pay_amount) {
      return sum + order.pay_amount
    }
    return sum
  }, 0)
}

function isOrderMatchedByTarget(order, target = {}) {
  const aliases = Array.isArray(target.aliases)
    ? target.aliases.map(item => String(item || '').trim()).filter(Boolean)
    : []

  return aliases.some(alias => isPromotionNameMatchedByAlias(order?.promotion_name, alias))
}

function buildPromotionUserSummaries(orders = [], targets = []) {
  const normalizedTargets = normalizePromotionUserTargets(targets)

  return normalizedTargets.map(target => {
    const matchedOrders = orders.filter(order => isOrderMatchedByTarget(order, target))
    return {
      username: target.username,
      aliases: target.aliases,
      total: matchedOrders.length,
      total_amount: calculateRechargeAmount(matchedOrders),
      paid_order_count: matchedOrders.filter(order => order?.pay_status === 0).length,
    }
  })
}

function buildPromotionDetailQuery(query = {}, overrides = {}) {
  const nextQuery = {
    ...query,
    ...overrides,
  }

  delete nextQuery.channel_douyin_accounts
  delete nextQuery.promotion_user_name

  return nextQuery
}

function normalizeTimestamp(value) {
  const numericValue = Number(value || 0)
  return Number.isFinite(numericValue) ? Math.floor(numericValue) : 0
}

function splitOrderTimeRange(beginTime, endTime, maxDays = MAX_ORDER_RANGE_DAYS) {
  const normalizedBegin = normalizeTimestamp(beginTime)
  const normalizedEnd = normalizeTimestamp(endTime)

  if (!normalizedBegin || !normalizedEnd || normalizedEnd < normalizedBegin) {
    return []
  }

  const ranges = []
  let currentBegin = normalizedBegin
  const maxRangeSeconds = maxDays * SECONDS_PER_DAY

  while (currentBegin <= normalizedEnd) {
    const currentEnd = Math.min(normalizedEnd, currentBegin + maxRangeSeconds - 1)
    ranges.push({
      begin_time: currentBegin,
      end_time: currentEnd,
    })
    currentBegin = currentEnd + 1
  }

  return ranges
}

async function fetchAllOrdersByRange(ctx, timeRange) {
  const rangeOrders = []
  let currentFetchIndex = 0
  const fetchPageSize = 1000
  let hasMoreData = true

  while (hasMoreData) {
    // console.log(
    //   `🔄 [订单统计] 时间段 ${timeRange.begin_time}-${timeRange.end_time} 第 ${currentFetchIndex + 1} 次请求，已有 ${rangeOrders.length} 条`
    // )

    const modifiedQuery = buildPromotionDetailQuery(ctx.query, {
      begin_time: String(timeRange.begin_time),
      end_time: String(timeRange.end_time),
      page_size: fetchPageSize.toString(),
      page_index: currentFetchIndex.toString(),
    })

    const originalQuery = ctx.query
    ctx.query = modifiedQuery

    await createGetHandler('Promotion Detail', '/novelsale/distributor/promotion/detail/v2/')(ctx)

    ctx.query = originalQuery

    if (!ctx.body || !Array.isArray(ctx.body.data)) {
      // console.log(
      //   `⚠️ [订单统计] 时间段 ${timeRange.begin_time}-${timeRange.end_time} 响应格式错误，停止`
      // )
      break
    }

    const batchOrders = ctx.body.data
    const batchTotal = ctx.body.total || 0

    if (batchOrders.length === 0) {
      // console.log(`✅ [订单统计] 时间段 ${timeRange.begin_time}-${timeRange.end_time} 已到末尾`)
      break
    }

    rangeOrders.push(...batchOrders)

    // console.log(
    //   `  📦 时间段 ${timeRange.begin_time}-${timeRange.end_time}: 本批 ${batchOrders.length} 条，总计 ${batchTotal} 条，累计 ${rangeOrders.length} 条`
    // )

    const fetchedCount = (currentFetchIndex + 1) * fetchPageSize
    if (fetchedCount >= batchTotal) {
      hasMoreData = false
    }

    currentFetchIndex++
  }

  return {
    orders: rangeOrders,
  }
}

function buildUserOrderStatsTarget(user) {
  const username = String(user?.nickname || user?.account || user?.id || '').trim()
  const aliases = collectUserDouyinAccountNames(user)

  if (!username) {
    return null
  }

  return {
    username,
    aliases,
  }
}

function getUserOrderStatsNameCandidates(user = {}) {
  return [user?.nickname, user?.account, user?.id]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
}

function buildConfiguredOrderStatsUserTargets(users = [], usernames = []) {
  const normalizedUsernames = Array.isArray(usernames)
    ? usernames.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const userList = Array.isArray(users) ? users : []

  return normalizedUsernames
    .map(username => {
      const matchedUser = userList.find(user =>
        getUserOrderStatsNameCandidates(user).includes(username)
      )

      if (!matchedUser) {
        return null
      }

      return {
        username,
        aliases: [username],
      }
    })
    .filter(Boolean)
}

function buildConfiguredUserOrderStatsTargets(configTargets = [], userTargets = []) {
  const userTargetMap = new Map(
    userTargets.filter(target => target?.username).map(target => [target.username, target])
  )
  const resolvedUsernameSet = new Set()
  const displayTargets = (Array.isArray(configTargets) ? configTargets : []).map(target => {
    const username = String(target?.username || '').trim()
    const userTarget = userTargetMap.get(username)

    if (userTarget) {
      resolvedUsernameSet.add(username)
      return {
        username,
        aliases: userTarget.aliases,
      }
    }

    return target
  })
  const appendTargets = userTargets.filter(target => {
    if (!target?.username || resolvedUsernameSet.has(target.username)) {
      return false
    }
    resolvedUsernameSet.add(target.username)
    return true
  })

  return normalizePromotionUserTargets([...displayTargets, ...appendTargets])
}

function appendTargetAliases(target, aliases = []) {
  if (!target) {
    return null
  }

  return {
    ...target,
    aliases: [...(target.aliases || []), ...aliases].filter(
      (item, index, list) => item && list.indexOf(item) === index
    ),
  }
}

async function resolveOrderUserStatsRuntime(ctx) {
  const sessionUser = await getSessionUser(ctx)
  if (!sessionUser) {
    return normalizeOrderUserStatsConfig()
  }

  const requestedChannelId = String(ctx.get('x-studio-channel-id') || '').trim()
  const runtimeContext = await resolveRuntimeContext(sessionUser, requestedChannelId)
  if (!isMultiUserChannel(runtimeContext.channel)) {
    return normalizeOrderUserStatsConfig()
  }

  const config = normalizeOrderUserStatsConfig(runtimeContext.runtimeUser?.orderUserStats)
  const isAdminUser = sessionUser.userType === 'admin'
  const isParentUser = config.enabled && config.childUserIds.length > 0
  const ownDouyinAccounts = collectUserDouyinAccountNames(runtimeContext.runtimeUser)
  const scopedConfig = {
    ...config,
    canViewAllOrders: isAdminUser || isParentUser,
    restrictToOwnDouyinAccounts: !isAdminUser && !isParentUser,
    ownDouyinAccounts,
  }

  if (!config.enabled) {
    return scopedConfig
  }

  const users = await listUsers()
  const childUserIdSet = new Set(config.childUserIds)
  const childUserMap = new Map(
    users
      .filter(user => user.userType !== 'admin' && childUserIdSet.has(user.id))
      .map(user => [user.id, user])
  )
  const configuredUserTargets = buildConfiguredOrderStatsUserTargets(
    [runtimeContext.runtimeUser, ...users],
    config.usernames
  )
  const childUserTargets = config.childUserIds
    .map(userId => buildUserOrderStatsTarget(childUserMap.get(userId)))
    .filter(Boolean)
  const parentNameCandidates = getUserOrderStatsNameCandidates(runtimeContext.runtimeUser)
  const childAliases = childUserTargets.flatMap(target => target.aliases || [])
  const configuredParentTarget = configuredUserTargets.find(target =>
    parentNameCandidates.includes(target.username)
  )
  const parentBranchTarget = configuredParentTarget
    ? {
        username: configuredParentTarget.username,
        aliases: ownDouyinAccounts,
      }
    : null
  const topLevelUserTargets = configuredUserTargets.map(target =>
    parentNameCandidates.includes(target.username)
      ? appendTargetAliases(target, childAliases)
      : target
  )

  return {
    ...scopedConfig,
    matchTargets: buildConfiguredUserOrderStatsTargets(config.matchTargets, topLevelUserTargets),
    branchTargets: normalizePromotionUserTargets([parentBranchTarget, ...childUserTargets]),
  }
}

async function resolveRuntimeFeishuConfig(ctx) {
  const sessionUser = await getSessionUser(ctx)
  if (!sessionUser) {
    return {
      requestedChannelId: '',
      channelId: '',
      channelName: '',
      runtimeUserId: '',
      runtimeUserName: '',
      dramaListTableId: '',
      dramaStatusTableId: '',
      accountTableId: '',
    }
  }

  const requestedChannelId = String(ctx.get('x-studio-channel-id') || '').trim()
  const runtimeContext = await resolveRuntimeContext(sessionUser, requestedChannelId)

  return {
    requestedChannelId,
    channelId: String(runtimeContext.channel?.id || '').trim(),
    channelName: String(runtimeContext.channel?.name || '').trim(),
    runtimeUserId: String(runtimeContext.runtimeUser?.id || '').trim(),
    runtimeUserName: String(
      runtimeContext.runtimeUser?.nickname || runtimeContext.runtimeUser?.account || ''
    ).trim(),
    dramaListTableId: String(runtimeContext.runtimeUser?.feishu?.dramaListTableId || '').trim(),
    dramaStatusTableId: String(runtimeContext.runtimeUser?.feishu?.dramaStatusTableId || '').trim(),
    accountTableId: String(runtimeContext.runtimeUser?.feishu?.accountTableId || '').trim(),
  }
}

function resolveDramaListTableId(runtimeFeishuConfig, requestedTableId) {
  return (
    String(requestedTableId || '').trim() ||
    String(runtimeFeishuConfig?.dramaListTableId || '').trim() ||
    FEISHU_CONFIG.table_ids.drama_list
  )
}

// 通过短剧名称获取 copyright_content_id，作为内部接口关键词查询失败时的兜底
async function getDramaIdByTitle(title) {
  void title
  return null
}

const FEISHU_CONFIG = {
  app_id: 'cli_a870f7611b7b1013',
  app_secret: 'NTwHbZG8rpOQyMEnXGPV6cNQ84KEqE8z',
  api_base_url: 'https://open.feishu.cn/open-apis',
  app_token: 'WdWvbGUXXaokk8sAS94c00IZnsf',
  token_endpoint: '/auth/v3/tenant_access_token/internal',
  table_ids: {
    drama_list: 'tblvuZhBd4drW26n',
    drama_status: 'tblDOyi2Lzs80sv0',
    account: 'tbl0PVvAOHKGcWLs',
  },
}

// 应用概览列表 - 支持抖音号过滤
router.get('/distributor/application_overview_list/v1', async ctx => {
  // 先调用原始handler获取数据
  await createGetHandler(
    'Application Overview List',
    '/novelsale/distributor/application_overview_list/v1/'
  )(ctx)

  // 如果有抖音号过滤参数，需要额外设计聚合后的报表过滤逻辑
  // 注意：报表数据的过滤比较复杂，因为需要重新聚合统计数据
  // 这里暂时不过滤，因为报表数据通常是按日期聚合的，不是按订单明细
  // 如果需要过滤，应该在前端获取订单明细后自行聚合
  const channelDouyinAccounts = ctx.query.channel_douyin_accounts
  if (channelDouyinAccounts && ctx.body && ctx.body.data) {
    // TODO: 如果需要对报表数据进行过滤，需要重新设计聚合逻辑
    // 目前报表数据是后端已经聚合好的，无法直接按抖音号过滤
    // 建议：如需按抖音号过滤，可在前端用订单明细重新聚合
  }
})

// 推广详情 - 统一全量拉取后返回给前端分页
router.get('/distributor/promotion/detail/v2', async ctx => {
  const channelDouyinAccounts = ctx.query.channel_douyin_accounts
  const selectedPromotionUserName = String(ctx.query.promotion_user_name || '').trim()
  const orderUserStatsConfig = await resolveOrderUserStatsRuntime(ctx)
  const promotionUserTargets =
    orderUserStatsConfig.enabled && orderUserStatsConfig.canViewAllOrders
      ? normalizePromotionUserTargets(orderUserStatsConfig.matchTargets)
      : []
  const configuredPromotionUsernames = promotionUserTargets.map(target => target.username)
  const shouldBuildPromotionUserStats = promotionUserTargets.length > 0

  // console.log('🔍 [订单统计] 开始拉取全量数据用于本地统计', {
  //   channelDouyinAccounts: channelDouyinAccounts || '',
  //   promotionUsers: configuredPromotionUsernames,
  //   selectedPromotionUserName,
  // })

  const timeRanges = splitOrderTimeRange(ctx.query.begin_time, ctx.query.end_time)
  const queryRanges =
    timeRanges.length > 0
      ? timeRanges
      : [
          {
            begin_time: normalizeTimestamp(ctx.query.begin_time),
            end_time: normalizeTimestamp(ctx.query.end_time),
          },
        ]

  // console.log(
  //   `🧩 [订单统计] 当前查询将拆分为 ${queryRanges.length} 个时间段，按最多 ${MAX_ORDER_RANGE_DAYS} 天一段拉取`
  // )

  const allOrders = []

  for (const timeRange of queryRanges) {
    const rangeResult = await fetchAllOrdersByRange(ctx, timeRange)
    allOrders.push(...rangeResult.orders)
  }

  const scopedOrders = orderUserStatsConfig.restrictToOwnDouyinAccounts
    ? filterOrdersByPromotionAliases(allOrders, orderUserStatsConfig.ownDouyinAccounts)
    : allOrders
  const douyinFilteredOrders = filterOrdersByDouyinAccounts(scopedOrders, channelDouyinAccounts)
  const promotionUserSummaries = shouldBuildPromotionUserStats
    ? buildPromotionUserSummaries(douyinFilteredOrders, promotionUserTargets)
    : []
  const promotionUserBranchSummaries = shouldBuildPromotionUserStats
    ? buildPromotionUserSummaries(douyinFilteredOrders, orderUserStatsConfig.branchTargets || [])
    : []
  const resolvedActivePromotionUserName =
    shouldBuildPromotionUserStats &&
    configuredPromotionUsernames.includes(selectedPromotionUserName)
      ? selectedPromotionUserName
      : ''
  const activePromotionUserTarget = promotionUserTargets.find(
    target => target.username === resolvedActivePromotionUserName
  )
  const activeOrders = activePromotionUserTarget
    ? douyinFilteredOrders.filter(order => isOrderMatchedByTarget(order, activePromotionUserTarget))
    : douyinFilteredOrders
  const totalAmount = calculateRechargeAmount(activeOrders)
  const allTotalAmount = calculateRechargeAmount(douyinFilteredOrders)

  // console.log(
  //   `✅ [订单统计] 完成: 共拉取 ${allOrders.length} 条数据，筛选后 ${activeOrders.length} 条，当前总充值: ${totalAmount / 100} 元`
  // )

  // 返回所有数据给前端
  ctx.body = {
    code: 0,
    message: 'success',
    data: activeOrders,
    total: activeOrders.length,
    total_amount: totalAmount, // 总充值金额（单位：分）
    all_total: douyinFilteredOrders.length,
    all_total_amount: allTotalAmount,
    active_promotion_user_name: resolvedActivePromotionUserName,
    promotion_user_stats_enabled: shouldBuildPromotionUserStats,
    order_visibility_scope: orderUserStatsConfig.restrictToOwnDouyinAccounts ? 'own' : 'all',
    promotion_user_summaries: promotionUserSummaries,
    promotion_user_branch_summaries: promotionUserBranchSummaries,
  }
})

// 登录
router.get('/distributor/login/v1', createGetHandler('Login', '/novelsale/distributor/login/v1/'))

// 通用 a_bogus 生成接口
router.post('/a-bogus', async ctx => {
  try {
    const requestBody =
      ctx.request.body && typeof ctx.request.body === 'object' && !Array.isArray(ctx.request.body)
        ? ctx.request.body
        : {}
    const requestHeaders = ctx.headers || {}
    const normalizedMethod = String(requestBody.method || 'GET').toUpperCase()
    const rawUrl = requestBody.url ? String(requestBody.url) : ''
    const inputParams =
      requestBody.params &&
      typeof requestBody.params === 'object' &&
      !Array.isArray(requestBody.params)
        ? requestBody.params
        : {}

    if (!rawUrl) {
      ctx.status = 400
      ctx.body = {
        code: 400,
        message: '缺少 url',
      }
      return
    }

    if (
      requestBody.params !== undefined &&
      (!requestBody.params ||
        typeof requestBody.params !== 'object' ||
        Array.isArray(requestBody.params))
    ) {
      ctx.status = 400
      ctx.body = {
        code: 400,
        message: 'params 必须是对象',
      }
      return
    }

    let parsedUrl
    try {
      parsedUrl = new URL(rawUrl)
    } catch {
      ctx.status = 400
      ctx.body = {
        code: 400,
        message: 'url 不是合法地址',
      }
      return
    }

    const pathname = parsedUrl.pathname
    let mergedQuery = Object.fromEntries(parsedUrl.searchParams.entries())
    let inputPayloadBody = null

    if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') {
      mergedQuery = { ...mergedQuery, ...inputParams }
    } else {
      inputPayloadBody = inputParams
    }

    const sanitizedHeaders = {
      aduserid: String(requestHeaders.aduserid || ''),
      distributorid: String(requestHeaders.distributorid || ''),
      appid: String(requestHeaders.appid || ''),
      // 这两个字段对外不开放，统一由服务端固定写死
      apptype: '7',
      agwJsConv: 'str',
    }

    const missingHeaders = ['aduserid', 'distributorid', 'appid'].filter(
      key => !sanitizedHeaders[key]
    )

    if (missingHeaders.length > 0) {
      ctx.status = 400
      ctx.body = {
        code: 400,
        message: `缺少必要请求头: ${missingHeaders.join(', ')}`,
      }
      return
    }

    const { aBogus, encodedABogus } = await generateChangduABogus({
      method: normalizedMethod,
      pathname,
      query: mergedQuery,
      body: inputPayloadBody,
      headers: sanitizedHeaders,
    })

    ctx.body = {
      code: 0,
      message: 'success',
      data: {
        method: normalizedMethod,
        pathname,
        request_path: buildRequestPath(pathname, mergedQuery),
        a_bogus: aBogus,
        encoded_a_bogus: encodedABogus,
      },
    }
  } catch (error) {
    console.error('[a_bogus接口] 生成失败:', {
      body: ctx.request.body,
      message: error.message,
      stack: error.stack,
    })
    ctx.status = 500
    ctx.body = {
      code: 500,
      message: '生成 a_bogus 失败',
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
})

router.post('/distributor/content/series/feishu-status/v1', async ctx => {
  try {
    const runtimeFeishuConfig = await resolveRuntimeFeishuConfig(ctx)
    const targetDramaListTableId = resolveDramaListTableId(
      runtimeFeishuConfig,
      ctx.request.body?.drama_list_table_id
    )
    const dramas = normalizeFeishuStatusDramas(ctx.request.body?.dramas)

    if (dramas.length === 0) {
      ctx.status = 200
      ctx.body = {
        code: 0,
        message: 'success',
        data: [],
      }
      return
    }

    const data = await queryFeishuDramaStatusShared(targetDramaListTableId, dramas)
    ctx.status = 200
    ctx.body = {
      code: 0,
      message: 'success',
      data,
    }
  } catch (error) {
    console.error('[新剧抢跑] 批量查询飞书剧集状态失败:', {
      message: error.message,
      stack: error.stack,
    })
    ctx.status = 200
    ctx.body = {
      code: 500,
      message: error.message || '批量查询飞书剧集状态失败',
      data: [],
    }
  }
})

// 系列列表 - 通过服务端直连常读内部接口，可按参数跳过飞书状态补齐
router.get('/distributor/content/series/list/v1', async ctx => {
  try {
    const runtimeFeishuConfig = await resolveRuntimeFeishuConfig(ctx)
    const targetDramaListTableId = resolveDramaListTableId(
      runtimeFeishuConfig,
      ctx.query.drama_list_table_id
    )
    console.log(
      '[爆剧爆剪-剧集查询] 飞书表配置:',
      JSON.stringify({
        requestedChannelId: runtimeFeishuConfig.requestedChannelId,
        channelId: runtimeFeishuConfig.channelId,
        channelName: runtimeFeishuConfig.channelName,
        runtimeUserId: runtimeFeishuConfig.runtimeUserId,
        runtimeUserName: runtimeFeishuConfig.runtimeUserName,
        requestedDramaListTableId: String(ctx.query.drama_list_table_id || '').trim(),
        resolvedDramaListTableId: targetDramaListTableId,
        query: String(ctx.query.query || '').trim(),
        pageIndex: String(ctx.query.page_index || '').trim(),
      })
    )

    const parsedPageIndex = parseInt(ctx.query.page_index, 10)
    const pageIndex = Number.isNaN(parsedPageIndex) ? 0 : Math.max(parsedPageIndex, 0)
    const rawQueryValue = String(ctx.query.query || '').trim()
    const isSearchRequest = Boolean(rawQueryValue)
    const isNumericSearchRequest = isSearchRequest && /^\d+$/.test(rawQueryValue)

    // 构建请求参数
    const params = {
      permission_statuses: '3,4',
      aweme_user_new_version: 'false',
      page_index: pageIndex,
      page_size: parseInt(ctx.query.page_size) || 100,
    }

    if (!isSearchRequest) {
      params.sort_type = 1
      params.sort_field = 3
    }

    // 添加可选参数
    if (ctx.query.permission_statuses) {
      params.permission_statuses = ctx.query.permission_statuses
    }
    if (!isSearchRequest && ctx.query.sort_type !== undefined) {
      params.sort_type = parseInt(ctx.query.sort_type, 10)
    }
    if (!isSearchRequest && ctx.query.sort_field !== undefined) {
      params.sort_field = parseInt(ctx.query.sort_field, 10)
    }
    if (rawQueryValue) {
      params.query = rawQueryValue
      params.delivery_status = 1
    }
    if (isNumericSearchRequest) {
      params.search_type = 1
    } else if (ctx.query.search_type !== undefined) {
      params.search_type = parseInt(ctx.query.search_type, 10)
    }
    if (ctx.query.gender !== undefined) {
      params.gender = parseInt(ctx.query.gender, 10)
    }
    if (ctx.query.creation_status !== undefined) {
      params.creation_status = parseInt(ctx.query.creation_status, 10)
    }
    if (ctx.query.delivery_status !== undefined) {
      params.delivery_status = parseInt(ctx.query.delivery_status, 10)
    }

    // console.log('[新剧抢跑] 转发常读参数:', params)

    const directResult = await requestChangduInternalApi({
      method: 'GET',
      pathname: '/novelsale/distributor/content/series/list/v1/',
      query: params,
      ctx,
    })
    let apiResult = directResult.data

    if (
      params.query &&
      apiResult.code === 4000 &&
      apiResult.message === 'Unsupported Search Type'
    ) {
      console.warn('[新剧抢跑] 关键词直查不支持，开始兜底转短剧ID:', {
        query: params.query,
      })
      const dramaId = await getDramaIdByTitle(params.query)
      console.log('[新剧抢跑] 兜底转短剧ID结果:', {
        query: params.query,
        dramaId: dramaId || '',
      })
      if (dramaId) {
        const fallbackResult = await requestChangduInternalApi({
          method: 'GET',
          pathname: '/novelsale/distributor/content/series/list/v1/',
          query: {
            ...params,
            query: dramaId,
            search_type: undefined,
          },
          ctx,
        })
        apiResult = fallbackResult.data
      }
    }

    // console.log('[新剧抢跑] 常读返回结果:', {
    //   code: apiResult?.code,
    //   message: apiResult?.message || '',
    //   dataCount: Array.isArray(apiResult?.data?.data) ? apiResult.data.data.length : undefined,
    // })

    // 转换数据格式以保持前端兼容性
    if (apiResult.code === 0) {
      const dramaList = Array.isArray(apiResult.data?.data) ? apiResult.data.data : []
      const markedDramaList = dramaList.map(drama => ({
        ...drama,
        auto_red_flag: isAutoRedFlagPublishTime(drama?.publish_time),
      }))
      const total = apiResult.data?.total || dramaList.length
      ctx.status = 200
      ctx.body = {
        code: 0,
        message: apiResult.message || 'success',
        data: {
          data: markedDramaList,
          total,
        },
      }
    } else {
      ctx.status = 200
      ctx.body = {
        code: apiResult.code,
        message: apiResult.message || '请求失败',
        data: {
          data: [],
          total: 0,
        },
      }
      console.warn('[新剧抢跑] 常读返回非成功结果:', ctx.body)
      return
    }

    // 如果新剧抢跑列表获取成功，继续获取飞书剧集清单数据
    const skipFeishuStatus = String(ctx.query.skip_feishu_status || '') === '1'
    if (ctx.body && ctx.body.code === 0 && !skipFeishuStatus) {
      try {
        // 获取飞书访问令牌
        const tokenResponse = await fetch(
          `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.token_endpoint}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              app_id: FEISHU_CONFIG.app_id,
              app_secret: FEISHU_CONFIG.app_secret,
            }),
          }
        )

        const tokenData = await tokenResponse.text()
        let tokenJson
        try {
          tokenJson = JSON.parse(tokenData)
        } catch {
          return
        }

        if (tokenJson.code !== 0) {
          return
        }

        const accessToken = tokenJson.tenant_access_token

        // 获取飞书剧集清单数据 - 支持分页查询
        let allFeishuItems = []
        let pageToken = undefined
        let totalRecords = 0

        const targetTableId = targetDramaListTableId

        do {
          // 构建 URL 参数，使用 GET 接口代替 search 接口
          const urlParams = new URLSearchParams({
            page_size: '500',
          })
          if (pageToken) {
            urlParams.set('page_token', pageToken)
          }

          const feishuResponse = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${targetTableId}/records?${urlParams.toString()}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          const feishuData = await feishuResponse.text()
          let feishuJson
          try {
            feishuJson = JSON.parse(feishuData)
          } catch {
            break
          }

          if (feishuJson.code === 0 && feishuJson.data && feishuJson.data.items) {
            allFeishuItems = allFeishuItems.concat(feishuJson.data.items)
            const newPageToken = feishuJson.data.page_token
            pageToken = newPageToken
            // 第一次请求时记录总数
            if (totalRecords === 0 && feishuJson.data.total !== undefined) {
              totalRecords = feishuJson.data.total
            }
            // 使用 total 判断是否还需要继续获取
            if (totalRecords > 0 && allFeishuItems.length >= totalRecords) {
              break
            }
          } else {
            break
          }
        } while (pageToken)

        if (allFeishuItems.length > 0) {
          // 创建剧名到下载状态的映射
          const dramaDownloadStatusMap = new Map()
          // 创建剧名到是否在飞书清单中存在的映射
          const dramaExistsInFeishuMap = new Map()

          allFeishuItems.forEach(item => {
            // 获取剧名 - 兼容两种格式：字符串或数组
            let dramaName = null
            const dramaField = item.fields?.['剧名']
            if (typeof dramaField === 'string') {
              dramaName = dramaField
            } else if (Array.isArray(dramaField) && dramaField[0]?.text) {
              dramaName = dramaField[0].text
            }

            if (dramaName) {
              // 修正逻辑：处理多种可能的字段数据结构
              let isDownloaded = false
              const downloadField = item.fields['是否已下载']

              if (downloadField) {
                // 情况1: 数组形式 [{text: "是"}]
                if (Array.isArray(downloadField) && downloadField[0] && downloadField[0].text) {
                  isDownloaded = downloadField[0].text === '是'
                }
                // 情况2: 对象形式带value数组 {value: [{text: "是"}]}
                else if (
                  downloadField.value &&
                  Array.isArray(downloadField.value) &&
                  downloadField.value[0]
                ) {
                  isDownloaded = downloadField.value[0].text === '是'
                }
                // 情况3: 直接的value字符串 {value: "是"}
                else if (typeof downloadField.value === 'string') {
                  isDownloaded = downloadField.value === '是'
                }
                // 情况4: 直接是字符串
                else if (typeof downloadField === 'string') {
                  isDownloaded = downloadField === '是'
                }
              }

              // 记录下载状态
              dramaDownloadStatusMap.set(dramaName, isDownloaded)
              // 记录是否在飞书清单中存在（只要在飞书清单中就是存在）
              dramaExistsInFeishuMap.set(dramaName, true)
            }
          })

          // 为新剧抢跑列表中的每个剧集添加下载状态信息
          if (ctx.body.data && ctx.body.data.data && Array.isArray(ctx.body.data.data)) {
            ctx.body.data.data.forEach(drama => {
              if (drama.series_name) {
                const isDownloaded = dramaDownloadStatusMap.get(drama.series_name)
                const existsInFeishu = dramaExistsInFeishuMap.get(drama.series_name)

                // 设置是否已下载状态
                drama.feishu_downloaded = isDownloaded === true
                // 设置是否在飞书清单中存在
                drama.feishu_exists = existsInFeishu === true
              }
            })
          }
        }
      } catch {
        // 即使飞书数据获取失败，也继续返回新剧抢跑列表数据
      }
    }
  } catch (error) {
    console.error('[新剧抢跑] 获取系列列表异常:', {
      query: ctx.query,
      message: error.message,
      stack: error.stack,
    })
    ctx.status = 500
    ctx.body = {
      code: 500,
      message: '获取系列列表失败',
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
})

// 系列详情
router.get(
  '/distributor/content/series/detail/v1',
  createGetHandler('Series Detail', '/novelsale/distributor/content/series/detail/v1/')
)

// 数据概览
router.get(
  '/distributor/dashboard/data_overview/v1',
  createGetHandler('Data Overview', '/novelsale/distributor/dashboard/data_overview/v1/')
)

// 充值分析
router.get(
  '/distributor/dashboard/recharge_analyze/v1',
  createGetHandler('Recharge Analyze', '/novelsale/distributor/dashboard/recharge_analyze/v1/')
)

// 排行榜列表 - 增强版，同步获取飞书剧集清单数据
router.get('/distributor/statistic/rank/series/quality/list/v2', async ctx => {
  try {
    const runtimeFeishuConfig = await resolveRuntimeFeishuConfig(ctx)
    const targetDramaListTableId = resolveDramaListTableId(
      runtimeFeishuConfig,
      ctx.query.drama_list_table_id
    )
    console.log(
      '[爆剧爆剪-排行榜查询] 飞书表配置:',
      JSON.stringify({
        requestedChannelId: runtimeFeishuConfig.requestedChannelId,
        channelId: runtimeFeishuConfig.channelId,
        channelName: runtimeFeishuConfig.channelName,
        runtimeUserId: runtimeFeishuConfig.runtimeUserId,
        runtimeUserName: runtimeFeishuConfig.runtimeUserName,
        requestedDramaListTableId: String(ctx.query.drama_list_table_id || '').trim(),
        resolvedDramaListTableId: targetDramaListTableId,
        pageIndex: String(ctx.query.page_index || '').trim(),
      })
    )

    // 首先获取排行榜数据
    const rankingListHandler = createGetHandler(
      'Ranking List',
      '/novelsale/distributor/statistic/rank/series/quality/list/v2/'
    )
    await rankingListHandler(ctx)

    // 如果排行榜数据获取成功，继续获取飞书剧集清单数据
    if (ctx.status === 200 && ctx.body && ctx.body.code === 0) {
      try {
        // 获取飞书访问令牌
        const tokenResponse = await fetch(
          `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.token_endpoint}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              app_id: FEISHU_CONFIG.app_id,
              app_secret: FEISHU_CONFIG.app_secret,
            }),
          }
        )

        const tokenData = await tokenResponse.text()
        let tokenJson
        try {
          tokenJson = JSON.parse(tokenData)
        } catch {
          // Warning logging removed
          return
        }

        if (tokenJson.code !== 0) {
          // Warning logging removed
          return
        }

        const accessToken = tokenJson.tenant_access_token

        // 获取飞书剧集清单数据 - 支持分页查询
        let allFeishuItems = []
        let pageToken = undefined
        // let pageCount = 0

        const targetTableId = targetDramaListTableId

        do {
          // 构建 URL 参数，使用 GET 接口代替 search 接口
          const urlParams = new URLSearchParams({
            page_size: '500',
          })
          if (pageToken) {
            urlParams.set('page_token', pageToken)
          }

          const feishuResponse = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.app_token}/tables/${targetTableId}/records?${urlParams.toString()}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          const feishuData = await feishuResponse.text()
          let feishuJson
          try {
            feishuJson = JSON.parse(feishuData)
          } catch {
            break
          }

          if (feishuJson.code === 0 && feishuJson.data && feishuJson.data.items) {
            allFeishuItems = allFeishuItems.concat(feishuJson.data.items)
            pageToken = feishuJson.data.page_token
          } else {
            break
          }
        } while (pageToken)

        // console.log(`[排行榜] 飞书清单总共获取 ${allFeishuItems.length} 条记录，共 ${pageCount} 页`)

        if (allFeishuItems.length > 0) {
          // 创建剧名到下载状态的映射
          const dramaDownloadStatusMap = new Map()
          // 创建剧名到是否在飞书清单中存在的映射
          const dramaExistsInFeishuMap = new Map()

          allFeishuItems.forEach(item => {
            // 获取剧名 - 兼容两种格式：字符串或数组
            let dramaName = null
            const dramaField = item.fields?.['剧名']
            if (typeof dramaField === 'string') {
              dramaName = dramaField
            } else if (Array.isArray(dramaField) && dramaField[0]?.text) {
              dramaName = dramaField[0].text
            }

            if (dramaName) {
              // 修正逻辑：处理多种可能的字段数据结构
              let isDownloaded = false
              const downloadField = item.fields['是否已下载']

              if (downloadField) {
                // 情况1: 数组形式 [{text: "是"}]
                if (Array.isArray(downloadField) && downloadField[0] && downloadField[0].text) {
                  isDownloaded = downloadField[0].text === '是'
                }
                // 情况2: 对象形式带value数组 {value: [{text: "是"}]}
                else if (
                  downloadField.value &&
                  Array.isArray(downloadField.value) &&
                  downloadField.value[0]
                ) {
                  isDownloaded = downloadField.value[0].text === '是'
                }
                // 情况3: 直接的value字符串 {value: "是"}
                else if (typeof downloadField.value === 'string') {
                  isDownloaded = downloadField.value === '是'
                }
                // 情况4: 直接是字符串
                else if (typeof downloadField === 'string') {
                  isDownloaded = downloadField === '是'
                }
              }

              // 记录下载状态
              dramaDownloadStatusMap.set(dramaName, isDownloaded)
              // 记录是否在飞书清单中存在（只要在飞书清单中就是存在）
              dramaExistsInFeishuMap.set(dramaName, true)
            }
          })

          // 为排行榜列表中的每个剧集添加下载状态信息
          if (ctx.body.data && Array.isArray(ctx.body.data)) {
            ctx.body.data.forEach(drama => {
              if (drama.book_name) {
                const isDownloaded = dramaDownloadStatusMap.get(drama.book_name)
                const existsInFeishu = dramaExistsInFeishuMap.get(drama.book_name)

                // 调试：打印每部剧的匹配情况
                // console.log(
                //   `[排行榜] 剧名: "${drama.book_name}", 飞书已下载: ${isDownloaded}, 飞书存在: ${existsInFeishu}`
                // )

                // 设置是否已下载状态
                drama.feishu_downloaded = isDownloaded === true
                // 设置是否在飞书清单中存在
                drama.feishu_exists = existsInFeishu === true
              }
            })
          }
        }
      } catch {
        // Warning logging removed
        // 即使飞书数据获取失败，也继续返回排行榜数据
      }
    }
  } catch (error) {
    // Error logging removed
    ctx.status = 500
    ctx.body = {
      code: 500,
      message: '获取排行榜数据失败',
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
})

export default router
