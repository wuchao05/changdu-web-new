import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { MaterialPreviewService } from './materialPreviewService.js'
import { readUser, resolveRuntimeContext } from '../utils/studioData.js'
import { resolveChannelRuntimeById } from '../utils/channelRuntime.js'
import { buildRuntimeInstanceKey, normalizeRuntimeInstanceKey } from '../utils/runtimeInstance.js'
import { FEISHU_CONFIG } from '../config/feishu.js'
import { buildServiceLogPrefix } from '../utils/serviceLogger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isProduction = process.env.NODE_ENV === 'production'
const STATE_FILE_PATH = isProduction
  ? '/data/changdu-web/material-preview-states.json'
  : path.join(__dirname, '../data/material-preview-states.json')

const DEFAULT_INTERVAL_MINUTES = 20
const DEFAULT_BUILD_TIME_WINDOW_START = 90
const DEFAULT_BUILD_TIME_WINDOW_END = 20

function nowIso() {
  return new Date().toISOString()
}

function formatBeijingTime(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijingDate = new Date(date.getTime() + beijingOffset)
  const year = beijingDate.getUTCFullYear()
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingDate.getUTCDate()).padStart(2, '0')
  const hours = String(beijingDate.getUTCHours()).padStart(2, '0')
  const minutes = String(beijingDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(beijingDate.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function createDefaultState() {
  return {
    instanceKey: '',
    userId: '',
    runtimeUserName: '',
    channelId: '',
    channelName: '',
    enabled: false,
    running: false,
    intervalMinutes: DEFAULT_INTERVAL_MINUTES,
    buildTimeWindowStart: DEFAULT_BUILD_TIME_WINDOW_START,
    buildTimeWindowEnd: DEFAULT_BUILD_TIME_WINDOW_END,
    nextRunTime: null,
    lastRunTime: null,
    lastStatus: null,
    lastError: '',
    lastResolvedConfig: {
      tableId: '',
      awemeWhiteList: [],
    },
    stats: {
      totalProcessed: 0,
      totalPreviewed: 0,
      totalDeleted: 0,
      successCount: 0,
      failCount: 0,
    },
  }
}

function normalizeState(state = {}) {
  const base = createDefaultState()
  return {
    ...base,
    ...state,
    instanceKey: String(state.instanceKey || '').trim(),
    userId: String(state.userId || '').trim(),
    runtimeUserName: String(state.runtimeUserName || '').trim(),
    channelId: String(state.channelId || '').trim(),
    channelName: String(state.channelName || '').trim(),
    enabled: Boolean(state.enabled),
    running: Boolean(state.running),
    intervalMinutes: Number(state.intervalMinutes || base.intervalMinutes),
    buildTimeWindowStart: Number(state.buildTimeWindowStart || base.buildTimeWindowStart),
    buildTimeWindowEnd: Number(state.buildTimeWindowEnd || base.buildTimeWindowEnd),
    nextRunTime: state.nextRunTime || null,
    lastRunTime: state.lastRunTime || null,
    lastStatus: state.lastStatus || null,
    lastError: String(state.lastError || ''),
    lastResolvedConfig: {
      tableId: String(state.lastResolvedConfig?.tableId || '').trim(),
      awemeWhiteList: Array.isArray(state.lastResolvedConfig?.awemeWhiteList)
        ? state.lastResolvedConfig.awemeWhiteList.map(item => String(item || '').trim()).filter(Boolean)
        : [],
    },
    stats: {
      totalProcessed: Number(state.stats?.totalProcessed || 0),
      totalPreviewed: Number(state.stats?.totalPreviewed || 0),
      totalDeleted: Number(state.stats?.totalDeleted || 0),
      successCount: Number(state.stats?.successCount || 0),
      failCount: Number(state.stats?.failCount || 0),
    },
  }
}

function getMaterialPreviewLogPrefix(source = {}) {
  return buildServiceLogPrefix('素材预览', {
    runtimeUserName: source.runtimeUserName,
    userId: source.userId,
    channelName: source.channelName,
    channelId: source.channelId,
  })
}

class MaterialPreviewManager {
  constructor() {
    this.previewService = new MaterialPreviewService()
    this.states = new Map()
    this.timers = new Map()
    this.initialized = false
    this.saveStatesQueue = Promise.resolve()
  }

  async init() {
    if (this.initialized) {
      return
    }

    this.initialized = true
    await this.loadStates()
    await this.restoreTimers()
  }

  async startPreview(runtimeContext, options = {}) {
    await this.init()

    const instanceKey = normalizeRuntimeInstanceKey(
      options.instanceKey || buildRuntimeInstanceKey(runtimeContext)
    )
    const existing = this.states.get(instanceKey)
    if (existing?.enabled) {
      throw new Error(`素材预览已在运行中: ${instanceKey}`)
    }

    const state = normalizeState({
      ...existing,
      instanceKey,
      userId: runtimeContext.runtimeUser?.id || runtimeContext.userId || '',
      runtimeUserName: runtimeContext.runtimeUser?.nickname || existing?.runtimeUserName || '',
      channelId: runtimeContext.channel?.id || runtimeContext.channelId || '',
      channelName: runtimeContext.channel?.name || existing?.channelName || '',
      enabled: true,
      running: false,
      intervalMinutes: Number(options.intervalMinutes || existing?.intervalMinutes || DEFAULT_INTERVAL_MINUTES),
      buildTimeWindowStart: Number(
        options.buildTimeWindowStart || existing?.buildTimeWindowStart || DEFAULT_BUILD_TIME_WINDOW_START
      ),
      buildTimeWindowEnd: Number(
        options.buildTimeWindowEnd || existing?.buildTimeWindowEnd || DEFAULT_BUILD_TIME_WINDOW_END
      ),
      lastError: '',
    })

    this.states.set(instanceKey, state)
    this.createTimer(instanceKey, { delayMs: 1000 })
    await this.saveStates()

    console.log(
      `${getMaterialPreviewLogPrefix(state)} 已启动:`,
      JSON.stringify(
        {
          instanceKey,
          userId: state.userId,
          runtimeUserName: state.runtimeUserName,
          channelId: state.channelId,
          channelName: state.channelName,
          intervalMinutes: state.intervalMinutes,
          buildTimeWindowStart: state.buildTimeWindowStart,
          buildTimeWindowEnd: state.buildTimeWindowEnd,
        },
        null,
        2
      )
    )

    return this.getStatus(instanceKey)
  }

  async stopPreview(instanceKey) {
    await this.init()
    const normalizedKey = normalizeRuntimeInstanceKey(instanceKey)
    const state = this.states.get(normalizedKey)
    if (!state || !state.enabled) {
      throw new Error(`素材预览未运行: ${normalizedKey}`)
    }

    this.clearTimer(normalizedKey)
    state.enabled = false
    state.running = false
    state.nextRunTime = null
    await this.saveStates()

    console.log(
      `${getMaterialPreviewLogPrefix(state)} 已停止:`,
      JSON.stringify(
        {
          instanceKey: normalizedKey,
          userId: state.userId,
          runtimeUserName: state.runtimeUserName,
          channelId: state.channelId,
          channelName: state.channelName,
        },
        null,
        2
      )
    )

    return this.getStatus(normalizedKey)
  }

  async updatePreview(instanceKey, updates = {}) {
    await this.init()
    const normalizedKey = normalizeRuntimeInstanceKey(instanceKey)
    const state = this.states.get(normalizedKey)
    if (!state) {
      throw new Error(`素材预览不存在: ${normalizedKey}`)
    }

    if (updates.intervalMinutes !== undefined) {
      state.intervalMinutes = Number(updates.intervalMinutes || state.intervalMinutes)
    }
    if (updates.buildTimeWindowStart !== undefined) {
      state.buildTimeWindowStart = Number(updates.buildTimeWindowStart || state.buildTimeWindowStart)
    }
    if (updates.buildTimeWindowEnd !== undefined) {
      state.buildTimeWindowEnd = Number(updates.buildTimeWindowEnd || state.buildTimeWindowEnd)
    }

    if (state.enabled) {
      this.createTimer(normalizedKey)
    }

    await this.saveStates()
    return this.getStatus(normalizedKey)
  }

  async triggerPreview(instanceKey) {
    await this.init()
    const normalizedKey = normalizeRuntimeInstanceKey(instanceKey)
    if (!this.states.has(normalizedKey)) {
      throw new Error(`素材预览不存在: ${normalizedKey}`)
    }

    await this.executePreview(normalizedKey)
    return this.getStatus(normalizedKey)
  }

  getStatus(instanceKey) {
    const normalizedKey = normalizeRuntimeInstanceKey(instanceKey)
    const state = this.states.get(normalizedKey)
    return state ? this.serializeState(state) : this.serializeState(normalizeState({ instanceKey: normalizedKey }))
  }

  listStatus(filters = {}) {
    let states = [...this.states.values()]

    if (filters.userId) {
      states = states.filter(state => state.userId === filters.userId)
    }
    if (filters.channelId) {
      states = states.filter(state => state.channelId === filters.channelId)
    }

    return states.map(state => this.serializeState(state))
  }

  stopAllTimers() {
    for (const instanceKey of this.timers.keys()) {
      this.clearTimer(instanceKey)
    }
  }

  serializeState(state) {
    return {
      instanceKey: state.instanceKey,
      userId: state.userId,
      runtimeUserName: state.runtimeUserName,
      channelId: state.channelId,
      channelName: state.channelName,
      enabled: state.enabled,
      running: state.running,
      intervalMinutes: state.intervalMinutes,
      buildTimeWindowStart: state.buildTimeWindowStart,
      buildTimeWindowEnd: state.buildTimeWindowEnd,
      nextRunTime: state.nextRunTime,
      lastRunTime: state.lastRunTime,
      lastStatus: state.lastStatus,
      lastError: state.lastError,
      tableId: state.lastResolvedConfig.tableId,
      awemeWhiteList: state.lastResolvedConfig.awemeWhiteList,
      stats: state.stats,
      lastRunTimeText: formatBeijingTime(state.lastRunTime),
      nextRunTimeText: formatBeijingTime(state.nextRunTime),
    }
  }

  async buildExecutionConfig(state) {
    const user = await readUser(state.userId)
    const runtimeContext = await resolveRuntimeContext(user, state.channelId)
    if (!runtimeContext.runtimeUser || !runtimeContext.channel) {
      throw new Error(`无法解析素材预览运行上下文: ${state.instanceKey}`)
    }

    const channelRuntime = await resolveChannelRuntimeById(runtimeContext.channel.id)
    const cookie = String(channelRuntime.juliang.cookie || '').trim()
    if (!cookie) {
      throw new Error(`渠道 ${runtimeContext.channel.name || runtimeContext.channel.id} 未配置巨量 Cookie`)
    }

    const awemeWhiteList = Array.from(
      new Set(
        (runtimeContext.runtimeUser.douyinMaterialMatches || [])
          .map(item => String(item?.douyinAccount || '').trim())
          .filter(Boolean)
      )
    )
    if (!awemeWhiteList.length) {
      throw new Error(`渠道 ${runtimeContext.channel.name || runtimeContext.channel.id} 未配置抖音号匹配素材`)
    }

    const tableId =
      String(runtimeContext.runtimeUser.feishu?.dramaStatusTableId || '').trim() ||
      FEISHU_CONFIG.table_ids.drama_status

    state.runtimeUserName = String(runtimeContext.runtimeUser.nickname || state.runtimeUserName || '').trim()
    state.channelName = String(runtimeContext.channel.name || state.channelName || '').trim()
    state.lastResolvedConfig = {
      tableId,
      awemeWhiteList,
    }

    return {
      tableId,
      cookie,
      awemeWhiteList,
    }
  }

  createTimer(instanceKey, options = {}) {
    const state = this.states.get(instanceKey)
    if (!state) return

    this.clearTimer(instanceKey)
    const intervalMs = state.intervalMinutes * 60 * 1000
    const nowMs = Date.now()
    const savedNextRunMs = Date.parse(String(state.nextRunTime || ''))
    const hasValidSavedNextRunTime = Number.isFinite(savedNextRunMs)
    const nextRunMs =
      typeof options.delayMs === 'number'
        ? nowMs + Math.max(0, options.delayMs)
        : options.usePersistedTime && hasValidSavedNextRunTime
          ? Math.max(savedNextRunMs, nowMs)
          : nowMs + intervalMs

    const timerId = setTimeout(() => {
      this.timers.delete(instanceKey)
      this.executePreview(instanceKey).catch(error => {
        console.error(`${getMaterialPreviewLogPrefix(state)} 定时执行失败:`, instanceKey, error)
      })
    }, Math.max(0, nextRunMs - nowMs))

    this.timers.set(instanceKey, timerId)
    state.nextRunTime = new Date(nextRunMs).toISOString()
    void this.saveStates()
  }

  clearTimer(instanceKey) {
    const timer = this.timers.get(instanceKey)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(instanceKey)
    }
  }

  async executePreview(instanceKey) {
    const state = this.states.get(instanceKey)
    if (!state) {
      throw new Error(`素材预览不存在: ${instanceKey}`)
    }
    if (state.running) {
      console.log(`${getMaterialPreviewLogPrefix(state)} 上一轮仍在执行，跳过本次:`, instanceKey)
      if (state.enabled) {
        this.createTimer(instanceKey)
      }
      return
    }

    state.running = true
    state.lastRunTime = nowIso()
    state.lastError = ''
    await this.saveStates()

    try {
      const executionConfig = await this.buildExecutionConfig(state)
      console.log(
        `${getMaterialPreviewLogPrefix(state)} 开始执行:`,
        JSON.stringify(
          {
            instanceKey,
            userId: state.userId,
            runtimeUserName: state.runtimeUserName,
            channelId: state.channelId,
            channelName: state.channelName,
            intervalMinutes: state.intervalMinutes,
            buildTimeWindowStart: state.buildTimeWindowStart,
            buildTimeWindowEnd: state.buildTimeWindowEnd,
            tableId: executionConfig.tableId,
            awemeWhiteList: executionConfig.awemeWhiteList,
          },
          null,
          2
        )
      )
      const result = await this.previewService.batchProcessFromFeishu({
        feishu: {
          appId: FEISHU_CONFIG.app_id,
          appSecret: FEISHU_CONFIG.app_secret,
          appToken: FEISHU_CONFIG.app_token,
          tableId: executionConfig.tableId,
        },
        buildTimeFilterWindowStartMinutes: state.buildTimeWindowStart,
        buildTimeFilterWindowEndMinutes: state.buildTimeWindowEnd,
        aweme_white_list: executionConfig.awemeWhiteList,
        previewDelayMs: 400,
        cookie: executionConfig.cookie,
        dryRun: false,
        logPrefix: getMaterialPreviewLogPrefix(state),
      })

      state.lastStatus = result.failed > 0 ? 'failed' : 'success'
      state.stats.totalProcessed += Number(result.total || 0)
      state.stats.successCount += Number(result.success || 0)
      state.stats.failCount += Number(result.failed || 0)

      for (const item of result.results || []) {
        state.stats.totalPreviewed += Number(item.needPreviewCount || 0)
        state.stats.totalDeleted += Number(item.needDeleteCount || 0)
      }

      console.log(
        `${getMaterialPreviewLogPrefix(state)} 执行完成:`,
        JSON.stringify(
          {
            instanceKey,
            channelName: state.channelName || state.channelId,
            total: Number(result.total || 0),
            success: Number(result.success || 0),
            failed: Number(result.failed || 0),
            totalPreviewed: (result.results || []).reduce(
              (sum, item) => sum + Number(item.needPreviewCount || 0),
              0
            ),
            totalDeleted: (result.results || []).reduce(
              (sum, item) => sum + Number(item.needDeleteCount || 0),
              0
            ),
          },
          null,
          2
        )
      )
    } catch (error) {
      state.lastStatus = 'failed'
      state.lastError = error?.message || String(error)
      console.error(`${getMaterialPreviewLogPrefix(state)} 执行失败:`, instanceKey, error)
    } finally {
      state.running = false
      if (state.enabled) {
        this.createTimer(instanceKey)
      } else {
        state.nextRunTime = null
      }
      await this.saveStates()
    }
  }

  async loadStates() {
    try {
      const raw = await fs.readFile(STATE_FILE_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      const items = parsed && typeof parsed === 'object' ? parsed : {}
      for (const [instanceKey, state] of Object.entries(items)) {
        this.states.set(normalizeRuntimeInstanceKey(instanceKey), normalizeState({ ...state, instanceKey }))
      }
    } catch {
      // 忽略首次启动场景
    }
  }

  async saveStates() {
    const saveTask = async () => {
      const dirPath = path.dirname(STATE_FILE_PATH)
      await fs.mkdir(dirPath, { recursive: true })

      const payload = {}
      for (const [instanceKey, state] of this.states.entries()) {
        payload[instanceKey] = {
          ...state,
          running: false,
        }
      }

      // 保存操作可能被定时任务和手动操作同时触发，这里串行化并使用唯一临时文件，避免并发 rename 互相覆盖。
      const tempPath = `${STATE_FILE_PATH}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
      try {
        await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8')
        await fs.rename(tempPath, STATE_FILE_PATH)
      } catch (error) {
        await fs.unlink(tempPath).catch(() => {})
        throw error
      }
    }

    const run = this.saveStatesQueue.then(saveTask)
    this.saveStatesQueue = run.catch(() => {})
    return run
  }

  async restoreTimers() {
    let hasStateChanged = false
    for (const [instanceKey, state] of this.states.entries()) {
      if (state.enabled) {
        const savedNextRunMs = Date.parse(String(state.nextRunTime || ''))
        if (Number.isFinite(savedNextRunMs) && savedNextRunMs <= Date.now()) {
          console.log(`${getMaterialPreviewLogPrefix(state)} 检测到已过点任务，立即补跑:`, instanceKey)
        } else {
          console.log(
            `${getMaterialPreviewLogPrefix(state)} 恢复定时任务，下次运行:`,
            state.nextRunTime || ''
          )
        }
        this.createTimer(instanceKey, { usePersistedTime: true })
      } else if (state.nextRunTime) {
        state.nextRunTime = null
        hasStateChanged = true
      }
    }

    if (hasStateChanged) {
      await this.saveStates()
    }
  }
}

export const materialPreviewManager = new MaterialPreviewManager()
