import Router from '@koa/router'
import crypto from 'crypto'
import { requireSession } from '../utils/studioSession.js'
import {
  buildRuntimeUser,
  ensureUserChannelConfig,
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

function getResolvedMatches(user, channelId) {
  return buildRuntimeUser(user, channelId).douyinMaterialMatches || []
}

function getDouyinAccount(user, douyinAccountRefId) {
  return Array.isArray(user?.douyinAccounts)
    ? user.douyinAccounts.find(account => account.id === douyinAccountRefId) || null
    : null
}

router.get('/config', async ctx => {
  try {
    const { user, channelId } = await getCurrentUserContext(ctx)
    ctx.body = {
      code: 0,
      message: 'success',
      data: getResolvedMatches(user, channelId),
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
    const rawDouyinAccountRefId = String(ctx.request.body?.douyinAccountRefId || '').trim()
    const rawMaterialRange = String(ctx.request.body?.materialRange || '').trim()

    if (!rawDouyinAccountRefId || !rawMaterialRange) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '请选择抖音号并填写素材序号',
      }
      return
    }

    const { user, channelConfig, channelId } = await getCurrentUserContext(ctx)

    const selectedDouyinAccount = getDouyinAccount(user, rawDouyinAccountRefId)

    if (!selectedDouyinAccount) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '所选抖音号不存在，请先在管理员后台维护抖音号配置',
      }
      return
    }

    if (!selectedDouyinAccount.douyinAccount || !selectedDouyinAccount.douyinAccountId) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '所选抖音号信息不完整，请先补全抖音号名称和抖音号 ID',
      }
      return
    }

    if (
      channelConfig.douyinMaterialMatches.some(
        item => item.douyinAccountRefId === rawDouyinAccountRefId
      )
    ) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '该抖音号已配置素材序号',
      }
      return
    }

    const newMatch = {
      id: crypto.randomUUID(),
      douyinAccountRefId: rawDouyinAccountRefId,
      materialRange: rawMaterialRange,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    channelConfig.douyinMaterialMatches.push(newMatch)
    user.updatedAt = new Date().toISOString()
    const savedUser = await writeUser(user)
    const createdMatch = getResolvedMatches(savedUser, channelId).find(
      item => item.id === newMatch.id
    )

    ctx.body = {
      code: 0,
      message: '添加成功',
      data: createdMatch || null,
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
    const { user, channelConfig, channelId } = await getCurrentUserContext(ctx)
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
    const nextDouyinAccountRefId = String(
      updates.douyinAccountRefId ||
        channelConfig.douyinMaterialMatches[index].douyinAccountRefId ||
        ''
    ).trim()
    const nextMaterialRange = String(
      updates.materialRange || channelConfig.douyinMaterialMatches[index].materialRange || ''
    ).trim()

    if (!nextDouyinAccountRefId || !nextMaterialRange) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '请选择抖音号并填写素材序号',
      }
      return
    }

    const selectedDouyinAccount = getDouyinAccount(user, nextDouyinAccountRefId)

    if (!selectedDouyinAccount) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '所选抖音号不存在，请先在管理员后台维护抖音号配置',
      }
      return
    }

    if (!selectedDouyinAccount.douyinAccount || !selectedDouyinAccount.douyinAccountId) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '所选抖音号信息不完整，请先补全抖音号名称和抖音号 ID',
      }
      return
    }

    if (
      channelConfig.douyinMaterialMatches.some(
        item => item.douyinAccountRefId === nextDouyinAccountRefId && item.id !== id
      )
    ) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '该抖音号已配置素材序号',
      }
      return
    }

    const updatedMatch = {
      ...channelConfig.douyinMaterialMatches[index],
      id,
      douyinAccountRefId: nextDouyinAccountRefId,
      materialRange: nextMaterialRange,
      updatedAt: new Date().toISOString(),
    }

    channelConfig.douyinMaterialMatches[index] = updatedMatch
    user.updatedAt = new Date().toISOString()
    const savedUser = await writeUser(user)
    const resolvedMatch = getResolvedMatches(savedUser, channelId).find(item => item.id === id)

    ctx.body = {
      code: 0,
      message: '更新成功',
      data: resolvedMatch || null,
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
