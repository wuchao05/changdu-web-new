import Router from '@koa/router'
import {
  loginWithAccount,
  logoutSession,
  getSessionUser,
  requireSession,
} from '../utils/studioSession.js'
import {
  buildRuntimeUser,
  findUsersByChannelId,
  getDefaultDownloadCenterConfig,
  sanitizeUser,
  resolveRuntimeContext,
  resolveUserChannel,
  writeUser,
} from '../utils/studioData.js'
import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'
import { buildServiceLogPrefix } from '../utils/serviceLogger.js'

const router = new Router({
  prefix: '/api/session',
})

function logPageVisit(pageName, runtimeUser, channel) {
  const prefix = buildServiceLogPrefix('页面访问', {
    runtimeUserName: runtimeUser?.nickname || runtimeUser?.account || '',
    channelName: channel?.name || channel?.id || '',
  })
  globalThis.console.log(`${prefix}-${pageName}`)
}

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

    const sessionResult = await loginWithAccount(String(account).trim(), String(password).trim())
    if (!sessionResult) {
      ctx.status = 401
      ctx.body = {
        code: 401,
        message: '账号或密码错误',
      }
      return
    }

    const { user, token } = sessionResult
    const channel = await resolveUserChannel(user)
    ctx.body = {
      code: 0,
      message: '登录成功',
      data: {
        token,
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

router.post('/password', requireSession, async ctx => {
  const { currentPassword, newPassword } = ctx.request.body || {}
  const normalizedCurrentPassword = String(currentPassword || '').trim()
  const normalizedNewPassword = String(newPassword || '').trim()
  const sessionUser = ctx.state.sessionUser

  if (!normalizedCurrentPassword || !normalizedNewPassword) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '当前密码和新密码不能为空',
    }
    return
  }

  if (sessionUser.password !== normalizedCurrentPassword) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '当前密码不正确',
    }
    return
  }

  if (normalizedCurrentPassword === normalizedNewPassword) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '新密码不能与当前密码相同',
    }
    return
  }

  await writeUser({
    ...sessionUser,
    password: normalizedNewPassword,
    updatedAt: new Date().toISOString(),
  })

  ctx.body = {
    code: 0,
    message: '密码修改成功',
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
    const channelBoundUsers = channel
      ? (await findUsersByChannelId(channel.id)).map(item =>
          sanitizeUser(buildRuntimeUser(item, channel.id))
        )
      : []

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
        channelBoundUsers,
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

router.post('/page-visit', requireSession, async ctx => {
  const pageName = String(ctx.request.body?.pageName || '').trim()

  if (!pageName) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '页面名称不能为空',
    }
    return
  }

  const sessionUser = ctx.state.sessionUser
  const requestedChannelId = String(ctx.get('x-studio-channel-id') || '').trim()
  const { channel, runtimeUser } = await resolveRuntimeContext(sessionUser, requestedChannelId)

  logPageVisit(pageName, runtimeUser || sessionUser, channel)

  ctx.body = {
    code: 0,
    message: 'success',
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
