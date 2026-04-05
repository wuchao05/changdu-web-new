import Router from '@koa/router'
import { createGetHandler } from '../utils/apiHandler.js'
import {
  buildRequestPath,
  generateChangduABogus,
  requestChangduInternalApi,
} from '../utils/changduInternalApi.js'
import { resolveRuntimeContext } from '../utils/studioData.js'
import { getSessionUser } from '../utils/studioSession.js'

const router = new Router()
const MAX_ORDER_FETCH_COUNT = 10000
const SECONDS_PER_DAY = 24 * 60 * 60
const MAX_ORDER_RANGE_DAYS = 10

/**
 * 从promotion_name提取抖音号
 * promotion_name格式示例: "1842852415368202-CC-欣雅2-4294-小龙-美女总裁不好惹贴身保镖专治不服-小红-葸辉看剧"
 * 抖音号是最后一个"-"后的内容
 * @param {string} promotionName - 推广名称
 * @returns {string|null} 抖音号或null
 */
function extractDouyinAccount(promotionName) {
  if (!promotionName || typeof promotionName !== 'string') return null
  const parts = promotionName.split('-')
  return parts.length > 0 ? parts[parts.length - 1].trim() : null
}

/**
 * 根据抖音号列表过滤订单数据
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
    const douyinAccount = extractDouyinAccount(order.promotion_name)
    return douyinAccount && accountsArray.includes(douyinAccount)
  })
}

function normalizeOrderUserStatsConfig(config = {}) {
  const usernames = Array.isArray(config?.usernames)
    ? config.usernames
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
    : []

  return {
    enabled: Boolean(config?.enabled),
    usernames,
  }
}

function normalizeIndependentOrderStatsConfig(config = {}) {
  return {
    enabled: Boolean(config?.enabled),
  }
}

function matchPromotionUser(promotionName, usernames = []) {
  const normalizedPromotionName = String(promotionName || '').trim()
  if (!normalizedPromotionName || !Array.isArray(usernames) || usernames.length === 0) {
    return ''
  }

  const matchedUsernames = usernames.filter(username => normalizedPromotionName.includes(username))
  if (matchedUsernames.length === 0) {
    return ''
  }

  return matchedUsernames.sort((left, right) => right.length - left.length)[0]
}

function matchPromotionDouyinAccount(promotionName, douyinAccounts = []) {
  const normalizedPromotionName = String(promotionName || '').trim()
  if (!normalizedPromotionName || !Array.isArray(douyinAccounts) || douyinAccounts.length === 0) {
    return ''
  }

  const matchedAccounts = douyinAccounts.filter(account =>
    normalizedPromotionName.includes(account)
  )
  if (matchedAccounts.length === 0) {
    return ''
  }

  return matchedAccounts.sort((left, right) => right.length - left.length)[0]
}

function filterOrdersByConfiguredDouyinAccounts(orders = [], douyinAccounts = []) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return []
  }

  const normalizedAccounts = Array.isArray(douyinAccounts)
    ? douyinAccounts.map(item => String(item || '').trim()).filter(Boolean)
    : []

  if (normalizedAccounts.length === 0) {
    return []
  }

  return orders.filter(order =>
    Boolean(matchPromotionDouyinAccount(order?.promotion_name, normalizedAccounts))
  )
}

function calculateRechargeAmount(orders = []) {
  return orders.reduce((sum, order) => {
    if (order?.pay_status === 0 && order?.pay_amount) {
      return sum + order.pay_amount
    }
    return sum
  }, 0)
}

function buildPromotionUserSummaries(orders = [], usernames = []) {
  const summaryMap = new Map(
    usernames.map(username => [
      username,
      {
        username,
        total: 0,
        total_amount: 0,
        paid_order_count: 0,
      },
    ])
  )

  orders.forEach(order => {
    const matchedUsername = matchPromotionUser(order?.promotion_name, usernames)
    if (!matchedUsername || !summaryMap.has(matchedUsername)) {
      return
    }

    const target = summaryMap.get(matchedUsername)
    target.total += 1
    if (order?.pay_status === 0 && order?.pay_amount) {
      target.total_amount += order.pay_amount
      target.paid_order_count += 1
    }
  })

  return usernames.map(username => summaryMap.get(username))
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
  let rangeLimitHit = false

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

    if (rangeOrders.length >= MAX_ORDER_FETCH_COUNT) {
      // console.log(
      //   `⚠️ [订单统计] 时间段 ${timeRange.begin_time}-${timeRange.end_time} 已触达常读平台最近 ${MAX_ORDER_FETCH_COUNT} 条订单范围`
      // )
      rangeLimitHit = true
      hasMoreData = false
    }

    currentFetchIndex++
  }

  return {
    orders: rangeOrders,
    limitHit: rangeLimitHit,
  }
}

async function resolveOrderUserStatsRuntime(ctx) {
  const sessionUser = await getSessionUser(ctx)
  if (!sessionUser) {
    return normalizeOrderUserStatsConfig()
  }

  const requestedChannelId = String(ctx.get('x-studio-channel-id') || '').trim()
  const runtimeContext = await resolveRuntimeContext(sessionUser, requestedChannelId)
  return normalizeOrderUserStatsConfig(runtimeContext.runtimeUser?.orderUserStats)
}

async function resolveIndependentOrderStatsRuntime(ctx) {
  const sessionUser = await getSessionUser(ctx)
  if (!sessionUser) {
    return {
      ...normalizeIndependentOrderStatsConfig(),
      douyinAccounts: [],
    }
  }

  const requestedChannelId = String(ctx.get('x-studio-channel-id') || '').trim()
  const runtimeContext = await resolveRuntimeContext(sessionUser, requestedChannelId)
  const independentOrderStats = normalizeIndependentOrderStatsConfig(
    runtimeContext.runtimeUser?.independentOrderStats
  )
  const douyinAccounts = Array.isArray(runtimeContext.runtimeUser?.douyinAccounts)
    ? runtimeContext.runtimeUser.douyinAccounts
        .map(item => String(item?.douyinAccount || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
    : []

  return {
    ...independentOrderStats,
    douyinAccounts,
  }
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

// 推广详情 - 支持抖音号过滤（前端分页）
router.get('/distributor/promotion/detail/v2', async ctx => {
  const channelDouyinAccounts = ctx.query.channel_douyin_accounts
  const selectedPromotionUserName = String(ctx.query.promotion_user_name || '').trim()
  const orderUserStatsConfig = await resolveOrderUserStatsRuntime(ctx)
  const independentOrderStatsConfig = await resolveIndependentOrderStatsRuntime(ctx)
  const configuredPromotionUsernames = orderUserStatsConfig.enabled
    ? orderUserStatsConfig.usernames
    : []
  const shouldUseIndependentOrderStats = independentOrderStatsConfig.enabled
  const shouldBuildPromotionUserStats =
    !shouldUseIndependentOrderStats && configuredPromotionUsernames.length > 0

  if (!channelDouyinAccounts && !shouldBuildPromotionUserStats && !shouldUseIndependentOrderStats) {
    await createGetHandler('Promotion Detail', '/novelsale/distributor/promotion/detail/v2/')(ctx)
    return
  }

  // console.log('🔍 [订单统计] 开始拉取全量数据用于本地统计', {
  //   channelDouyinAccounts: channelDouyinAccounts || '',
  //   independentOrderStatsEnabled: shouldUseIndependentOrderStats,
  //   independentDouyinAccounts: independentOrderStatsConfig.douyinAccounts,
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
  let orderFetchLimitHit = false

  for (const timeRange of queryRanges) {
    const rangeResult = await fetchAllOrdersByRange(ctx, timeRange)
    allOrders.push(...rangeResult.orders)
    orderFetchLimitHit = orderFetchLimitHit || rangeResult.limitHit
  }

  const independentlyFilteredOrders = shouldUseIndependentOrderStats
    ? filterOrdersByConfiguredDouyinAccounts(allOrders, independentOrderStatsConfig.douyinAccounts)
    : allOrders
  const douyinFilteredOrders = filterOrdersByDouyinAccounts(
    independentlyFilteredOrders,
    channelDouyinAccounts
  )
  const promotionUserSummaries = shouldBuildPromotionUserStats
    ? buildPromotionUserSummaries(douyinFilteredOrders, configuredPromotionUsernames)
    : []
  const resolvedActivePromotionUserName =
    shouldBuildPromotionUserStats &&
    configuredPromotionUsernames.includes(selectedPromotionUserName)
      ? selectedPromotionUserName
      : ''
  const activeOrders = resolvedActivePromotionUserName
    ? douyinFilteredOrders.filter(
        order =>
          matchPromotionUser(order?.promotion_name, configuredPromotionUsernames) ===
          resolvedActivePromotionUserName
      )
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
    independent_order_stats_enabled: shouldUseIndependentOrderStats,
    promotion_user_stats_enabled: shouldBuildPromotionUserStats,
    promotion_user_summaries: promotionUserSummaries,
    order_fetch_limit_hit: orderFetchLimitHit,
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

// 系列列表 - 通过服务端直连常读内部接口，同步获取飞书剧集清单数据
router.get('/distributor/content/series/list/v1', async ctx => {
  try {
    // console.log('[新剧抢跑] 收到前端请求:', {
    //   query: ctx.query,
    // })

    // 接收前端传递的 drama_list_table_id，用于查询当前渠道关联的飞书表格
    const dramaListTableId = ctx.query.drama_list_table_id

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
      const total = apiResult.data?.total || dramaList.length
      ctx.status = 200
      ctx.body = {
        code: 0,
        message: apiResult.message || 'success',
        data: {
          data: dramaList,
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
    if (ctx.body && ctx.body.code === 0) {
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

        // 使用前端传递的 table_id，如果没有则使用默认配置
        const targetTableId = dramaListTableId || FEISHU_CONFIG.table_ids.drama_list

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
    // 接收前端传递的 drama_list_table_id，用于查询当前渠道关联的飞书表格
    const dramaListTableId = ctx.query.drama_list_table_id

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

        // 使用前端传递的 table_id，如果没有则使用默认配置
        const targetTableId = dramaListTableId || FEISHU_CONFIG.table_ids.drama_list

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
