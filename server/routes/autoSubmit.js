/**
 * 自动提交下载 API 路由
 */
import Router from '@koa/router'
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerManualRun,
  resetStats,
  batchSubmitDramas,
} from '../services/autoSubmitScheduler.js'
import { createSessionRuntimeContextMiddleware } from '../utils/runtimeContextMiddleware.js'
import { buildRuntimeInstanceKey } from '../utils/runtimeInstance.js'

const router = new Router({
  prefix: '/api/auto-submit',
})

router.use(createSessionRuntimeContextMiddleware('autoSubmitContext'))

/**
 * 启动自动提交调度器
 * POST /api/auto-submit/start
 * Body: { intervalMinutes?: number, onlyRedFlag?: boolean }
 */
router.post('/start', async ctx => {
  try {
    const { intervalMinutes, onlyRedFlag } = ctx.request.body || {}
    const instanceKey = buildRuntimeInstanceKey(ctx.state.autoSubmitContext)

    const result = await startScheduler(
      instanceKey,
      {
        intervalMinutes: intervalMinutes || 5,
        onlyRedFlag: onlyRedFlag || false,
      },
      ctx.state.autoSubmitContext
    )

    ctx.body = {
      code: result.success ? 0 : -1,
      message: result.message,
      data: getSchedulerStatus(instanceKey),
    }
  } catch (error) {
    console.error('[自动提交API] 启动失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: error.message || '启动失败',
    }
  }
})

/**
 * 停止自动提交调度器
 * POST /api/auto-submit/stop
 * Body: {}
 */
router.post('/stop', async ctx => {
  try {
    const instanceKey = buildRuntimeInstanceKey(ctx.state.autoSubmitContext)
    const result = await stopScheduler(instanceKey)

    ctx.body = {
      code: result.success ? 0 : -1,
      message: result.message,
      data: getSchedulerStatus(instanceKey),
    }
  } catch (error) {
    console.error('[自动提交API] 停止失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: error.message || '停止失败',
    }
  }
})

/**
 * 获取调度器状态
 * GET /api/auto-submit/status
 * 返回当前渠道的状态
 */
router.get('/status', async ctx => {
  try {
    const instanceKey = buildRuntimeInstanceKey(ctx.state.autoSubmitContext)
    const status = getSchedulerStatus(instanceKey)

    ctx.body = {
      code: 0,
      message: 'ok',
      data: status,
    }
  } catch (error) {
    console.error('[自动提交API] 获取状态失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: error.message || '获取状态失败',
    }
  }
})

/**
 * 手动触发一次执行
 * POST /api/auto-submit/trigger
 * Body: {}
 */
router.post('/trigger', async ctx => {
  try {
    const instanceKey = buildRuntimeInstanceKey(ctx.state.autoSubmitContext)
    const result = await triggerManualRun(instanceKey, ctx.state.autoSubmitContext)

    ctx.body = {
      code: result.success ? 0 : -1,
      message: result.message,
      data: getSchedulerStatus(instanceKey),
    }
  } catch (error) {
    console.error('[自动提交API] 触发执行失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: error.message || '触发执行失败',
    }
  }
})

/**
 * 重置统计数据
 * POST /api/auto-submit/reset-stats
 * Body: {}
 */
router.post('/reset-stats', async ctx => {
  try {
    const instanceKey = buildRuntimeInstanceKey(ctx.state.autoSubmitContext)
    const result = await resetStats(instanceKey)

    ctx.body = {
      code: result.success ? 0 : -1,
      message: result.message,
      data: getSchedulerStatus(instanceKey),
    }
  } catch (error) {
    console.error('[自动提交API] 重置统计失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: error.message || '重置统计失败',
    }
  }
})

/**
 * 批量提交剧集（购物车使用）
 * POST /api/auto-submit/batch-submit
 * Body: {
 *   items: Array<{
 *     book_id: string,
 *     series_name: string,
 *     publish_time: string,
 *     manualRedFlag?: boolean
 *   }>
 * }
 */
router.post('/batch-submit', async ctx => {
  try {
    const { items } = ctx.request.body || {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: 'items 参数必须是非空数组',
      }
      return
    }

    // 验证每个 item 的必需字段
    for (const item of items) {
      if (!item.book_id || !item.series_name) {
        ctx.status = 400
        ctx.body = {
          code: -1,
          message: '每个剧集必须包含 book_id 和 series_name 字段',
        }
        return
      }
    }

    console.log(`[批量提交API] 收到批量提交请求，共 ${items.length} 部剧集`)

    // 调用批量提交函数（立即返回，后台异步执行）
    const result = batchSubmitDramas(items, ctx.state.autoSubmitContext)

    ctx.body = {
      code: 0,
      message: '任务已提交，正在后台处理',
      data: result,
    }
  } catch (error) {
    console.error('[批量提交API] 批量提交失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: error.message || '批量提交失败',
    }
  }
})

export default router
