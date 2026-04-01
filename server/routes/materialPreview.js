import Router from '@koa/router'
import { requireSession } from '../utils/studioSession.js'
import {
  ensureUserChannelConfig,
  readUser,
  resolveRuntimeContext,
  writeUser,
} from '../utils/studioData.js'
import { resolveChannelRuntimeById } from '../utils/channelRuntime.js'
import { buildRuntimeInstanceKey } from '../utils/runtimeInstance.js'
import { materialPreviewManager } from '../services/materialPreviewManager.js'
import { MaterialPreviewService } from '../services/materialPreviewService.js'
import { FEISHU_CONFIG } from '../config/feishu.js'

const router = new Router({
  prefix: '/api/material-preview',
})

const previewService = new MaterialPreviewService()

router.use(requireSession)

function pickValue(ctx, key) {
  return ctx.request.body?.[key] ?? ctx.query?.[key]
}

async function resolveTargetContext(ctx) {
  const sessionUser = ctx.state.sessionUser
  const requestedUserId = String(pickValue(ctx, 'userId') || '').trim()
  const requestedChannelId = String(
    pickValue(ctx, 'channelId') || ctx.get('x-studio-channel-id') || ''
  ).trim()

  let targetUser = sessionUser
  if (requestedUserId && requestedUserId !== sessionUser.id) {
    if (sessionUser.userType !== 'admin') {
      ctx.throw(403, '仅管理员可指定其他用户')
    }
    try {
      targetUser = await readUser(requestedUserId)
    } catch {
      ctx.throw(404, '用户不存在')
    }
  } else if (requestedUserId === sessionUser.id) {
    targetUser = await readUser(sessionUser.id)
  }

  const runtimeContext = await resolveRuntimeContext(targetUser, requestedChannelId)
  if (!runtimeContext.runtimeUser || !runtimeContext.channel) {
    ctx.throw(400, '目标用户下未找到可用渠道')
  }

  const persistedUser =
    targetUser.id === sessionUser.id && !requestedUserId ? await readUser(sessionUser.id) : await readUser(targetUser.id)

  const channelRuntime = await resolveChannelRuntimeById(runtimeContext.channel.id)
  const instanceKey = buildRuntimeInstanceKey({
    runtimeUser: runtimeContext.runtimeUser,
    channelRuntime,
  })
  const channelConfig = ensureUserChannelConfig(persistedUser, runtimeContext.channel.id)

  return {
    sessionUser,
    user: persistedUser,
    runtimeUser: runtimeContext.runtimeUser,
    channel: runtimeContext.channel,
    channelRuntime,
    channelConfig,
    instanceKey,
  }
}

async function persistMaterialPreviewConfig(user, channelId, patch = {}) {
  const channelConfig = ensureUserChannelConfig(user, channelId)
  channelConfig.materialPreview = {
    ...channelConfig.materialPreview,
    ...patch,
    enabled: Boolean(
      patch.enabled !== undefined ? patch.enabled : channelConfig.materialPreview.enabled
    ),
  }
  user.updatedAt = new Date().toISOString()
  return writeUser(user)
}

function normalizePreviewConfig(channelConfig, overrides = {}) {
  return {
    enabled:
      overrides.enabled !== undefined
        ? Boolean(overrides.enabled)
        : Boolean(channelConfig.materialPreview?.enabled),
    intervalMinutes: Number(
      overrides.intervalMinutes || channelConfig.materialPreview?.intervalMinutes || 20
    ),
    buildTimeWindowStart: Number(
      overrides.buildTimeWindowStart || channelConfig.materialPreview?.buildTimeWindowStart || 90
    ),
    buildTimeWindowEnd: Number(
      overrides.buildTimeWindowEnd || channelConfig.materialPreview?.buildTimeWindowEnd || 20
    ),
  }
}

function buildAwemeWhiteList(runtimeUser) {
  return Array.from(
    new Set(
      (runtimeUser?.douyinMaterialMatches || [])
        .map(item => String(item?.douyinAccount || '').trim())
        .filter(Boolean)
    )
  )
}

function buildPreviewTaskConfig(targetContext, body = {}) {
  const aadvid = String(body.aadvid || '').trim()
  const dramaName = String(body.dramaName || body.drama_name || '').trim()
  const cookie = String(targetContext.channelRuntime.juliang.cookie || '').trim()
  const awemeWhiteList = buildAwemeWhiteList(targetContext.runtimeUser)

  if (!aadvid || !dramaName) {
    throw new Error('缺少必需参数: aadvid, dramaName')
  }
  if (!cookie) {
    throw new Error('当前渠道未配置巨量 Cookie')
  }
  if (!awemeWhiteList.length) {
    throw new Error('当前渠道未配置抖音号匹配素材')
  }

  return {
    aadvid,
    drama_name: dramaName,
    cookie,
    aweme_white_list: awemeWhiteList,
  }
}

router.post('/start', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    const config = normalizePreviewConfig(targetContext.channelConfig, ctx.request.body || {})
    await persistMaterialPreviewConfig(targetContext.user, targetContext.channel.id, {
      ...config,
      enabled: true,
    })

    const result = await materialPreviewManager.startPreview(targetContext, {
      instanceKey: targetContext.instanceKey,
      intervalMinutes: config.intervalMinutes,
      buildTimeWindowStart: config.buildTimeWindowStart,
      buildTimeWindowEnd: config.buildTimeWindowEnd,
    })

    ctx.body = {
      code: 0,
      message: '素材预览已启动',
      data: result,
    }
  } catch (error) {
    console.error('[素材预览API] 启动失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '素材预览启动失败',
    }
  }
})

router.post('/stop', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    await persistMaterialPreviewConfig(targetContext.user, targetContext.channel.id, {
      enabled: false,
    })
    const result = await materialPreviewManager.stopPreview(targetContext.instanceKey)

    ctx.body = {
      code: 0,
      message: '素材预览已停止',
      data: result,
    }
  } catch (error) {
    console.error('[素材预览API] 停止失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '素材预览停止失败',
    }
  }
})

router.post('/update', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    const updates = normalizePreviewConfig(targetContext.channelConfig, ctx.request.body || {})
    await persistMaterialPreviewConfig(targetContext.user, targetContext.channel.id, updates)
    const result = await materialPreviewManager.updatePreview(targetContext.instanceKey, updates)

    ctx.body = {
      code: 0,
      message: '素材预览配置已更新',
      data: result,
    }
  } catch (error) {
    console.error('[素材预览API] 更新失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '素材预览更新失败',
    }
  }
})

router.get('/status', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    ctx.body = {
      code: 0,
      message: 'ok',
      data: materialPreviewManager.getStatus(targetContext.instanceKey),
    }
  } catch (error) {
    console.error('[素材预览API] 获取状态失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '获取素材预览状态失败',
    }
  }
})

router.get('/status/list', async ctx => {
  try {
    const sessionUser = ctx.state.sessionUser
    if (sessionUser.userType !== 'admin') {
      ctx.throw(403, '仅管理员可查看全部素材预览状态')
    }

    const userId = String(pickValue(ctx, 'userId') || '').trim()
    const channelId = String(pickValue(ctx, 'channelId') || '').trim()
    ctx.body = {
      code: 0,
      message: 'ok',
      data: materialPreviewManager.listStatus({ userId, channelId }),
    }
  } catch (error) {
    console.error('[素材预览API] 获取状态列表失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '获取素材预览状态列表失败',
    }
  }
})

router.post('/trigger', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    const result = await materialPreviewManager.triggerPreview(targetContext.instanceKey)

    ctx.body = {
      code: 0,
      message: '素材预览已手动触发',
      data: result,
    }
  } catch (error) {
    console.error('[素材预览API] 手动触发失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '手动触发素材预览失败',
    }
  }
})

router.post('/execute-once', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    const config = normalizePreviewConfig(targetContext.channelConfig, ctx.request.body || {})
    const cookie = String(targetContext.channelRuntime.juliang.cookie || '').trim()
    if (!cookie) {
      ctx.throw(400, '当前渠道未配置巨量 Cookie')
    }

    const awemeWhiteList = buildAwemeWhiteList(targetContext.runtimeUser)
    if (!awemeWhiteList.length) {
      ctx.throw(400, '当前渠道未配置抖音号匹配素材')
    }

    const result = await previewService.batchProcessFromFeishu({
      feishu: {
        appId: FEISHU_CONFIG.app_id,
        appSecret: FEISHU_CONFIG.app_secret,
        appToken: FEISHU_CONFIG.app_token,
        tableId:
          String(targetContext.runtimeUser.feishu?.dramaStatusTableId || '').trim() ||
          FEISHU_CONFIG.table_ids.drama_status,
      },
      buildTimeFilterWindowStartMinutes: config.buildTimeWindowStart,
      buildTimeFilterWindowEndMinutes: config.buildTimeWindowEnd,
      aweme_white_list: awemeWhiteList,
      previewDelayMs: Number(ctx.request.body?.previewDelayMs || 400),
      dryRun: Boolean(ctx.request.body?.dryRun),
      cookie,
    })

    ctx.body = {
      code: 0,
      message: '素材预览执行完成',
      data: result,
    }
  } catch (error) {
    console.error('[素材预览API] 单次执行失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '素材预览单次执行失败',
    }
  }
})

router.post('/analyze', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    const taskConfig = buildPreviewTaskConfig(targetContext, ctx.request.body || {})
    const result = await previewService.analyzeAccount(taskConfig)

    ctx.body = {
      code: 0,
      message: '分析完成',
      data: {
        totalAds: result.totalAds,
        filteredAds: result.filteredAds,
        needPreviewCount: result.needPreview.length,
        needDeleteCount: result.needDelete.length,
        canDeletePromotionsCount: result.canDeletePromotions.length,
        needPreview: result.needPreview,
        needDelete: result.needDelete,
        canDeletePromotions: result.canDeletePromotions,
      },
    }
  } catch (error) {
    console.error('[素材预览API] 分析失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '素材预览分析失败',
    }
  }
})

router.post('/execute', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    const taskConfig = buildPreviewTaskConfig(targetContext, ctx.request.body || {})
    const analysis = await previewService.analyzeAccount(taskConfig)
    if (!analysis.needPreview.length) {
      ctx.body = {
        code: 0,
        message: '没有需要预览的素材',
        data: {
          previewCount: 0,
          success: 0,
          failed: 0,
        },
      }
      return
    }

    const result = await previewService.executePreview(
      taskConfig,
      analysis.needPreview,
      Number(ctx.request.body?.delayMs || 400)
    )

    ctx.body = {
      code: 0,
      message: '预览完成',
      data: {
        previewCount: analysis.needPreview.length,
        success: result.success,
        failed: result.failed,
      },
    }
  } catch (error) {
    console.error('[素材预览API] 执行失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '素材预览执行失败',
    }
  }
})

router.post('/cleanup', async ctx => {
  try {
    const targetContext = await resolveTargetContext(ctx)
    const taskConfig = buildPreviewTaskConfig(targetContext, ctx.request.body || {})
    const analysis = await previewService.analyzeAccount(taskConfig)

    let deleteMaterialsResult = { success: 0, failed: 0 }
    let deleteAdsResult = { success: 0, failed: 0 }
    if (analysis.needDelete.length) {
      deleteMaterialsResult = await previewService.stopPreview(taskConfig, analysis.needDelete)
    }
    if (ctx.request.body?.deleteAds && analysis.canDeletePromotions.length) {
      deleteAdsResult = await previewService.deletePromotions(
        taskConfig,
        analysis.canDeletePromotions
      )
    }

    ctx.body = {
      code: 0,
      message: '停用预览完成',
      data: {
        deletedMaterialsCount: analysis.needDelete.length,
        deletedMaterialsSuccess: deleteMaterialsResult.success,
        deletedMaterialsFailed: deleteMaterialsResult.failed,
        deletedAdsCount: ctx.request.body?.deleteAds ? analysis.canDeletePromotions.length : 0,
        deletedAdsSuccess: deleteAdsResult.success,
        deletedAdsFailed: deleteAdsResult.failed,
      },
    }
  } catch (error) {
    console.error('[素材预览API] 清理失败:', error)
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '素材预览清理失败',
    }
  }
})

export default router
