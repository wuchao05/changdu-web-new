import Router from '@koa/router'
import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'
import { requireSession } from '../utils/studioSession.js'
import {
  ensureUserChannelConfig,
  readUser,
  resolveRuntimeContext,
  writeUser,
} from '../utils/studioData.js'
import {
  DEFAULT_USER_BUILD_ADVANCE_CONFIG,
  applyUserBuildAdvanceToBuildConfig,
  extractBuildAdvanceRuleConfig,
  normalizeUserBuildAdvanceConfig,
} from '../utils/buildAdvanceConfig.js'

const router = new Router({
  prefix: '/api/build-advance',
})

router.use(requireSession)

async function getCurrentUserContext(ctx) {
  const sessionUser = ctx.state.sessionUser
  const requestedChannelId = String(ctx.get('x-studio-channel-id') || '').trim()
  const { channel, runtimeUser } = await resolveRuntimeContext(sessionUser, requestedChannelId)
  if (!runtimeUser || !channel) {
    throw new Error('当前渠道下没有可用用户')
  }

  const user = await readUser(runtimeUser.id)
  const channelConfig = ensureUserChannelConfig(user, channel.id)

  return {
    user,
    channel,
    channelConfig,
  }
}

function buildResponse(channel, channelConfig) {
  const channelBuildConfig = normalizeBuildConfig(
    channel?.juliang?.buildConfig || DEFAULT_BUILD_CONFIG
  )
  const channelDefaultConfig = extractBuildAdvanceRuleConfig(channelBuildConfig)
  const userBuildAdvanceConfig = normalizeUserBuildAdvanceConfig(
    channelConfig?.buildAdvanceConfig || DEFAULT_USER_BUILD_ADVANCE_CONFIG
  )
  const effectiveConfig = extractBuildAdvanceRuleConfig(
    applyUserBuildAdvanceToBuildConfig(channelBuildConfig, userBuildAdvanceConfig)
  )

  return {
    channelId: String(channel?.id || '').trim(),
    channelName: String(channel?.name || '').trim(),
    allowCustom: Boolean(userBuildAdvanceConfig.allowCustom),
    useCustom: Boolean(userBuildAdvanceConfig.allowCustom && userBuildAdvanceConfig.useCustom),
    channelDefaultConfig,
    userCustomConfig: {
      forbiddenAdvanceStartHour: userBuildAdvanceConfig.forbiddenAdvanceStartHour,
      forbiddenAdvanceEndHour: userBuildAdvanceConfig.forbiddenAdvanceEndHour,
      advanceBuildHours: userBuildAdvanceConfig.advanceBuildHours,
    },
    effectiveConfig,
    effectiveSource:
      userBuildAdvanceConfig.allowCustom && userBuildAdvanceConfig.useCustom ? 'user' : 'channel',
  }
}

router.get('/config', async ctx => {
  try {
    const { channel, channelConfig } = await getCurrentUserContext(ctx)
    ctx.body = {
      code: 0,
      message: 'success',
      data: buildResponse(channel, channelConfig),
    }
  } catch (error) {
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '读取智能搭建时机配置失败',
    }
  }
})

router.put('/config', async ctx => {
  try {
    const { user, channel, channelConfig } = await getCurrentUserContext(ctx)
    const currentConfig = normalizeUserBuildAdvanceConfig(channelConfig?.buildAdvanceConfig)

    if (!currentConfig.allowCustom) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '当前渠道未开放个人智能搭建时机配置',
      }
      return
    }

    channelConfig.buildAdvanceConfig = {
      ...currentConfig,
      useCustom: true,
      ...normalizeUserBuildAdvanceConfig({
        allowCustom: true,
        useCustom: true,
        forbiddenAdvanceStartHour: ctx.request.body?.forbiddenAdvanceStartHour,
        forbiddenAdvanceEndHour: ctx.request.body?.forbiddenAdvanceEndHour,
        advanceBuildHours: ctx.request.body?.advanceBuildHours,
      }),
    }

    user.updatedAt = new Date().toISOString()
    await writeUser(user)

    ctx.body = {
      code: 0,
      message: '个人智能搭建时机已保存',
      data: buildResponse(channel, channelConfig),
    }
  } catch (error) {
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '保存智能搭建时机配置失败',
    }
  }
})

router.delete('/config', async ctx => {
  try {
    const { user, channel, channelConfig } = await getCurrentUserContext(ctx)
    const currentConfig = normalizeUserBuildAdvanceConfig(channelConfig?.buildAdvanceConfig)

    channelConfig.buildAdvanceConfig = {
      ...currentConfig,
      useCustom: false,
    }

    user.updatedAt = new Date().toISOString()
    await writeUser(user)

    ctx.body = {
      code: 0,
      message: '已恢复渠道默认智能搭建时机',
      data: buildResponse(channel, channelConfig),
    }
  } catch (error) {
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '恢复默认智能搭建时机失败',
    }
  }
})

export default router
