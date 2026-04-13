import Router from '@koa/router'
import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'
import { requireSession } from '../utils/studioSession.js'
import {
  ensureUserChannelConfig,
  readUser,
  resolveRuntimeContext,
  writeUser,
} from '../utils/studioData.js'
import { isValidBuildBidValue, normalizeBuildBidValue } from '../utils/buildBid.js'

const router = new Router({
  prefix: '/api/build-bid',
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
  const buildConfig = normalizeBuildConfig(channel?.juliang?.buildConfig || DEFAULT_BUILD_CONFIG)
  const channelDefaultBid = normalizeBuildBidValue(buildConfig.defaultBid)
  const userBid = normalizeBuildBidValue(channelConfig?.buildPreference?.bid)
  const effectiveBid = buildConfig.enableCustomBid ? userBid || channelDefaultBid : ''

  return {
    channelId: String(channel?.id || '').trim(),
    channelName: String(channel?.name || '').trim(),
    channelBidEnabled: Boolean(buildConfig.enableCustomBid),
    channelDefaultBid,
    userBid,
    effectiveBid,
    effectiveSource: buildConfig.enableCustomBid
      ? userBid
        ? 'user'
        : effectiveBid
          ? 'channel'
          : ''
      : 'disabled',
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
      message: error.message || '读取出价配置失败',
    }
  }
})

router.put('/config', async ctx => {
  try {
    const { user, channel, channelConfig } = await getCurrentUserContext(ctx)
    const buildConfig = normalizeBuildConfig(channel?.juliang?.buildConfig || DEFAULT_BUILD_CONFIG)
    const bid = normalizeBuildBidValue(ctx.request.body?.bid)

    if (bid && !buildConfig.enableCustomBid) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '当前渠道未开启自定义出价',
      }
      return
    }

    if (bid && !isValidBuildBidValue(bid)) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '出价必须是数字',
      }
      return
    }

    channelConfig.buildPreference = {
      ...channelConfig.buildPreference,
      bid,
    }
    if (bid) {
      channelConfig.enabled = true
    }
    user.updatedAt = new Date().toISOString()
    await writeUser(user)

    ctx.body = {
      code: 0,
      message: bid ? '个人出价已保存' : '已恢复渠道默认出价',
      data: buildResponse(channel, channelConfig),
    }
  } catch (error) {
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '保存出价配置失败',
    }
  }
})

export default router
