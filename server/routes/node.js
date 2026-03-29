import Router from '@koa/router'
import { PassThrough, Readable } from 'stream'
import { createDownloadCenterHandler } from '../utils/apiHandler.js'
import { buildDownloadCenterHeaders } from '../config/headers.js'

const router = new Router()

// 下载中心任务列表
router.get(
  '/platform/distributor/download_center/task_list',
  createDownloadCenterHandler(
    'Download Center Task List',
    '/node/api/platform/distributor/download_center/task_list/'
  )
)

// router.post(
//   '/platform/distributor/download_center/task_list',
//   createDownloadCenterHandler(
//     'Download Center Task List',
//     '/node/api/platform/distributor/download_center/task_list/'
//   )
// )

// 下载中心获取URL
router.get(
  '/platform/distributor/download_center/get_url',
  createDownloadCenterHandler(
    'Download Center Get URL',
    '/node/api/platform/distributor/download_center/get_url/',
    { logRequest: true }
  )
)

router.post(
  '/platform/distributor/download_center/get_url',
  createDownloadCenterHandler(
    'Download Center Get URL',
    '/node/api/platform/distributor/download_center/get_url/',
    { logRequest: true }
  )
)

// 下载中心代理下载，附带自定义文件名
router.get('/platform/distributor/download_center/proxy_download', async ctx => {
  const { download_url: downloadUrlParam, imagex_uri: imagexUri, filename = '' } = ctx.query

  if (!downloadUrlParam && !imagexUri) {
    ctx.status = 400
    ctx.body = { code: 400, message: '缺少 download_url 或 imagex_uri 参数' }
    return
  }

  const rawName = String(filename || 'download')
  const sanitizedBase = rawName.replace(/[/\\\\:*?"<>|]+/g, '').trim() || 'download'

  // 如果未带扩展名，默认追加 .zip
  const hasExt = /\.[a-zA-Z0-9]{2,6}$/.test(sanitizedBase)
  const finalName = hasExt ? sanitizedBase : `${sanitizedBase}.zip`
  // const cookie = ctx.query.cookie

  // 优先使用前端传递的 download_url；否则根据 imagex_uri 获取直链
  let downloadUrl = downloadUrlParam

  if (!downloadUrl && imagexUri) {
    const params = new URLSearchParams({ imagex_uri: String(imagexUri) })
    // if (cookie) params.append('cookie', String(cookie))

    const targetUrl = `https://www.changdunovel.com/node/api/platform/distributor/download_center/get_url/?${params.toString()}`
    const headers = buildDownloadCenterHeaders(ctx)

    const urlResp = await fetch(targetUrl, { method: 'GET', headers, redirect: 'follow' })
    if (!urlResp.ok) {
      ctx.status = urlResp.status
      ctx.body = { code: urlResp.status, message: '获取下载链接失败' }
      return
    }
    const urlData = await urlResp.json()
    downloadUrl = urlData?.download_url || urlData?.data?.download_url
    if (!downloadUrl) {
      ctx.status = 500
      ctx.body = { code: 500, message: '未获取到下载链接' }
      return
    }
  }

  const pass = new PassThrough()
  ctx.body = pass
  const controller = new AbortController()
  const headers = {
    'User-Agent':
      ctx.headers['user-agent'] ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://www.changdunovel.com/',
  }

  if (cookie) {
    headers.Cookie = cookie
  }

  const clientClosedHandler = () => controller.abort()
  ctx.req.once('close', clientClosedHandler)

  try {
    const upstreamResp = await fetch(downloadUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!upstreamResp.ok || !upstreamResp.body) {
      ctx.req.off('close', clientClosedHandler)
      ctx.status = upstreamResp.status || 500
      ctx.body = { code: ctx.status, message: '下载源返回异常' }
      pass.destroy()
      return
    }

    if (!ctx.headerSent) {
      const contentType = 'application/octet-stream'
      const dispositionFallback = encodeURIComponent(finalName)
      const dispositionUtf8 = encodeURIComponent(finalName)
      ctx.set('Content-Type', contentType)
      ctx.set(
        'Content-Disposition',
        `attachment; filename="${dispositionFallback}"; filename*=UTF-8''${dispositionUtf8}`
      )
      ctx.status = upstreamResp.status
    }

    const nodeStream = Readable.fromWeb(upstreamResp.body)

    nodeStream.on('error', err => {
      pass.destroy(err)
    })

    pass.on('error', err => {
      nodeStream.destroy(err)
    })

    nodeStream.pipe(pass)
    ctx.body = pass

    nodeStream.on('end', () => {
      pass.end()
    })

    ctx.req.off('close', clientClosedHandler)
  } catch (error) {
    ctx.req.off('close', clientClosedHandler)
    if (!ctx.headerSent) {
      ctx.status = 502
      ctx.body = { code: 502, message: '下载源连接中断' }
    }
    pass.destroy(error)
  }
})

export default router
