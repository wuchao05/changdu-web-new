import Router from '@koa/router'
import { readAdxConfig, writeAdxConfig } from '../utils/studioData.js'
import { requireSession } from '../utils/studioSession.js'

const router = new Router()

router.use(requireSession)

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
    const adxCookie = String(adxConfig.cookie || '').trim()

    if (!adxCookie) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '未配置 ADX Cookie，请先配置',
      }
      return
    }

    const {
      type = 'day',
      periodValue = '',
      dateValue = '', // 兼容旧参数
      searchKey = '',
      pageId = 1,
      pageSize = 50,
    } = ctx.request.body

    const finalPeriodValue = periodValue || dateValue

    // 构建 form-urlencoded 参数
    const params = new URLSearchParams()
    if (type === 'day') {
      params.append('day', finalPeriodValue)
    } else if (type === 'week') {
      params.append('week', finalPeriodValue)
    } else if (type === 'month') {
      params.append('month', finalPeriodValue)
    }
    params.append('searchKey', searchKey)
    params.append('pageId', String(pageId))
    params.append('pageSize', String(pageSize))

    const response = await fetch('https://adxray-app.dataeye.com/api/app/playlet/listHotRanking', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: adxCookie,
        Origin: 'https://adxray-app.dataeye.com',
        Referer: 'https://adxray-app.dataeye.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: params.toString(),
    })

    ctx.status = response.status
    const data = await response.json()
    ctx.body = data
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
