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

function getRequestedFeishuTableGroupId(ctx) {
  return String(
    ctx.get('x-feishu-table-group-id') ||
      ctx.query?.feishuTableGroupId ||
      ctx.request.body?.feishuTableGroupId ||
      ''
  ).trim()
}

function getResolvedMatches(user, channelId, feishuTableGroupId = '') {
  const runtimeUser = buildRuntimeUser(user, channelId)
  const normalizedGroupId = String(feishuTableGroupId || '').trim()

  if (normalizedGroupId) {
    const matchedGroup = Array.isArray(runtimeUser.feishuTableGroups)
      ? runtimeUser.feishuTableGroups.find(
          group => String(group?.id || '').trim() === normalizedGroupId
        )
      : null
    return matchedGroup?.douyinMaterialMatches || []
  }

  return runtimeUser.douyinMaterialMatches || []
}

function getDefaultFeishuTableGroup(channelConfig) {
  if (
    !Array.isArray(channelConfig.feishuTableGroups) ||
    channelConfig.feishuTableGroups.length === 0
  ) {
    channelConfig.feishuTableGroups = [
      {
        id: 'default',
        name: '默认表格',
        enabled: true,
        feishu: channelConfig.feishu || {},
        douyinMaterialMatches: Array.isArray(channelConfig.douyinMaterialMatches)
          ? channelConfig.douyinMaterialMatches
          : [],
      },
    ]
  }

  return channelConfig.feishuTableGroups[0]
}

function getTargetFeishuTableGroup(channelConfig, feishuTableGroupId = '') {
  const normalizedGroupId = String(feishuTableGroupId || '').trim()
  const groups = getDefaultFeishuTableGroup(channelConfig) && channelConfig.feishuTableGroups

  if (!normalizedGroupId) {
    return channelConfig.feishuTableGroups[0]
  }

  const matchedGroup = groups.find(group => String(group?.id || '').trim() === normalizedGroupId)
  if (!matchedGroup) {
    const error = new Error('表格组不存在，请刷新后重试')
    error.status = 404
    throw error
  }

  if (!Array.isArray(matchedGroup.douyinMaterialMatches)) {
    matchedGroup.douyinMaterialMatches = []
  }

  return matchedGroup
}

function syncDefaultFeishuTableGroupMatches(channelConfig) {
  const defaultGroup = getDefaultFeishuTableGroup(channelConfig)
  channelConfig.douyinMaterialMatches = defaultGroup.douyinMaterialMatches
}

function getDouyinAccount(user, douyinAccountRefId) {
  return Array.isArray(user?.douyinAccounts)
    ? user.douyinAccounts.find(account => account.id === douyinAccountRefId) || null
    : null
}

function isDouyinAccountOccupiedInCurrentChannel(
  channelConfig,
  currentFeishuTableGroupId,
  douyinAccountRefId
) {
  const normalizedGroupId = String(currentFeishuTableGroupId || '').trim()
  const normalizedRefId = String(douyinAccountRefId || '').trim()

  if (!normalizedRefId || !channelConfig) {
    return false
  }

  const groups = Array.isArray(channelConfig.feishuTableGroups)
    ? channelConfig.feishuTableGroups
    : []

  if (groups.length > 0) {
    return groups.some(group => {
      const groupId = String(group?.id || '').trim()
      if (groupId === normalizedGroupId) {
        return false
      }
      return Array.isArray(group?.douyinMaterialMatches)
        ? group.douyinMaterialMatches.some(
            match => String(match?.douyinAccountRefId || '').trim() === normalizedRefId
          )
        : false
    })
  }

  if (!normalizedGroupId) {
    return false
  }

  return Array.isArray(channelConfig.douyinMaterialMatches)
    ? channelConfig.douyinMaterialMatches.some(
        match => String(match?.douyinAccountRefId || '').trim() === normalizedRefId
      )
    : false
}

function assertDouyinMaterialCustomizable(ctx, channelConfig) {
  if (ctx.state.sessionUser?.userType === 'admin') {
    return
  }

  if (!channelConfig?.douyinMaterialConfig?.allowCustom) {
    const error = new Error('当前渠道未开放用户自定义抖音号匹配素材')
    error.status = 403
    throw error
  }
}

router.get('/config', async ctx => {
  try {
    const { user, channelId } = await getCurrentUserContext(ctx)
    const feishuTableGroupId = getRequestedFeishuTableGroupId(ctx)
    ctx.body = {
      code: 0,
      message: 'success',
      data: getResolvedMatches(user, channelId, feishuTableGroupId),
    }
  } catch (error) {
    ctx.status = error.status || 500
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
    const feishuTableGroupId = getRequestedFeishuTableGroupId(ctx)
    assertDouyinMaterialCustomizable(ctx, channelConfig)

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
      isDouyinAccountOccupiedInCurrentChannel(
        channelConfig,
        feishuTableGroupId,
        rawDouyinAccountRefId
      )
    ) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '该抖音号已在当前渠道内其他表格组配置素材序号',
      }
      return
    }

    const defaultGroup = getTargetFeishuTableGroup(channelConfig, feishuTableGroupId)
    if (
      defaultGroup.douyinMaterialMatches.some(
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

    defaultGroup.douyinMaterialMatches.push(newMatch)
    syncDefaultFeishuTableGroupMatches(channelConfig)
    user.updatedAt = new Date().toISOString()
    const savedUser = await writeUser(user)
    const createdMatch = getResolvedMatches(savedUser, channelId, feishuTableGroupId).find(
      item => item.id === newMatch.id
    )

    ctx.body = {
      code: 0,
      message: '添加成功',
      data: createdMatch || null,
    }
  } catch (error) {
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '添加失败',
      error: error.message,
    }
  }
})

router.put('/config/:id', async ctx => {
  try {
    const { id } = ctx.params
    const { user, channelConfig, channelId } = await getCurrentUserContext(ctx)
    const feishuTableGroupId = getRequestedFeishuTableGroupId(ctx)
    assertDouyinMaterialCustomizable(ctx, channelConfig)
    const defaultGroup = getTargetFeishuTableGroup(channelConfig, feishuTableGroupId)
    const matches = defaultGroup.douyinMaterialMatches
    const index = matches.findIndex(item => item.id === id)

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
      updates.douyinAccountRefId || matches[index].douyinAccountRefId || ''
    ).trim()
    const nextMaterialRange = String(
      updates.materialRange || matches[index].materialRange || ''
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
      isDouyinAccountOccupiedInCurrentChannel(
        channelConfig,
        feishuTableGroupId,
        nextDouyinAccountRefId
      )
    ) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '该抖音号已在当前渠道内其他表格组配置素材序号',
      }
      return
    }

    if (
      matches.some(item => item.douyinAccountRefId === nextDouyinAccountRefId && item.id !== id)
    ) {
      ctx.status = 400
      ctx.body = {
        code: -1,
        message: '该抖音号已配置素材序号',
      }
      return
    }

    const updatedMatch = {
      ...matches[index],
      id,
      douyinAccountRefId: nextDouyinAccountRefId,
      materialRange: nextMaterialRange,
      updatedAt: new Date().toISOString(),
    }

    matches[index] = updatedMatch
    syncDefaultFeishuTableGroupMatches(channelConfig)
    user.updatedAt = new Date().toISOString()
    const savedUser = await writeUser(user)
    const resolvedMatch = getResolvedMatches(savedUser, channelId, feishuTableGroupId).find(
      item => item.id === id
    )

    ctx.body = {
      code: 0,
      message: '更新成功',
      data: resolvedMatch || null,
    }
  } catch (error) {
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '更新失败',
      error: error.message,
    }
  }
})

router.delete('/config/:id', async ctx => {
  try {
    const { id } = ctx.params
    const { user, channelConfig } = await getCurrentUserContext(ctx)
    const feishuTableGroupId = getRequestedFeishuTableGroupId(ctx)
    assertDouyinMaterialCustomizable(ctx, channelConfig)
    const defaultGroup = getTargetFeishuTableGroup(channelConfig, feishuTableGroupId)
    const matches = defaultGroup.douyinMaterialMatches
    const index = matches.findIndex(item => item.id === id)

    if (index < 0) {
      ctx.status = 404
      ctx.body = {
        code: -1,
        message: '匹配规则不存在',
      }
      return
    }

    const deleted = matches.splice(index, 1)[0]
    syncDefaultFeishuTableGroupMatches(channelConfig)
    user.updatedAt = new Date().toISOString()
    await writeUser(user)

    ctx.body = {
      code: 0,
      message: '删除成功',
      data: deleted,
    }
  } catch (error) {
    ctx.status = error.status || 500
    ctx.body = {
      code: -1,
      message: error.message || '删除失败',
      error: error.message,
    }
  }
})

export default router
