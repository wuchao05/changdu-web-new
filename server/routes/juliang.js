/**
 * 巨量引擎 API 代理路由
 */
import Router from '@koa/router'
import { createSessionRuntimeContextMiddleware } from '../utils/runtimeContextMiddleware.js'

const router = new Router()

router.use(createSessionRuntimeContextMiddleware('juliangContext'))

function extractCsrfToken(cookie = '') {
  const match = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

async function getRuntimeJuliangConfig(ctx) {
  const cookie = String(ctx.state.channelRuntime?.juliang?.cookie || '').trim()

  return {
    cookie,
    csrfToken: extractCsrfToken(cookie),
  }
}

// 获取账户列表
router.post('/api/juliang/get_account_list', async ctx => {
  try {
    // 从请求体中获取参数（不再需要前端传配置）
    const params = ctx.request.body
    const juliangConfig = await getRuntimeJuliangConfig(ctx)

    // 调用巨量引擎 API，使用后端配置
    const response = await fetch(
      'https://business.oceanengine.com/nbs/api/bm/promotion/ad/get_account_list',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: juliangConfig.cookie,
          'X-CSRFToken': juliangConfig.csrfToken,
        },
        body: JSON.stringify(params),
      }
    )

    const data = await response.json()
    ctx.body = data
  } catch (error) {
    console.error('获取巨量账户列表失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      msg: error.message || '获取账户列表失败',
    }
  }
})

// 编辑账户备注
router.post('/api/juliang/edit_account_remark', async ctx => {
  try {
    // 从请求体中获取参数（不再需要前端传配置）
    const { account_id, remark } = ctx.request.body
    const juliangConfig = await getRuntimeJuliangConfig(ctx)

    // 调用巨量引擎 API，使用后端配置
    const response = await fetch(
      'https://business.oceanengine.com/nbs/api/bm/promotion/edit_account_remark',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: juliangConfig.cookie,
          'X-CSRFToken': juliangConfig.csrfToken,
        },
        body: JSON.stringify({ account_id, remark }),
      }
    )

    const data = await response.json()
    ctx.body = data
  } catch (error) {
    console.error('编辑账户备注失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      msg: error.message || '编辑账户备注失败',
    }
  }
})

export default router
