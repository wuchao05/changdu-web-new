import Router from '@koa/router'
import crypto from 'crypto'
import {
  deleteUser,
  getDefaultDownloadCenterConfig,
  listUsers,
  readChannels,
  readDownloadCenterConfigs,
  sanitizeUser,
  writeChannels,
  writeDownloadCenterConfigs,
  writeUser,
  normalizeDownloadCenterConfig,
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

router.get('/download-center-configs', async ctx => {
  const { configs } = await readDownloadCenterConfigs()
  ctx.body = {
    code: 0,
    message: 'success',
    data: configs,
  }
})

router.get('/download-center-configs/default', async ctx => {
  const config = await getDefaultDownloadCenterConfig()
  ctx.body = {
    code: 0,
    message: 'success',
    data: config,
  }
})

router.post('/download-center-configs', async ctx => {
  const payload = ctx.request.body || {}
  const { configs } = await readDownloadCenterConfigs()

  if (!payload.name || !payload.owner) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '常读名称和所属人为必填项',
    }
    return
  }

  const nextConfig = normalizeDownloadCenterConfig({
    ...payload,
    id: payload.id || crypto.randomUUID(),
    isDefault: payload.isDefault || configs.length === 0,
  })

  const nextConfigs = nextConfig.isDefault
    ? configs.map(config => ({ ...config, isDefault: false })).concat(nextConfig)
    : configs.concat(nextConfig)

  await writeDownloadCenterConfigs(nextConfigs)

  ctx.body = {
    code: 0,
    message: '下载中心配置创建成功',
    data: nextConfig,
  }
})

router.put('/download-center-configs/:id', async ctx => {
  const { id } = ctx.params
  const payload = ctx.request.body || {}
  const { configs } = await readDownloadCenterConfigs()
  const index = configs.findIndex(config => config.id === id)

  if (index < 0) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: '下载中心配置不存在',
    }
    return
  }

  const updated = normalizeDownloadCenterConfig({
    ...configs[index],
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
  })

  if (!updated.name || !updated.owner) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '常读名称和所属人为必填项',
    }
    return
  }

  const nextConfigs = configs.map((config, currentIndex) =>
    currentIndex === index ? updated : { ...config, isDefault: updated.isDefault ? false : config.isDefault }
  )

  await writeDownloadCenterConfigs(nextConfigs)

  ctx.body = {
    code: 0,
    message: '下载中心配置更新成功',
    data: updated,
  }
})

router.delete('/download-center-configs/:id', async ctx => {
  const { id } = ctx.params
  const { configs } = await readDownloadCenterConfigs()
  const nextConfigs = configs.filter(config => config.id !== id)

  if (nextConfigs.length === configs.length) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: '下载中心配置不存在',
    }
    return
  }

  await writeDownloadCenterConfigs(nextConfigs)
  ctx.body = {
    code: 0,
    message: '下载中心配置删除成功',
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
