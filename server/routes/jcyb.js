import Router from '@koa/router'

const router = new Router({
  prefix: '/api/jcyb',
})

const JCYB_GET_INFO_URL = 'https://jcyb-admin.nbjcyb.cn/config/getInfo'
const JCYB_DEBUG_HEADER = 'ewrwerr343t4t5f'

function normalizeDate(value) {
  const normalizedValue = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : ''
}

router.get('/get-info', async ctx => {
  const date = normalizeDate(ctx.query.date)
  if (!date) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '日期参数格式错误',
    }
    return
  }

  const targetUrl = `${JCYB_GET_INFO_URL}?date=${encodeURIComponent(date)}`

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        debug: JCYB_DEBUG_HEADER,
        Accept: 'application/json',
      },
    })

    const rawText = await response.text()
    if (!response.ok) {
      console.error(
        `[jcyb] 第三方金额接口请求失败 status=${response.status} body=${rawText.slice(0, 200)}`
      )
      ctx.status = response.status
      ctx.body = {
        code: response.status,
        message: `第三方金额接口请求失败 (${response.status})`,
      }
      return
    }

    try {
      ctx.body = rawText ? JSON.parse(rawText) : { code: 0, data: { total: '0' } }
    } catch (parseError) {
      console.error('[jcyb] 解析第三方金额接口响应失败:', parseError, rawText.slice(0, 200))
      ctx.status = 502
      ctx.body = {
        code: 502,
        message: '第三方金额接口返回格式异常',
      }
    }
  } catch (error) {
    console.error('[jcyb] 请求第三方金额接口异常:', error)
    ctx.status = 502
    ctx.body = {
      code: 502,
      message: error instanceof Error ? error.message : '请求第三方金额接口失败',
    }
  }
})

export default router
