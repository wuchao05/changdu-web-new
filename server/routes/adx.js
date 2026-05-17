import Router from '@koa/router'
import { readAdxConfig, writeAdxConfig } from '../utils/studioData.js'
import { requireSession } from '../utils/studioSession.js'

const router = new Router()

router.use(requireSession)

const ADX_RANKING_URL = 'https://adxray-app.dataeye.com/api/app/playlet/listHotRanking'
const DATAEYE_RANKING_URL = 'https://playlet-applet.dataeye.com/playlet/listHotRanking'
const DATAEYE_REQUIRED_COMPANY = '番茄'
const DATAEYE_MAX_FETCH_PAGES = 20
const ADX_DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const DATAEYE_DEFAULT_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.69(0x18004539) NetType/WIFI Language/zh_CN'
const DATAEYE_DEFAULT_REFERER = 'https://servicewechat.com/wxa4d39034d8eeffe7/212/page-frame.html'
const ADX_DATA_SOURCES = new Set(['adx', 'dataeye'])

function getTextConfigValue(text, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headerMatch = text.match(
    new RegExp(`(?:^|\\s)-H\\s+['"]${escapedKey}\\s*:\\s*([^'"]+)['"]`, 'i')
  )
  if (headerMatch?.[1]) return headerMatch[1].trim()

  const lineMatch = text.match(
    new RegExp(`(?:^|[\\n;])\\s*${escapedKey}\\s*[:=]\\s*([^\\n;]+)`, 'i')
  )
  return lineMatch?.[1]?.trim() || ''
}

function parseDataeyeConfigText(text = '') {
  const trimmed = String(text || '').trim()
  if (!trimmed) return {}

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch {}

  return {
    authentication: getTextConfigValue(trimmed, 'authentication'),
    loginUserId: getTextConfigValue(trimmed, 'loginUserId'),
  }
}

function resolveDataeyeCredentials(adxConfig = {}) {
  const textConfig = parseDataeyeConfigText(adxConfig.cookie)
  const dataeyeConfig =
    adxConfig.dataeye && typeof adxConfig.dataeye === 'object' ? adxConfig.dataeye : {}

  return {
    authentication: String(
      process.env.DATAEYE_AUTHENTICATION ||
        process.env.DATAEYE_AUTH_TOKEN ||
        dataeyeConfig.authentication ||
        textConfig.authentication ||
        ''
    ).trim(),
    loginUserId: String(
      process.env.DATAEYE_LOGIN_USER_ID || dataeyeConfig.loginUserId || textConfig.loginUserId || ''
    ).trim(),
    userAgent: String(
      process.env.DATAEYE_USER_AGENT ||
        dataeyeConfig.userAgent ||
        textConfig.userAgent ||
        DATAEYE_DEFAULT_USER_AGENT
    ).trim(),
    referer: String(
      process.env.DATAEYE_REFERER ||
        dataeyeConfig.referer ||
        textConfig.referer ||
        DATAEYE_DEFAULT_REFERER
    ).trim(),
  }
}

function resolveAdxCredentials(adxConfig = {}) {
  const adxSourceConfig = adxConfig.adx && typeof adxConfig.adx === 'object' ? adxConfig.adx : {}
  const textConfig = parseDataeyeConfigText(adxConfig.cookie)
  const legacyCookie = textConfig.authentication ? '' : adxConfig.cookie

  return {
    cookie: String(process.env.ADX_COOKIE || adxSourceConfig.cookie || legacyCookie || '').trim(),
    userAgent: String(
      process.env.ADX_USER_AGENT || adxSourceConfig.userAgent || ADX_DEFAULT_USER_AGENT
    ).trim(),
  }
}

function resolveRankingSource(source, adxConfig = {}) {
  const normalizedSource = String(source || '').trim()
  if (ADX_DATA_SOURCES.has(normalizedSource)) return normalizedSource

  const configSource = String(adxConfig.source || '').trim()
  if (ADX_DATA_SOURCES.has(configSource)) return configSource

  return 'dataeye'
}

function appendPeriodParam(params, type, periodValue) {
  if (type === 'week') {
    params.set('week', periodValue)
    return
  }

  if (type === 'month') {
    params.set('month', periodValue)
    return
  }

  params.set('day', periodValue)
}

function normalizePositiveInteger(value, fallback) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 1) return fallback
  return Math.floor(numericValue)
}

function isRequiredCompanyItem(item) {
  return (
    Array.isArray(item?.relatedPartyCompany) &&
    item.relatedPartyCompany.some(company =>
      String(company || '').includes(DATAEYE_REQUIRED_COMPANY)
    )
  )
}

function getRankingItemDedupKey(item) {
  const playletId = String(item?.playletId || '').trim()
  if (playletId) return `id:${playletId}`

  const playletName = String(item?.playletName || '').trim()
  if (playletName) return `name:${playletName}`

  const ranking = String(item?.ranking || '').trim()
  return ranking ? `ranking:${ranking}` : ''
}

async function fetchDataeyeRankingPage({ credentials, type, periodValue, pageId, pageSize }) {
  const params = new URLSearchParams()
  appendPeriodParam(params, type, periodValue)
  params.set('pageId', String(pageId))
  params.set('pageSize', String(pageSize))

  const response = await fetch(`${DATAEYE_RANKING_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      authentication: credentials.authentication,
      loginUserId: credentials.loginUserId,
      Referer: credentials.referer,
      'User-Agent': credentials.userAgent,
    },
  })

  const data = await response.json()
  return { response, data }
}

async function fetchFilteredDataeyeRanking({ credentials, type, periodValue, pageId, pageSize }) {
  const normalizedPageId = normalizePositiveInteger(pageId, 1)
  const normalizedPageSize = normalizePositiveInteger(pageSize, 50)
  const requiredCount = normalizedPageId * normalizedPageSize
  const upstreamPageSize = Math.max(normalizedPageSize, 100)
  const filteredContent = []
  let upstreamTotalRecords = 0
  let upstreamStatusCode = 200
  let upstreamCode
  let upstreamMsg = ''
  const seenItemKeys = new Set()

  for (let currentPageId = 1; currentPageId <= DATAEYE_MAX_FETCH_PAGES; currentPageId += 1) {
    const { response, data } = await fetchDataeyeRankingPage({
      credentials,
      type,
      periodValue,
      pageId: currentPageId,
      pageSize: upstreamPageSize,
    })

    upstreamStatusCode = data?.statusCode || response.status
    upstreamCode = data?.code
    upstreamMsg = data?.msg || data?.message || ''

    if (!response.ok || upstreamStatusCode === 401 || upstreamCode === 401) {
      return { status: response.status, body: data }
    }

    const content = Array.isArray(data?.content) ? data.content : []
    upstreamTotalRecords = normalizePositiveInteger(data?.page?.totalRecords, upstreamTotalRecords)
    for (const item of content) {
      if (!isRequiredCompanyItem(item)) continue

      const dedupKey = getRankingItemDedupKey(item)
      if (dedupKey && seenItemKeys.has(dedupKey)) continue
      if (dedupKey) seenItemKeys.add(dedupKey)

      filteredContent.push(item)
    }

    const fetchedRecords = currentPageId * upstreamPageSize
    if (
      !content.length ||
      filteredContent.length >= requiredCount ||
      fetchedRecords >= upstreamTotalRecords
    ) {
      break
    }
  }

  const startIndex = (normalizedPageId - 1) * normalizedPageSize
  const pageContent = filteredContent.slice(startIndex, startIndex + normalizedPageSize)

  return {
    status: 200,
    body: {
      statusCode: upstreamStatusCode,
      code: upstreamCode,
      msg: upstreamMsg,
      page: {
        pageId: normalizedPageId,
        pageSize: normalizedPageSize,
        totalRecords: filteredContent.length,
      },
      content: pageContent,
    },
  }
}

async function fetchAdxRanking({ credentials, type, periodValue, searchKey, pageId, pageSize }) {
  const params = new URLSearchParams()
  appendPeriodParam(params, type, periodValue)
  params.append('searchKey', searchKey)
  params.append('pageId', String(pageId))
  params.append('pageSize', String(pageSize))

  const response = await fetch(ADX_RANKING_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: credentials.cookie,
      Origin: 'https://adxray-app.dataeye.com',
      Referer: 'https://adxray-app.dataeye.com/',
      'User-Agent': credentials.userAgent,
    },
    body: params.toString(),
  })

  const data = await response.json()
  return { status: response.status, body: data }
}

router.get('/config', async ctx => {
  const config = await readAdxConfig()
  const storedCredentials = parseDataeyeConfigText(config.cookie)
  const resolvedCredentials = resolveDataeyeCredentials(config)
  const adxCredentials = resolveAdxCredentials(config)
  const isAdmin = ctx.state.sessionUser?.userType === 'admin'

  ctx.body = {
    code: 0,
    message: 'success',
    data: {
      source: resolveRankingSource(config.source, config),
      cookie: isAdmin ? config.cookie : '',
      adx: {
        cookie: isAdmin ? adxCredentials.cookie || '' : '',
        userAgent: isAdmin ? config.adx?.userAgent || '' : '',
        configured: Boolean(adxCredentials.cookie),
      },
      dataeye: {
        authentication: isAdmin
          ? config.dataeye?.authentication || storedCredentials.authentication || ''
          : '',
        loginUserId: isAdmin
          ? config.dataeye?.loginUserId || storedCredentials.loginUserId || ''
          : '',
        userAgent: isAdmin ? config.dataeye?.userAgent || '' : '',
        referer: isAdmin ? config.dataeye?.referer || '' : '',
        configured: Boolean(resolvedCredentials.authentication && resolvedCredentials.loginUserId),
      },
      authentication: isAdmin
        ? config.dataeye?.authentication || storedCredentials.authentication || ''
        : '',
      loginUserId: isAdmin
        ? config.dataeye?.loginUserId || storedCredentials.loginUserId || ''
        : '',
      configured: {
        adx: Boolean(adxCredentials.cookie),
        dataeye: Boolean(resolvedCredentials.authentication && resolvedCredentials.loginUserId),
      },
      updatedAt: config.updatedAt,
    },
  }
})

router.put('/config', async ctx => {
  if (ctx.state.sessionUser?.userType !== 'admin') {
    ctx.status = 403
    ctx.body = {
      code: 403,
      message: '无权配置 ADX 数据源',
    }
    return
  }

  const currentConfig = await readAdxConfig()
  const requestBody = ctx.request.body || {}
  const requestDataeye =
    requestBody.dataeye && typeof requestBody.dataeye === 'object' ? requestBody.dataeye : {}
  const requestAdx = requestBody.adx && typeof requestBody.adx === 'object' ? requestBody.adx : {}
  const authentication = String(
    requestDataeye.authentication || requestBody.authentication || ''
  ).trim()
  const loginUserId = String(requestDataeye.loginUserId || requestBody.loginUserId || '').trim()
  const hasDataeyeCredentials = authentication || loginUserId
  const source = resolveRankingSource(requestBody.source, currentConfig)
  const legacyAdxCookie = hasDataeyeCredentials ? '' : requestBody.cookie
  const cookie = hasDataeyeCredentials
    ? JSON.stringify(
        {
          authentication,
          loginUserId,
        },
        null,
        2
      )
    : String(requestBody.cookie || '').trim()
  const config = await writeAdxConfig({
    ...currentConfig,
    source,
    cookie,
    adx: {
      ...currentConfig.adx,
      cookie: String(
        requestAdx.cookie ||
          requestBody.adxCookie ||
          legacyAdxCookie ||
          currentConfig.adx?.cookie ||
          ''
      ).trim(),
      userAgent: String(requestAdx.userAgent || currentConfig.adx?.userAgent || '').trim(),
    },
    dataeye: {
      ...currentConfig.dataeye,
      authentication,
      loginUserId,
      userAgent: String(requestDataeye.userAgent || currentConfig.dataeye?.userAgent || '').trim(),
      referer: String(requestDataeye.referer || currentConfig.dataeye?.referer || '').trim(),
    },
  })
  const credentials = resolveDataeyeCredentials(config)
  const adxCredentials = resolveAdxCredentials(config)

  ctx.body = {
    code: 0,
    message: 'ADX 数据源配置保存成功',
    data: {
      source: resolveRankingSource(config.source, config),
      configured: {
        adx: Boolean(adxCredentials.cookie),
        dataeye: Boolean(credentials.authentication && credentials.loginUserId),
      },
      updatedAt: config.updatedAt,
    },
  }
})

/**
 * ADX 榜单代理
 * POST /api/adx/ranking
 */
router.post('/ranking', async ctx => {
  try {
    const adxConfig = await readAdxConfig()
    const {
      source = '',
      type = 'day',
      periodValue = '',
      dateValue = '', // 兼容旧参数
      searchKey = '番茄',
      pageId = 1,
      pageSize = 50,
    } = ctx.request.body

    const rankingSource = resolveRankingSource(source, adxConfig)
    const finalPeriodValue = periodValue || dateValue
    if (!finalPeriodValue) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '缺少榜单周期参数',
      }
      return
    }

    let result
    if (rankingSource === 'adx') {
      const credentials = resolveAdxCredentials(adxConfig)
      if (!credentials.cookie) {
        ctx.status = 400
        ctx.body = {
          code: -1,
          message: '未配置 ADX 平台 Cookie，请先配置',
        }
        return
      }

      result = await fetchAdxRanking({
        credentials,
        type,
        periodValue: finalPeriodValue,
        searchKey,
        pageId,
        pageSize,
      })
    } else {
      const credentials = resolveDataeyeCredentials(adxConfig)
      if (!credentials.authentication || !credentials.loginUserId) {
        ctx.status = 400
        ctx.body = {
          code: -1,
          message: '未配置剧查查小程序凭证，请配置 authentication 和 loginUserId',
        }
        return
      }

      result = await fetchFilteredDataeyeRanking({
        credentials,
        type,
        periodValue: finalPeriodValue,
        pageId,
        pageSize,
      })
    }

    ctx.status = result.status
    ctx.body = result.body
  } catch (error) {
    console.error('ADX 榜单代理请求失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: 'ADX 榜单请求失败',
      error: error.message,
    }
  }
})

export default router
