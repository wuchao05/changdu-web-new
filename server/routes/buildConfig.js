import Router from '@koa/router'
import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'
import { readChannels, writeChannels } from '../utils/studioData.js'
import { createSessionRuntimeContextMiddleware } from '../utils/runtimeContextMiddleware.js'

const router = new Router()

router.use(createSessionRuntimeContextMiddleware('buildConfigContext'))

router.get('/', async ctx => {
  try {
    const { channel } = ctx.state.buildConfigContext

    ctx.body = {
      code: 0,
      message: 'success',
      data: normalizeBuildConfig(channel?.juliang?.buildConfig || DEFAULT_BUILD_CONFIG),
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: '读取搭建参数配置失败',
      error: error.message,
    }
  }
})

router.put('/', async ctx => {
  try {
    const sessionUser = ctx.state.sessionUser
    const payload = ctx.request.body
    const { channel, requestedChannelId } = ctx.state.buildConfigContext

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '无效的搭建参数配置数据',
      }
      return
    }

    const { channels } = await readChannels()
    const targetChannelId =
      sessionUser.userType === 'admin'
        ? requestedChannelId || channel?.id || channels[0]?.id || ''
        : channel?.id || sessionUser.channelId || ''
    const index = channels.findIndex(item => item.id === targetChannelId)
    if (index < 0) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '当前用户未关联渠道，无法保存搭建参数',
      }
      return
    }

    channels[index] = {
      ...channels[index],
      juliang: {
        ...channels[index].juliang,
        buildConfig: normalizeBuildConfig(payload),
      },
      updatedAt: new Date().toISOString(),
    }

    await writeChannels(channels)

    ctx.body = {
      code: 0,
      message: '搭建参数配置更新成功',
      data: channels[index].juliang.buildConfig,
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: '更新搭建参数配置失败',
      error: error.message,
    }
  }
})

export default router
