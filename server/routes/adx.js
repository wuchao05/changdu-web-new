import Router from '@koa/router'
import { readAdxConfig, writeAdxConfig } from '../utils/studioData.js'
import { requireSession } from '../utils/studioSession.js'

const router = new Router()

router.use(requireSession)

const DATAEYE_RANKING_URL = 'https://playlet-applet.dataeye.com/playlet/listHotRanking'
const DATAEYE_REQUIRED_COMPANY = '番茄'
const DATAEYE_MAX_FETCH_PAGES = 20
const DATAEYE_DEFAULT_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.69(0x18004539) NetType/WIFI Language/zh_CN'
const DATAEYE_DEFAULT_REFERER = 'https://servicewechat.com/wxa4d39034d8eeffe7/212/page-frame.html'

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
    S: getTextConfigValue(trimmed, 'S'),
    loginUserId: getTextConfigValue(trimmed, 'loginUserId'),
  }
}

function resolveDataeyeCredentials(adxConfig = {}) {
  const textConfig = parseDataeyeConfigText(adxConfig.cookie)

  return {
    authentication: String(
      process.env.DATAEYE_AUTHENTICATION ||
        process.env.DATAEYE_AUTH_TOKEN ||
        textConfig.authentication ||
        ''
    ).trim(),
    signature: String(process.env.DATAEYE_S || textConfig.S || textConfig.s || '').trim(),
    loginUserId: String(process.env.DATAEYE_LOGIN_USER_ID || textConfig.loginUserId || '').trim(),
    userAgent: String(
      process.env.DATAEYE_USER_AGENT || textConfig.userAgent || DATAEYE_DEFAULT_USER_AGENT
    ).trim(),
    referer: String(
      process.env.DATAEYE_REFERER || textConfig.referer || DATAEYE_DEFAULT_REFERER
    ).trim(),
  }
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
      S: credentials.signature,
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
    filteredContent.push(...content.filter(isRequiredCompanyItem))

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

router.get('/config', async ctx => {
  const config = await readAdxConfig()
  ctx.body = {
    code: 0,
    message: 'success',
    data: {
      cookie: ctx.state.sessionUser?.userType === 'admin' ? config.cookie : '',
      configured: Boolean(config.cookie),
      updatedAt: config.updatedAt,
    },
  }
})

router.put('/config', async ctx => {
  if (ctx.state.sessionUser?.userType !== 'admin') {
    ctx.status = 403
    ctx.body = {
      code: 403,
      message: '无权配置 ADX Cookie',
    }
    return
  }

  const cookie = String(ctx.request.body?.cookie || '').trim()
  const config = await writeAdxConfig({ cookie })

  ctx.body = {
    code: 0,
    message: 'ADX Cookie 保存成功',
    data: {
      configured: Boolean(config.cookie),
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
    const credentials = resolveDataeyeCredentials(adxConfig)

    if (!credentials.authentication || !credentials.signature || !credentials.loginUserId) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '未配置 DataEye 访问凭证，请配置 authentication、S 和 loginUserId',
      }
      return
    }

    const {
      type = 'day',
      periodValue = '',
      dateValue = '', // 兼容旧参数
      pageId = 1,
      pageSize = 50,
    } = ctx.request.body

    const finalPeriodValue = periodValue || dateValue
    if (!finalPeriodValue) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '缺少榜单周期参数',
      }
      return
    }

    const result = await fetchFilteredDataeyeRanking({
      credentials,
      type,
      periodValue: finalPeriodValue,
      pageId,
      pageSize,
    })

    ctx.status = result.status
    ctx.body = result.body
  } catch (error) {
    console.error('DataEye 榜单代理请求失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: 'DataEye 榜单请求失败',
      error: error.message,
    }
  }
})

export default router
