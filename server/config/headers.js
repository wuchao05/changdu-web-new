// 默认 User-Agent，用于要求浏览器标识的接口
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// 基础请求头配置（前端会传递，这里只是兜底）
export const DEFAULT_HEADERS = {
  appid: '40012555',
  apptype: '7',
  distributorid: '1842865091654731',
  Cookie: '',
}

// 下载中心专用的请求头配置
export const DOWNLOAD_CENTER_HEADERS = {
  ...DEFAULT_HEADERS,
  Aduserid: '380892546610362',
  Rootaduserid: '380892546610362',
}

// 从请求中获取cookie参数的函数
function getCookieFromRequest(ctx) {
  // 从查询参数或请求体中获取cookie
  return ctx.query.cookie || ctx.request.body?.cookie
}

// 构建请求头的函数，支持从请求中覆盖默认值
export function buildHeaders(ctx, overrideCookie = null) {
  const cookieFromRequest = overrideCookie || getCookieFromRequest(ctx)
  const adUserId = ctx.headers.aduserid || ctx.headers.Aduserid || ctx.headers['ad_user_id']
  const rootAdUserId =
    ctx.headers.rootaduserid || ctx.headers.Rootaduserid || ctx.headers['root_ad_user_id']

  const headers = {
    // 优先使用前端传递的值，支持大小写变体，其次使用默认值
    appid: ctx.headers.appid || ctx.headers.Appid || DEFAULT_HEADERS.appid,
    apptype: ctx.headers.apptype || ctx.headers.Apptype || DEFAULT_HEADERS.apptype,
    distributorid:
      ctx.headers.distributorid || ctx.headers.Distributorid || DEFAULT_HEADERS.distributorid,
    Cookie: cookieFromRequest || DEFAULT_HEADERS.Cookie,
    'User-Agent': ctx.headers['user-agent'] || ctx.headers['User-Agent'] || DEFAULT_USER_AGENT,
  }

  if (adUserId) {
    headers.Aduserid = String(adUserId)
  }
  if (rootAdUserId) {
    headers.Rootaduserid = String(rootAdUserId)
  }

  // 📊 打印 data_overview 接口的详细日志
  // const isDataOverviewApi = ctx.url?.includes('/data_overview/v1')
  // if (isDataOverviewApi) {
  //   console.log('\n========== 【data_overview/v1 接口后端日志】 ==========')
  //   console.log('⏰ 时间:', new Date().toLocaleString('zh-CN'))
  //   console.log('🌐 请求URL:', ctx.url)
  //   console.log('📋 请求方法:', ctx.method)
  //   console.log('\n🍪 Cookie 信息:')
  //   console.log('  - cookieFromRequest 长度:', cookieFromRequest?.length || 0)
  //   console.log('  - cookieFromRequest 前100字符:', cookieFromRequest?.substring(0, 100) || '无')
  //   console.log('  - ctx.query.cookie 存在:', !!ctx.query.cookie)
  //   console.log('  - ctx.query.cookie 长度:', ctx.query.cookie?.length || 0)
  //   console.log('  - ctx.request.body?.cookie 存在:', !!ctx.request.body?.cookie)
  //   console.log('  - overrideCookie 存在:', !!overrideCookie)
  //   console.log('\n📦 最终请求头:')
  //   console.log('  - Appid:', headers.appid)
  //   console.log('  - Apptype:', headers.apptype)
  //   console.log('  - Distributorid:', headers.distributorid)
  //   console.log('  - Cookie 长度:', headers.Cookie?.length || 0)
  //   console.log('  - Cookie 前100字符:', headers.Cookie?.substring(0, 100) || '无')
  //   console.log('====================================================\n')
  // }

  return headers
}

// 构建下载中心专用请求头的函数
export function buildDownloadCenterHeaders(ctx) {
  const cookieFromRequest = getCookieFromRequest(ctx)
  const adUserId = ctx.headers.aduserid || ctx.headers.Aduserid
  const rootAdUserId = ctx.headers.rootaduserid || ctx.headers.Rootaduserid

  const headers = {
    // 优先使用前端传递的值，支持大小写变体，其次使用默认值
    appid: ctx.headers.appid || ctx.headers.Appid || DOWNLOAD_CENTER_HEADERS.appid,
    apptype: ctx.headers.apptype || ctx.headers.Apptype || DOWNLOAD_CENTER_HEADERS.apptype,
    distributorid:
      ctx.headers.distributorid ||
      ctx.headers.Distributorid ||
      DOWNLOAD_CENTER_HEADERS.distributorid,
    Cookie: cookieFromRequest || DOWNLOAD_CENTER_HEADERS.Cookie,
    // 下载中心专用字段，优先使用前端传递的值
    Aduserid: adUserId || DOWNLOAD_CENTER_HEADERS.Aduserid,
    Rootaduserid: rootAdUserId || DOWNLOAD_CENTER_HEADERS.Rootaduserid,
    'User-Agent': ctx.headers['user-agent'] || ctx.headers['User-Agent'] || DEFAULT_USER_AGENT,
  }

  // console.log('========== 下载中心接口后端请求头构建 ==========')
  // console.log('请求URL:', ctx.url)
  // console.log('前端传来的请求头 Appid:', ctx.headers.appid || ctx.headers.Appid)
  // console.log(
  //   '前端传来的请求头 Distributorid:',
  //   ctx.headers.distributorid || ctx.headers.Distributorid
  // )
  // console.log('前端传来的请求头 Aduserid:', adUserId)
  // console.log('前端传来的请求头 Rootaduserid:', rootAdUserId)
  // console.log('Cookie 来源:', cookieFromRequest ? '前端传入' : '环境变量')
  // console.log('Cookie 前100字符:', (cookieFromRequest || headers.Cookie).substring(0, 100))
  // console.log('最终使用的请求头:', {
  //   appid: headers.appid,
  //   apptype: headers.apptype,
  //   distributorid: headers.distributorid,
  //   Aduserid: headers.Aduserid,
  //   Rootaduserid: headers.Rootaduserid,
  // })
  // console.log('================================================')

  return headers
}
