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
import {
  isValidBuildBidValue,
  normalizeBuildBidValue,
  validateCustomBidConfig,
} from '../utils/buildBid.js'
import { requireAdmin } from '../utils/studioSession.js'
import { listSchedulerStatuses as listAutoSubmitSchedulerStatuses } from '../services/autoSubmitScheduler.js'
import { listSchedulerStatuses as listBuildWorkflowSchedulerStatuses } from '../services/buildWorkflowScheduler.js'
import { materialPreviewManager } from '../services/materialPreviewManager.js'

const router = new Router({
  prefix: '/api/admin',
})

router.use(requireAdmin)

const OVERDUE_GRACE_MS = 2 * 60 * 1000
const RUNNING_TOO_LONG_MS = {
  autoSubmit: 15 * 60 * 1000,
  buildWorkflow: 30 * 60 * 1000,
  materialPreview: 20 * 60 * 1000,
}
const PROTECTED_ADMIN_ACCOUNT = 'xh'

function isProtectedAdminAccount(user = {}) {
  return String(user.account || '').trim() === PROTECTED_ADMIN_ACCOUNT
}

function formatDuration(value) {
  const timestamp = parseSchedulerTimeMs(value)
  if (!Number.isFinite(timestamp)) {
    return '0分钟'
  }

  const durationMs = Math.max(Date.now() - timestamp, 0)
  const totalMinutes = Math.floor(durationMs / (60 * 1000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  const parts = []

  if (days > 0) {
    parts.push(`${days}天`)
  }
  if (hours > 0) {
    parts.push(`${hours}小时`)
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}分钟`)
  }

  return parts.join('')
}

function buildUserResponse(user, channelMap) {
  return {
    ...sanitizeUser(user),
    channelNames: (Array.isArray(user.channelIds) ? user.channelIds : [])
      .map(channelId => channelMap.get(channelId)?.name)
      .filter(Boolean),
    defaultChannelName: channelMap.get(user.defaultChannelId)?.name || '',
  }
}

function validateUserBuildBidConfigs(userPayload = {}, channels = []) {
  const channelConfigs =
    userPayload.channelConfigs && typeof userPayload.channelConfigs === 'object'
      ? userPayload.channelConfigs
      : {}
  const channelMap = new Map(channels.map(channel => [channel.id, channel]))

  Object.entries(channelConfigs).forEach(([channelId, config]) => {
    const currentChannel = channelMap.get(channelId)
    if (!currentChannel?.juliang?.buildConfig?.enableCustomBid) {
      return
    }

    const bid = normalizeBuildBidValue(config?.buildPreference?.bid)
    if (!bid) {
      return
    }

    if (!isValidBuildBidValue(bid)) {
      const channelName = currentChannel.name || channelId
      const error = new Error(`【${channelName}】个人覆盖出价必须是数字`)
      error.status = 400
      throw error
    }

    if (config?.buildPreference && typeof config.buildPreference === 'object') {
      config.buildPreference.bid = bid
    }
  })
}

function buildUserChannelKey(userId, channelId) {
  return `${String(userId || '').trim()}::${String(channelId || '').trim()}`
}

function parseSchedulerTimeMs(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return Number.NaN
  }

  const beijingMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (beijingMatch) {
    const [, year, month, day, hour, minute, second] = beijingMatch
    return Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`)
  }

  return Date.parse(rawValue)
}

function formatBeijingDateTime(value) {
  const timestamp = parseSchedulerTimeMs(value)
  if (!Number.isFinite(timestamp)) {
    return null
  }

  const date = new Date(timestamp)
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = beijingDate.getUTCFullYear()
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingDate.getUTCDate()).padStart(2, '0')
  const hours = String(beijingDate.getUTCHours()).padStart(2, '0')
  const minutes = String(beijingDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(beijingDate.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function normalizeDisplayTime(rawValue, fallbackText = null) {
  return fallbackText || formatBeijingDateTime(rawValue)
}

function buildAutoSubmitTask(status, nowMs) {
  const taskHistory = Array.isArray(status?.taskHistory) ? status.taskHistory : []
  const latestRecord = taskHistory[0] || null
  const currentTask = status?.currentTask || null
  const nextRunTimeMs = parseSchedulerTimeMs(status?.nextRunTime)
  const runningDurationMs = parseSchedulerTimeMs(currentTask?.startTime)
  const abnormalReasons = []

  if (status?.enabled && !status?.running && !status?.nextRunTime) {
    abnormalReasons.push('已启用但缺少下次运行时间')
  }
  if (
    status?.enabled &&
    status?.nextRunTime &&
    Number.isFinite(nextRunTimeMs) &&
    nextRunTimeMs + OVERDUE_GRACE_MS < nowMs
  ) {
    abnormalReasons.push('已超过计划运行时间仍未恢复')
  }
  if (
    status?.running &&
    Number.isFinite(runningDurationMs) &&
    nowMs - runningDurationMs > RUNNING_TOO_LONG_MS.autoSubmit
  ) {
    abnormalReasons.push('自动提交运行时间过长')
  }
  if (latestRecord?.status === 'error') {
    abnormalReasons.push('最近一次执行失败')
  }
  if (latestRecord?.error) {
    abnormalReasons.push(`最近错误：${latestRecord.error}`)
  }

  return {
    key: 'autoSubmit',
    title: '自动提交下载',
    enabled: Boolean(status?.enabled),
    running: Boolean(status?.running),
    isAbnormal: abnormalReasons.length > 0,
    abnormalReasons,
    nextRunTime: status?.nextRunTime || null,
    nextRunTimeText: normalizeDisplayTime(status?.nextRunTime),
    lastRunTime: status?.lastRunTime || null,
    lastRunTimeText: normalizeDisplayTime(status?.lastRunTime),
    currentTask,
    submissionType: Boolean(status?.onlyRedFlag) ? '仅红标' : '全部',
    runningDurationText: formatDuration(currentTask?.startTime),
    progress: status?.progress || {
      current: 0,
      total: 0,
      currentDate: '',
      currentDrama: '',
    },
    intervalMinutes: Number(status?.intervalMinutes || 0),
    onlyRedFlag: Boolean(status?.onlyRedFlag),
    stats: status?.stats || {
      totalProcessed: 0,
      successCount: 0,
      failCount: 0,
      skipCount: 0,
    },
    taskHistory,
  }
}

function buildBuildWorkflowTask(status, nowMs) {
  const taskHistory = Array.isArray(status?.taskHistory) ? status.taskHistory : []
  const latestRecord = taskHistory[0] || null
  const currentTask = status?.currentTask || null
  const nextRunTimeMs = parseSchedulerTimeMs(status?.nextRunTime)
  const runningDurationMs = parseSchedulerTimeMs(currentTask?.startTime)
  const abnormalReasons = []

  if (status?.enabled && !currentTask && !status?.nextRunTime) {
    abnormalReasons.push('已启用但缺少下次运行时间')
  }
  if (
    status?.enabled &&
    status?.nextRunTime &&
    Number.isFinite(nextRunTimeMs) &&
    nextRunTimeMs + OVERDUE_GRACE_MS < nowMs
  ) {
    abnormalReasons.push('已超过计划运行时间仍未恢复')
  }
  if (
    currentTask &&
    Number.isFinite(runningDurationMs) &&
    nowMs - runningDurationMs > RUNNING_TOO_LONG_MS.buildWorkflow
  ) {
    abnormalReasons.push('后台搭建运行时间过长')
  }
  if (latestRecord?.status === 'failed') {
    abnormalReasons.push('最近一次执行失败')
  }
  if (latestRecord?.error) {
    abnormalReasons.push(`最近错误：${latestRecord.error}`)
  }

  return {
    key: 'buildWorkflow',
    title: '后台搭建',
    enabled: Boolean(status?.enabled),
    running: Boolean(currentTask),
    isAbnormal: abnormalReasons.length > 0,
    abnormalReasons,
    nextRunTime: status?.nextRunTime || null,
    nextRunTimeText: normalizeDisplayTime(status?.nextRunTime),
    lastRunTime: status?.lastRunTime || null,
    lastRunTimeText: normalizeDisplayTime(status?.lastRunTime),
    currentTask,
    intervalMinutes: Number(status?.intervalMinutes || 0),
    tableId: status?.tableId || null,
    queueSnapshot: status?.queueSnapshot || {
      pendingCount: 0,
      buildableCount: 0,
      updatedAt: null,
    },
    stats: status?.stats || {
      totalBuilt: 0,
      successCount: 0,
      failCount: 0,
    },
    taskHistory,
  }
}

function buildMaterialPreviewTask(status, nowMs) {
  const currentTask = status?.running
    ? {
        status: 'running',
        startTime: status?.lastRunTime || null,
      }
    : null
  const nextRunTimeMs = parseSchedulerTimeMs(status?.nextRunTime)
  const runningDurationMs = parseSchedulerTimeMs(currentTask?.startTime)
  const abnormalReasons = []

  if (status?.enabled && !status?.running && !status?.nextRunTime) {
    abnormalReasons.push('已启用但缺少下次运行时间')
  }
  if (
    status?.enabled &&
    status?.nextRunTime &&
    Number.isFinite(nextRunTimeMs) &&
    nextRunTimeMs + OVERDUE_GRACE_MS < nowMs
  ) {
    abnormalReasons.push('已超过计划运行时间仍未恢复')
  }
  if (
    status?.running &&
    Number.isFinite(runningDurationMs) &&
    nowMs - runningDurationMs > RUNNING_TOO_LONG_MS.materialPreview
  ) {
    abnormalReasons.push('素材预览运行时间过长')
  }
  if (status?.lastStatus === 'failed') {
    abnormalReasons.push('最近一次执行失败')
  }
  if (status?.lastError) {
    abnormalReasons.push(`最近错误：${status.lastError}`)
  }

  return {
    key: 'materialPreview',
    title: '素材预览',
    enabled: Boolean(status?.enabled),
    running: Boolean(status?.running),
    isAbnormal: abnormalReasons.length > 0,
    abnormalReasons,
    nextRunTime: status?.nextRunTime || null,
    nextRunTimeText: normalizeDisplayTime(status?.nextRunTime, status?.nextRunTimeText || null),
    lastRunTime: status?.lastRunTime || null,
    lastRunTimeText: normalizeDisplayTime(status?.lastRunTime, status?.lastRunTimeText || null),
    currentTask,
    intervalMinutes: Number(status?.intervalMinutes || 0),
    buildTimeWindowStart: Number(status?.buildTimeWindowStart || 0),
    buildTimeWindowEnd: Number(status?.buildTimeWindowEnd || 0),
    lastStatus: status?.lastStatus || null,
    lastError: status?.lastError || '',
    stats: status?.stats || {
      totalProcessed: 0,
      totalPreviewed: 0,
      totalDeleted: 0,
      successCount: 0,
      failCount: 0,
    },
  }
}

function buildTaskSummary(tasks) {
  const taskList = Object.values(tasks)
  return {
    total: taskList.length,
    enabledCount: taskList.filter(task => task.enabled).length,
    runningCount: taskList.filter(task => task.running).length,
    abnormalCount: taskList.filter(task => task.isAbnormal).length,
    hasAbnormal: taskList.some(task => task.isAbnormal),
  }
}

function createSchedulerOverviewItem({ userId, runtimeUserName, account, channelId, channelName }) {
  const autoSubmit = buildAutoSubmitTask(null, Date.now())
  const buildWorkflow = buildBuildWorkflowTask(null, Date.now())
  const materialPreview = buildMaterialPreviewTask(null, Date.now())
  const tasks = {
    autoSubmit,
    buildWorkflow,
    materialPreview,
  }

  return {
    userId,
    runtimeUserName,
    account,
    channelId,
    channelName,
    tasks,
    summary: buildTaskSummary(tasks),
  }
}

function buildSchedulerUserSummary(channels) {
  return {
    channelCount: channels.length,
    enabledCount: channels.reduce((sum, item) => sum + item.summary.enabledCount, 0),
    runningCount: channels.reduce((sum, item) => sum + item.summary.runningCount, 0),
    abnormalCount: channels.reduce((sum, item) => sum + item.summary.abnormalCount, 0),
    abnormalChannels: channels.filter(item => item.summary.hasAbnormal).length,
    hasAbnormal: channels.some(item => item.summary.hasAbnormal),
    hasRunning: channels.some(item => item.summary.runningCount > 0),
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

router.get('/scheduler-overview', async ctx => {
  const requestedUserId = String(ctx.query.userId || '').trim()
  const [users, { channels }, autoSubmitStatuses, buildWorkflowStatuses] = await Promise.all([
    listUsers(),
    readChannels(),
    listAutoSubmitSchedulerStatuses(),
    listBuildWorkflowSchedulerStatuses({ refreshQueueSnapshot: true }),
  ])
  await materialPreviewManager.init()
  const materialPreviewStatuses = materialPreviewManager.listStatus()
  const nowMs = Date.now()
  const itemMap = new Map()
  const channelMap = new Map(channels.map(channel => [channel.id, channel]))
  const userOrderMap = new Map(users.map((user, index) => [user.id, index]))
  const filterUserSet = requestedUserId ? new Set([requestedUserId]) : null
  const userOptions = users.map(user => ({
    userId: user.id,
    runtimeUserName: user.nickname,
    account: user.account,
  }))

  for (const user of users) {
    if (filterUserSet && !filterUserSet.has(user.id)) {
      continue
    }

    const channelIds = Array.isArray(user.channelIds)
      ? user.channelIds
      : user.channelId
        ? [user.channelId]
        : []

    for (const channelId of channelIds) {
      const normalizedChannelId = String(channelId || '').trim()
      if (!normalizedChannelId) {
        continue
      }

      const key = buildUserChannelKey(user.id, normalizedChannelId)
      itemMap.set(
        key,
        createSchedulerOverviewItem({
          userId: user.id,
          runtimeUserName: user.nickname,
          account: user.account,
          channelId: normalizedChannelId,
          channelName: channelMap.get(normalizedChannelId)?.name || normalizedChannelId,
        })
      )
    }
  }

  function ensureOverviewItem(status, fallbackChannelName = '') {
    const userId = String(status?.userId || '').trim()
    const channelId = String(status?.channelId || '').trim()
    if (!userId || !channelId) {
      return null
    }
    if (filterUserSet && !filterUserSet.has(userId)) {
      return null
    }

    const key = buildUserChannelKey(userId, channelId)
    if (!itemMap.has(key)) {
      itemMap.set(
        key,
        createSchedulerOverviewItem({
          userId,
          runtimeUserName: String(status?.runtimeUserName || '').trim() || userId,
          account: '',
          channelId,
          channelName: String(status?.channelName || '').trim() || fallbackChannelName || channelId,
        })
      )
    }

    return itemMap.get(key)
  }

  for (const status of autoSubmitStatuses) {
    const item = ensureOverviewItem(status)
    if (!item) {
      continue
    }
    item.tasks.autoSubmit = buildAutoSubmitTask(status, nowMs)
  }

  for (const status of buildWorkflowStatuses) {
    const item = ensureOverviewItem(status)
    if (!item) {
      continue
    }
    item.tasks.buildWorkflow = buildBuildWorkflowTask(status, nowMs)
  }

  for (const status of materialPreviewStatuses) {
    const item = ensureOverviewItem(status)
    if (!item) {
      continue
    }
    item.tasks.materialPreview = buildMaterialPreviewTask(status, nowMs)
  }

  const items = [...itemMap.values()]
    .map(item => ({
      ...item,
      summary: buildTaskSummary(item.tasks),
    }))
    .sort((first, second) => {
      if (first.summary.hasAbnormal !== second.summary.hasAbnormal) {
        return first.summary.hasAbnormal ? -1 : 1
      }
      if (first.runtimeUserName !== second.runtimeUserName) {
        return first.runtimeUserName.localeCompare(second.runtimeUserName, 'zh-CN')
      }
      return first.channelName.localeCompare(second.channelName, 'zh-CN')
    })

  const userMap = new Map()
  for (const item of items) {
    if (!userMap.has(item.userId)) {
      userMap.set(item.userId, {
        userId: item.userId,
        runtimeUserName: item.runtimeUserName,
        account: item.account,
        channels: [],
      })
    }

    const userGroup = userMap.get(item.userId)
    if (!userGroup.account && item.account) {
      userGroup.account = item.account
    }
    userGroup.channels.push(item)
  }

  const groupedUsers = [...userMap.values()]
    .map(userGroup => ({
      ...userGroup,
      summary: buildSchedulerUserSummary(userGroup.channels),
      channels: [...userGroup.channels].sort((first, second) => {
        if (first.summary.hasAbnormal !== second.summary.hasAbnormal) {
          return first.summary.hasAbnormal ? -1 : 1
        }
        if (first.summary.runningCount !== second.summary.runningCount) {
          return second.summary.runningCount - first.summary.runningCount
        }
        return first.channelName.localeCompare(second.channelName, 'zh-CN')
      }),
    }))
    .sort(
      (first, second) =>
        (userOrderMap.get(first.userId) ?? Number.MAX_SAFE_INTEGER) -
        (userOrderMap.get(second.userId) ?? Number.MAX_SAFE_INTEGER)
    )

  ctx.body = {
    code: 0,
    message: 'success',
    data: {
      updatedAt: new Date().toISOString(),
      summary: {
        totalUsers: groupedUsers.length,
        totalChannels: items.length,
        abnormalUsers: groupedUsers.filter(user => user.summary.hasAbnormal).length,
        runningTasks: items.reduce((sum, item) => sum + item.summary.runningCount, 0),
        enabledTasks: items.reduce((sum, item) => sum + item.summary.enabledCount, 0),
      },
      users: groupedUsers,
      userOptions,
      selectedUserId: requestedUserId || null,
    },
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
  const { channels } = await readChannels()

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

  validateUserBuildBidConfigs(payload, channels)

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
  const { channels } = await readChannels()
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

  if (
    isProtectedAdminAccount(current) &&
    payload.account &&
    String(payload.account || '').trim() !== PROTECTED_ADMIN_ACCOUNT
  ) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '主管理员账户 xh 不可修改账号',
    }
    return
  }

  if (
    isProtectedAdminAccount(current) &&
    typeof payload.userType !== 'undefined' &&
    payload.userType !== 'admin'
  ) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '主管理员账户 xh 必须保持管理员身份',
    }
    return
  }

  if (typeof normalizedPayload.password === 'string' && !normalizedPayload.password.trim()) {
    delete normalizedPayload.password
  }

  validateUserBuildBidConfigs(normalizedPayload, channels)

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

  if (isProtectedAdminAccount(current)) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '主管理员账户 xh 不可删除',
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

router.put('/channels/reorder', async ctx => {
  const payload = ctx.request.body || {}
  const channelIds = Array.isArray(payload.channelIds) ? payload.channelIds : []
  const { channels } = await readChannels()
  const currentChannelIds = channels.map(channel => channel.id)

  if (channelIds.length !== channels.length) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '渠道排序数据不完整',
    }
    return
  }

  const requestedIds = channelIds.map(item => String(item || '').trim()).filter(Boolean)
  const hasSameSet =
    requestedIds.length === currentChannelIds.length &&
    currentChannelIds.every(id => requestedIds.includes(id))

  if (!hasSameSet) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '渠道排序数据无效',
    }
    return
  }

  const channelMap = new Map(channels.map(channel => [channel.id, channel]))
  const reorderedChannels = requestedIds.map(id => channelMap.get(id)).filter(Boolean)
  await writeChannels(reorderedChannels)

  ctx.body = {
    code: 0,
    message: '渠道排序已更新',
    data: reorderedChannels,
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

  try {
    validateCustomBidConfig(payload?.juliang?.buildConfig)
  } catch (error) {
    ctx.status = error.status || 400
    ctx.body = {
      code: 400,
      message: error.message || '渠道出价配置不合法',
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

  try {
    validateCustomBidConfig(payload?.juliang?.buildConfig)
  } catch (error) {
    ctx.status = error.status || 400
    ctx.body = {
      code: 400,
      message: error.message || '渠道出价配置不合法',
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
    currentIndex === index
      ? updated
      : { ...config, isDefault: updated.isDefault ? false : config.isDefault }
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
