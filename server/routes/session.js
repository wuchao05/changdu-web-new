import Router from '@koa/router'
import {
  loginWithAccount,
  logoutSession,
  getSessionUser,
  requireSession,
} from '../utils/studioSession.js'
import {
  getDefaultDownloadCenterConfig,
  sanitizeUser,
  resolveRuntimeContext,
  resolveUserChannel,
} from '../utils/studioData.js'
import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'

const router = new Router({
  prefix: '/api/session',
})

router.post('/login', async ctx => {
  try {
    const { account, password } = ctx.request.body || {}

    if (!account || !password) {
      ctx.status = 400
      ctx.body = {
        code: 400,
        message: '账号和密码不能为空',
      }
      return
    }

    const user = await loginWithAccount(String(account).trim(), String(password).trim())
    if (!user) {
      ctx.status = 401
      ctx.body = {
        code: 401,
        message: '账号或密码错误',
      }
      return
    }

    const channel = await resolveUserChannel(user)
    ctx.body = {
      code: 0,
      message: '登录成功',
      data: {
        token: user.authToken,
        user: sanitizeUser(user),
        channel: channel ? { id: channel.id, name: channel.name } : null,
      },
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: 500,
      message: '登录失败',
      error: error.message,
    }
  }
})

router.post('/logout', requireSession, async ctx => {
  await logoutSession(ctx)
  ctx.body = {
    code: 0,
    message: '已退出登录',
  }
})

router.get('/me', async ctx => {
  try {
    const user = await getSessionUser(ctx)
    if (!user) {
      ctx.status = 401
      ctx.body = {
        code: 401,
        message: '未登录',
      }
      return
    }

    const requestedChannelId = String(ctx.get('x-studio-channel-id') || '').trim()
    const { channel, runtimeUser, availableChannels } = await resolveRuntimeContext(
      user,
      requestedChannelId
    )
    const defaultDownloadCenterConfig = await getDefaultDownloadCenterConfig()
    ctx.body = {
      code: 0,
      message: 'success',
      data: {
        user: sanitizeUser(user),
        runtimeUser: runtimeUser ? sanitizeUser(runtimeUser) : null,
        channel: channel ? { id: channel.id, name: channel.name } : null,
        availableChannels: Array.isArray(availableChannels)
          ? availableChannels.map(item => ({ id: item.id, name: item.name }))
          : [],
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
            cookie: channel?.adx?.cookie || '',
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
        downloadCenterConfig: defaultDownloadCenterConfig,
      },
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: 500,
      message: '获取登录状态失败',
      error: error.message,
    }
  }
})

router.get('/download-center-config/default', requireSession, async ctx => {
  const defaultDownloadCenterConfig = await getDefaultDownloadCenterConfig()
  ctx.body = {
    code: 0,
    message: 'success',
    data: defaultDownloadCenterConfig,
  }
})

export default router
