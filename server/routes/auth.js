import Router from '@koa/router'
import { getSessionUser } from '../utils/studioSession.js'
import { readChannels, resolveRuntimeContext, sanitizeUser } from '../utils/studioData.js'
import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'
import { createSessionRuntimeContextMiddleware } from '../utils/runtimeContextMiddleware.js'

const router = new Router()

router.use(createSessionRuntimeContextMiddleware('authContext'))

export async function readAuthConfig(ctx = null) {
  const { channels } = await readChannels()
  const defaultChannel = channels[0] || null
  const existingContext = ctx?.state?.authContext
  const sessionUser = ctx ? ctx.state?.sessionUser || (await getSessionUser(ctx)) : null
  const requestedChannelId = ctx ? String(ctx.get('x-studio-channel-id') || '').trim() : ''
  const runtimeContext = existingContext
    ? {
        channel: existingContext.channel,
        runtimeUser: existingContext.runtimeUser,
      }
    : sessionUser
      ? await resolveRuntimeContext(sessionUser, requestedChannelId)
      : { channel: defaultChannel, runtimeUser: null }
  const targetChannel = runtimeContext.channel || defaultChannel

  return {
    users: {
      admin: 'admin',
    },
    platforms: {
      changdu: {
        channel: {
          cookie: targetChannel?.changdu?.cookie || '',
          distributorId: targetChannel?.changdu?.distributorId || '',
          adUserId: targetChannel?.changdu?.adUserId || '',
          rootAdUserId: targetChannel?.changdu?.rootAdUserId || '',
          appId: targetChannel?.changdu?.appId || '',
          appType: '7',
          agwJsConv: 'str',
        },
      },
      juliang: {
        channel: targetChannel?.juliang?.cookie || '',
      },
      adx: {
        cookie: '',
      },
    },
    buildConfig: normalizeBuildConfig(targetChannel?.juliang?.buildConfig || DEFAULT_BUILD_CONFIG),
  }
}

router.get('/config', async ctx => {
  try {
    const sessionUser = ctx.state.sessionUser
    const { channel, runtimeUser } = ctx.state.authContext

    ctx.body = {
      code: 0,
      message: 'success',
      data: {
        sessionUser: sanitizeUser(sessionUser),
        runtimeUser: runtimeUser ? sanitizeUser(runtimeUser) : null,
        channel: channel
          ? {
              id: channel.id,
              name: channel.name,
            }
          : null,
        users: {
          admin: 'admin',
        },
        platforms: {
          changdu: {
            channel: {
              cookie: channel?.changdu?.cookie || '',
              distributorId: channel?.changdu?.distributorId || '',
              adUserId: channel?.changdu?.adUserId || '',
              rootAdUserId: channel?.changdu?.rootAdUserId || '',
              appId: channel?.changdu?.appId || '',
            },
          },
          juliang: {
            channel: channel?.juliang?.cookie || '',
          },
          adx: {
            cookie: '',
          },
        },
        feishu: {
          dramaListTableId: runtimeUser?.feishu?.dramaListTableId || '',
          dramaStatusTableId: runtimeUser?.feishu?.dramaStatusTableId || '',
          accountTableId: runtimeUser?.feishu?.accountTableId || '',
        },
        materialPreview: runtimeUser?.materialPreview || {
          enabled: true,
          intervalMinutes: 20,
          buildTimeWindowStart: 90,
          buildTimeWindowEnd: 20,
        },
        orderUserStats: runtimeUser?.orderUserStats || {
          enabled: false,
          sortMode: 'manual',
          usernames: [],
        },
        douyinMaterialMatches: Array.isArray(runtimeUser?.douyinMaterialMatches)
          ? runtimeUser.douyinMaterialMatches
          : [],
        buildConfig: normalizeBuildConfig(channel?.juliang?.buildConfig || DEFAULT_BUILD_CONFIG),
      },
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: 500,
      message: '读取运行时配置失败',
      error: error.message,
    }
  }
})

export default router
