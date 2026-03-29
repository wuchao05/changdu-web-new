import Router from '@koa/router'
import crypto from 'crypto'
import {
  deleteUser,
  listUsers,
  readChannels,
  sanitizeUser,
  writeChannels,
  writeUser,
  normalizeChannel,
  normalizeUser,
} from '../utils/studioData.js'
import { requireAdmin } from '../utils/studioSession.js'

const router = new Router({
  prefix: '/api/admin',
})

router.use(requireAdmin)

function buildUserResponse(user, channelMap) {
  return {
    ...sanitizeUser(user),
    channelNames: (Array.isArray(user.channelIds) ? user.channelIds : [])
      .map(channelId => channelMap.get(channelId)?.name)
      .filter(Boolean),
    defaultChannelName: channelMap.get(user.defaultChannelId)?.name || '',
  }
}

router.get('/users', async ctx => {
  const users = await listUsers()
  const channels = await readChannels()
  const channelMap = new Map(channels.channels.map(channel => [channel.id, channel]))

  ctx.body = {
    code: 0,
    message: 'success',
    data: users.map(user => buildUserResponse(user, channelMap)),
  }
})

router.get('/users/:id', async ctx => {
  const { id } = ctx.params
  const users = await listUsers()
  const channels = await readChannels()
  const channelMap = new Map(channels.channels.map(channel => [channel.id, channel]))
  const user = users.find(item => item.id === id)

  if (!user) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: '用户不存在',
    }
    return
  }

  ctx.body = {
    code: 0,
    message: 'success',
    data: buildUserResponse(user, channelMap),
  }
})

router.post('/users', async ctx => {
  const payload = ctx.request.body || {}
  const users = await listUsers()

  if (!payload.account || !payload.password || !payload.nickname) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '昵称、账号、密码为必填项',
    }
    return
  }

  if (users.some(user => user.account === payload.account)) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '账号已存在',
    }
    return
  }

  const user = await writeUser(
    normalizeUser({
      ...payload,
      id: payload.id || crypto.randomUUID(),
    })
  )

  ctx.body = {
    code: 0,
    message: '用户创建成功',
    data: sanitizeUser(user),
  }
})

router.put('/users/:id', async ctx => {
  const { id } = ctx.params
  const payload = ctx.request.body || {}
  const users = await listUsers()
  const current = users.find(user => user.id === id)

  if (!current) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: '用户不存在',
    }
    return
  }

  if (
    payload.account &&
    users.some(user => user.account === payload.account && user.id !== current.id)
  ) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '账号已存在',
    }
    return
  }

  const normalizedPayload = { ...payload }
  if (typeof normalizedPayload.password === 'string' && !normalizedPayload.password.trim()) {
    delete normalizedPayload.password
  }

  const updated = await writeUser(
    normalizeUser({
      ...current,
      ...normalizedPayload,
      id: current.id,
      updatedAt: new Date().toISOString(),
    })
  )

  ctx.body = {
    code: 0,
    message: '用户更新成功',
    data: sanitizeUser(updated),
  }
})

router.delete('/users/:id', async ctx => {
  const { id } = ctx.params
  const users = await listUsers()
  const current = users.find(user => user.id === id)

  if (!current) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: '用户不存在',
    }
    return
  }

  if (current.userType === 'admin' && current.account === 'admin') {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '默认管理员账号不可删除',
    }
    return
  }

  await deleteUser(id)
  ctx.body = {
    code: 0,
    message: '用户删除成功',
  }
})

router.get('/channels', async ctx => {
  const channels = await readChannels()
  ctx.body = {
    code: 0,
    message: 'success',
    data: channels.channels,
  }
})

router.get('/channels/:id', async ctx => {
  const { id } = ctx.params
  const { channels } = await readChannels()
  const channel = channels.find(item => item.id === id)

  if (!channel) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: '渠道不存在',
    }
    return
  }

  ctx.body = {
    code: 0,
    message: 'success',
    data: channel,
  }
})

router.post('/channels', async ctx => {
  const payload = ctx.request.body || {}
  const { channels } = await readChannels()

  if (!payload.name) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '渠道名称不能为空',
    }
    return
  }

  if (channels.some(channel => channel.name === payload.name)) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '渠道名称已存在',
    }
    return
  }

  const channel = normalizeChannel({
    ...payload,
    id: payload.id || crypto.randomUUID(),
  })

  channels.push(channel)
  await writeChannels(channels)

  ctx.body = {
    code: 0,
    message: '渠道创建成功',
    data: channel,
  }
})

router.put('/channels/:id', async ctx => {
  const { id } = ctx.params
  const payload = ctx.request.body || {}
  const { channels } = await readChannels()
  const index = channels.findIndex(channel => channel.id === id)

  if (index < 0) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: '渠道不存在',
    }
    return
  }

  if (
    payload.name &&
    channels.some(channel => channel.name === payload.name && channel.id !== id)
  ) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '渠道名称已存在',
    }
    return
  }

  const updated = normalizeChannel({
    ...channels[index],
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
  })

  channels[index] = updated
  await writeChannels(channels)

  ctx.body = {
    code: 0,
    message: '渠道更新成功',
    data: updated,
  }
})

router.delete('/channels/:id', async ctx => {
  const { id } = ctx.params
  const { channels } = await readChannels()
  const users = await listUsers()

  if (users.some(user => Array.isArray(user.channelIds) && user.channelIds.includes(id))) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '该渠道已被用户关联，无法删除',
    }
    return
  }

  const nextChannels = channels.filter(channel => channel.id !== id)
  if (nextChannels.length === channels.length) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: '渠道不存在',
    }
    return
  }

  await writeChannels(nextChannels)
  ctx.body = {
    code: 0,
    message: '渠道删除成功',
  }
})

router.get('/overview', async ctx => {
  const users = await listUsers()
  const { channels } = await readChannels()

  ctx.body = {
    code: 0,
    message: 'success',
    data: {
      userCount: users.length,
      channelCount: channels.length,
      adminCount: users.filter(user => user.userType === 'admin').length,
      normalCount: users.filter(user => user.userType === 'normal').length,
    },
  }
})

export default router
