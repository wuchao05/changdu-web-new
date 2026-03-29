import { execFile } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { promisify } from 'util'
import { readAuthConfig } from '../routes/auth.js'

const execFileAsync = promisify(execFile)

const CHANGDU_INTERNAL_BASE_URL = 'https://www.changdupingtai.com'
const LEGACY_LOCAL_REVERSE_DIR = '/Users/wuchao/Documents/code/reverse/changdu'
const CHANGDU_BOGUS_SCRIPT = path.resolve(process.cwd(), 'server/scripts/generate-abogus.cjs')
const LOCAL_ABOGUS_API_URL = `http://127.0.0.1:${process.env.PORT || 3000}/api/novelsale/a-bogus`
const DEFAULT_REVERSE_DIR_CANDIDATES = [
  process.env.CHANGDU_REVERSE_DIR,
  LEGACY_LOCAL_REVERSE_DIR,
].filter(Boolean)
const DEFAULT_CHANNEL_HEADERS = {
  appid: '40012555',
  apptype: '7',
  agwJsConv: 'str',
}
const INTERNAL_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
const USE_ABOGUS_API_FOR_INTERNAL_REQUEST = true

function isValidReverseDir(reverseDir) {
  return Boolean(
    reverseDir &&
      existsSync(path.join(reverseDir, 'env.js')) &&
      existsSync(path.join(reverseDir, 'bdms.js'))
  )
}

function resolveChangduReverseDir() {
  const matchedDir = DEFAULT_REVERSE_DIR_CANDIDATES.find(isValidReverseDir)

  if (matchedDir) {
    return matchedDir
  }

  throw new Error(
    `未找到可用的常读逆向目录，请配置 CHANGDU_REVERSE_DIR。已检查路径: ${DEFAULT_REVERSE_DIR_CANDIDATES.join(', ')}`
  )
}

function sanitizeRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  )
}

export function buildQueryString(params = {}) {
  const sanitizedParams = sanitizeRecord(params)
  return new URLSearchParams(
    Object.entries(sanitizedParams).map(([key, value]) => [key, String(value)])
  ).toString()
}

export function buildRequestPath(pathname, query = {}) {
  const queryString = buildQueryString(query)
  if (!queryString) {
    return pathname
  }

  return `${pathname}?${queryString}`
}

export function normalizeChangduHeaders(inputHeaders = {}) {
  return {
    cookie: String(inputHeaders.cookie || inputHeaders.Cookie || ''),
    aduserid: String(
      inputHeaders.aduserid ||
        inputHeaders.Aduserid ||
        inputHeaders.adUserId ||
        inputHeaders.AdUserId ||
        ''
    ),
    distributorid: String(
      inputHeaders.distributorid ||
        inputHeaders.Distributorid ||
        inputHeaders.distributorId ||
        inputHeaders.DistributorId ||
        ''
    ),
    appid: String(inputHeaders.appid || inputHeaders.Appid || DEFAULT_CHANNEL_HEADERS.appid),
    apptype: String(
      inputHeaders.apptype || inputHeaders.Apptype || DEFAULT_CHANNEL_HEADERS.apptype
    ),
    agwJsConv: String(
      inputHeaders.agwJsConv ||
        inputHeaders['agw-js-conv'] ||
        inputHeaders['Agw-Js-Conv'] ||
        DEFAULT_CHANNEL_HEADERS.agwJsConv
    ),
  }
}

async function getChannelInternalHeaders(ctx = null) {
  const authConfig = await readAuthConfig(ctx)
  const channelConfig = authConfig.platforms?.changdu?.channel || {}

  const headers = normalizeChangduHeaders({
    cookie: channelConfig.cookie,
    aduserid: channelConfig.adUserId,
    distributorid: channelConfig.distributorId,
    appid: channelConfig.appId,
    apptype: channelConfig.appType,
    agwJsConv: channelConfig.agwJsConv,
  })

  if (!headers.cookie) {
    throw new Error('当前渠道 Cookie 未配置，无法请求常读内部接口')
  }
  if (!headers.aduserid) {
    throw new Error('当前渠道 adUserId 未配置，无法请求常读内部接口')
  }
  if (!headers.distributorid) {
    throw new Error('当前渠道 distributorId 未配置，无法请求常读内部接口')
  }

  return headers
}

export async function generateChangduABogus({
  method = 'GET',
  pathname,
  query,
  body,
  headers: customHeaders,
}) {
  const reverseDir = resolveChangduReverseDir()
  const headers = customHeaders
    ? normalizeChangduHeaders(customHeaders)
    : await getChannelInternalHeaders()
  const payload = {
    method: method.toUpperCase(),
    requestPath: buildRequestPath(pathname, query),
    body: body ?? null,
    headers,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')

  const { stdout } = await execFileAsync('node', [CHANGDU_BOGUS_SCRIPT, encodedPayload], {
    env: {
      ...process.env,
      CHANGDU_REVERSE_DIR: reverseDir,
    },
    maxBuffer: 1024 * 1024,
  })

  const normalizedOutput = stdout
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .pop()

  if (!normalizedOutput) {
    throw new Error('a_bogus 生成结果为空')
  }

  const result = JSON.parse(normalizedOutput)
  if (!result?.aBogus || !result?.encodedABogus) {
    throw new Error('a_bogus 生成结果无效')
  }

  return result
}

async function generateChangduABogusViaApi({ method = 'GET', pathname, query, body, headers }) {
  const normalizedMethod = method.toUpperCase()
  const params =
    normalizedMethod === 'GET' || normalizedMethod === 'HEAD'
      ? sanitizeRecord(query)
      : sanitizeRecord(body ?? {})
  const response = await fetch(LOCAL_ABOGUS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      aduserid: headers.aduserid,
      appid: headers.appid,
      distributorid: headers.distributorid,
    },
    body: JSON.stringify({
      method: normalizedMethod,
      url: `${CHANGDU_INTERNAL_BASE_URL}${pathname}`,
      params,
    }),
  })
  const result = await response.json()

  if (!response.ok || result?.code !== 0) {
    throw new Error(result?.message || `a_bogus接口请求失败: HTTP ${response.status}`)
  }

  if (!result?.data?.a_bogus || !result?.data?.encoded_a_bogus) {
    throw new Error('a_bogus接口返回结果无效')
  }

  return {
    aBogus: result.data.a_bogus,
    encodedABogus: result.data.encoded_a_bogus,
  }
}

function buildInternalRequestHeaders(headers, isPost) {
  const requestHeaders = {
    Accept: 'application/json, text/plain, */*',
    Cookie: headers.cookie,
    aduserid: headers.aduserid,
    'agw-js-conv': headers.agwJsConv,
    appid: headers.appid,
    apptype: headers.apptype,
    distributorid: headers.distributorid,
    'user-agent': INTERNAL_USER_AGENT,
  }

  if (isPost) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  return requestHeaders
}

function buildUrlWithABogus(pathname, query, encodedABogus) {
  const requestPath = buildRequestPath(pathname, query)
  const separator = requestPath.includes('?') ? '&' : '?'
  return `${CHANGDU_INTERNAL_BASE_URL}${requestPath}${separator}a_bogus=${encodedABogus}`
}

function maskHeadersForLog(headers) {
  return {
    ...headers,
    cookie: headers.cookie ? `[length:${headers.cookie.length}]` : '',
  }
}

function isNewDramaListPath(pathname = '') {
  return pathname === '/novelsale/distributor/content/series/list/v1/'
}

export async function requestChangduInternalApi({
  method = 'GET',
  pathname,
  query,
  body,
  ctx = null,
}) {
  const normalizedMethod = method.toUpperCase()
  const headers = await getChannelInternalHeaders(ctx)
  let aBogusResult
  let aBogusSource = 'local'

  if (USE_ABOGUS_API_FOR_INTERNAL_REQUEST) {
    try {
      aBogusResult = await generateChangduABogusViaApi({
        method: normalizedMethod,
        pathname,
        query,
        body,
        headers,
      })
      aBogusSource = 'api'
    } catch (error) {
      console.warn('[常读内部接口] 通过a_bogus接口获取失败，回退本地生成:', {
        method: normalizedMethod,
        pathname,
        error: error.message,
      })
    }
  }

  if (!aBogusResult) {
    aBogusResult = await generateChangduABogus({
      method: normalizedMethod,
      pathname,
      query,
      body,
      headers,
    })
  }

  const { aBogus, encodedABogus } = aBogusResult

  const url = buildUrlWithABogus(pathname, query, encodedABogus)
  const isPost = normalizedMethod === 'POST'
  const requestHeaders = buildInternalRequestHeaders(headers, isPost)
  const logPayload = {
    aBogusSource,
    method: normalizedMethod,
    url,
    query: sanitizeRecord(query),
    body: body ?? null,
    headers: maskHeadersForLog(headers),
  }

  // console.log('[常读内部接口] 发起请求:', logPayload)

  if (isNewDramaListPath(pathname)) {
    console.log('[新剧抢跑-列表] 请求真实服务端请求头:', requestHeaders)
    console.log('[新剧抢跑-列表] 请求真实服务端参数:', {
      method: normalizedMethod,
      pathname,
      query: sanitizeRecord(query),
      body: body ?? null,
    })
  }

  let response
  try {
    response = await fetch(url, {
      method: normalizedMethod,
      headers: requestHeaders,
      body: isPost ? JSON.stringify(body ?? {}) : undefined,
    })
  } catch (error) {
    console.error('[常读内部接口] 请求异常:', {
      ...logPayload,
      error: error.message,
      stack: error.stack,
    })
    throw error
  }

  const text = await response.text()
  let data

  try {
    data = JSON.parse(text)
  } catch {
    console.error('[常读内部接口] 响应解析失败:', {
      ...logPayload,
      status: response.status,
      responseText: text.slice(0, 500),
    })
    throw new Error(`解析常读内部接口响应失败: ${text.slice(0, 200)}`)
  }

  // console.log('[常读内部接口] 响应摘要:', {
  //   method: normalizedMethod,
  //   url,
  //   status: response.status,
  //   ok: response.ok,
  //   code: data?.code,
  //   message: data?.message || '',
  //   dataCount: Array.isArray(data?.data?.data) ? data.data.data.length : undefined,
  // })

  return {
    data,
    response,
    request: {
      url,
      method: normalizedMethod,
      headers,
      query: sanitizeRecord(query),
      body: body ?? null,
      aBogusSource,
      aBogus,
    },
  }
}
