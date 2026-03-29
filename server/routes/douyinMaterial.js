import Router from '@koa/router'
import { requireSession } from '../utils/studioSession.js'
import {
  ensureUserChannelConfig,
  normalizeDouyinMaterialMatch,
  readUser,
  resolveRuntimeContext,
  writeUser,
} from '../utils/studioData.js'

const router = new Router()

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
    channelId: channel.id,
    channelConfig,
  }
}

router.get('/config', async ctx => {
  try {
    const { channelConfig } = await getCurrentUserContext(ctx)
    ctx.body = {
      code: 0,
      message: 'success',
      data: channelConfig.douyinMaterialMatches || [],
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: '读取配置失败',
      error: error.message,
    }
  }
})

router.post('/config', async ctx => {
  try {
    const { douyinAccount, douyinAccountId, materialRange } = ctx.request.body || {}
    if (!douyinAccount || !douyinAccountId || !materialRange) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '抖音号、抖音号ID和素材序号范围为必填项',
      }
      return
    }

    const { user, channelConfig } = await getCurrentUserContext(ctx)
    if (channelConfig.douyinMaterialMatches.some(item => item.douyinAccount === douyinAccount)) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '该抖音号已存在',
      }
      return
    }

    const newMatch = normalizeDouyinMaterialMatch({
      douyinAccount,
      douyinAccountId,
      materialRange,
    })

    channelConfig.douyinMaterialMatches.push(newMatch)
    user.updatedAt = new Date().toISOString()
    await writeUser(user)

    ctx.body = {
      code: 0,
      message: '添加成功',
      data: newMatch,
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: '添加失败',
      error: error.message,
    }
  }
})

router.put('/config/:id', async ctx => {
  try {
    const { id } = ctx.params
    const { user, channelConfig } = await getCurrentUserContext(ctx)
    const index = channelConfig.douyinMaterialMatches.findIndex(item => item.id === id)

    if (index < 0) {
      ctx.status = 404
      ctx.body = {
        code: -1,
        message: '匹配规则不存在',
      }
      return
    }

    const updates = ctx.request.body || {}
    if (
      updates.douyinAccount &&
      channelConfig.douyinMaterialMatches.some(
        item => item.douyinAccount === updates.douyinAccount && item.id !== id
      )
    ) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '该抖音号已存在',
      }
      return
    }

    const updatedMatch = normalizeDouyinMaterialMatch({
      ...channelConfig.douyinMaterialMatches[index],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    })

    channelConfig.douyinMaterialMatches[index] = updatedMatch
    user.updatedAt = new Date().toISOString()
    await writeUser(user)

    ctx.body = {
      code: 0,
      message: '更新成功',
      data: updatedMatch,
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: '更新失败',
      error: error.message,
    }
  }
})

router.delete('/config/:id', async ctx => {
  try {
    const { id } = ctx.params
    const { user, channelConfig } = await getCurrentUserContext(ctx)
    const index = channelConfig.douyinMaterialMatches.findIndex(item => item.id === id)

    if (index < 0) {
      ctx.status = 404
      ctx.body = {
        code: -1,
        message: '匹配规则不存在',
      }
      return
    }

    const deleted = channelConfig.douyinMaterialMatches.splice(index, 1)[0]
    user.updatedAt = new Date().toISOString()
    await writeUser(user)

    ctx.body = {
      code: 0,
      message: '删除成功',
      data: deleted,
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: -1,
      message: '删除失败',
      error: error.message,
    }
  }
})

export default router
