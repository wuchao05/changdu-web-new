import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PREFERRED_STUDIO_DATA_DIR = process.env.STUDIO_DATA_DIR || '/data/changdu-web/studio'
const FALLBACK_STUDIO_DATA_DIR = path.join(__dirname, '../data/studio')

let resolvedStudioDataDir = ''

export function getStudioDataDir() {
  return resolvedStudioDataDir || PREFERRED_STUDIO_DATA_DIR
}

export function getUserinfoDir() {
  return path.join(getStudioDataDir(), 'userinfo')
}

export function getChannelsFilePath() {
  return path.join(getStudioDataDir(), 'channles.json')
}

export function getDownloadCenterConfigsFilePath() {
  return path.join(getStudioDataDir(), 'download-center-configs.json')
}

export const STUDIO_DATA_DIR = getStudioDataDir
export const USERINFO_DIR = getUserinfoDir
export const CHANNELS_FILE_PATH = getChannelsFilePath
export const DOWNLOAD_CENTER_CONFIGS_FILE_PATH = getDownloadCenterConfigsFilePath

function nowIso() {
  return new Date().toISOString()
}

function normalizeAuthTokens(user = {}) {
  const authTokens = Array.isArray(user.authTokens)
    ? user.authTokens
    : String(user.authToken || '').trim()
      ? [String(user.authToken || '').trim()]
      : []

  return authTokens
    .map(token => String(token || '').trim())
    .filter(Boolean)
    .filter((token, index, list) => list.indexOf(token) === index)
}

function defaultMaterialPreview() {
  return {
    enabled: true,
    intervalMinutes: 20,
    buildTimeWindowStart: 90,
    buildTimeWindowEnd: 20,
  }
}

function defaultFeishuConfig() {
  return {
    dramaListTableId: '',
    dramaStatusTableId: '',
    accountTableId: '',
  }
}

function defaultOrderUserStats() {
  return {
    enabled: false,
    sortMode: 'manual',
    usernames: [],
  }
}

function defaultIndependentOrderStats() {
  return {
    enabled: false,
  }
}

function defaultDouyinAccount() {
  return {
    id: crypto.randomUUID(),
    douyinAccount: '',
    douyinAccountId: '',
    cooperationCode: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

function defaultUserChannelConfig() {
  return {
    enabled: false,
    feishu: defaultFeishuConfig(),
    materialPreview: defaultMaterialPreview(),
    permissions: {
      syncAccount: false,
      webMenus: {
        overview: true,
        report: true,
      },
      desktopMenus: {
        download: false,
        materialClip: false,
        upload: false,
        juliangUpload: false,
        uploadBuild: false,
        juliangBuild: false,
      },
    },
    orderUserStats: defaultOrderUserStats(),
    independentOrderStats: defaultIndependentOrderStats(),
    douyinMaterialMatches: [],
  }
}

function defaultChannelConfig() {
  return {
    id: crypto.randomUUID(),
    name: '',
    juliang: {
      cookie: '',
      buildConfig: normalizeBuildConfig(DEFAULT_BUILD_CONFIG),
    },
    changdu: {
      secretKey: '',
      cookie: '',
      distributorId: '',
      adUserId: '',
      rootAdUserId: '',
      appId: '',
    },
    adx: {
      cookie: '',
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

function defaultDownloadCenterConfig() {
  return {
    id: crypto.randomUUID(),
    name: '',
    owner: '',
    secretKey: '',
    appId: '',
    cookie: '',
    distributorId: '',
    adUserId: '',
    rootAdUserId: '',
    isDefault: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

function createDefaultUserBase() {
  return {
    id: '',
    nickname: '',
    account: '',
    brandName: '小红',
    password: '',
    authTokens: [],
    userType: 'normal',
    channelIds: [],
    defaultChannelId: '',
    channelConfigs: {},
    douyinAccounts: [],
    feishu: defaultFeishuConfig(),
    materialPreview: defaultMaterialPreview(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

function buildDouyinAccountIdentity(account = {}) {
  return `${String(account.douyinAccount || '').trim()}::${String(account.douyinAccountId || '').trim()}`
}

export function normalizeDouyinAccount(account = {}) {
  const base = defaultDouyinAccount()

  return {
    id: String(account.id || base.id),
    douyinAccount: String(account.douyinAccount || '').trim(),
    douyinAccountId: String(account.douyinAccountId || '').trim(),
    cooperationCode: String(account.cooperationCode || '').trim(),
    createdAt: account.createdAt || base.createdAt,
    updatedAt: account.updatedAt || nowIso(),
  }
}

function collectLegacyDouyinAccounts(user = {}) {
  const collected = []
  const pushMatchAsAccount = match => {
    if (!match || typeof match !== 'object') {
      return
    }

    const douyinAccount = String(match.douyinAccount || '').trim()
    const douyinAccountId = String(match.douyinAccountId || '').trim()
    const cooperationCode = String(match.cooperationCode || '').trim()

    if (!douyinAccount && !douyinAccountId && !cooperationCode) {
      return
    }

    collected.push({
      douyinAccount,
      douyinAccountId,
      cooperationCode,
    })
  }

  const rawChannelConfigs =
    user.channelConfigs && typeof user.channelConfigs === 'object' ? user.channelConfigs : {}

  Object.values(rawChannelConfigs).forEach(channelConfig => {
    if (Array.isArray(channelConfig?.douyinMaterialMatches)) {
      channelConfig.douyinMaterialMatches.forEach(pushMatchAsAccount)
    }
  })

  if (Array.isArray(user.douyinMaterialMatches)) {
    user.douyinMaterialMatches.forEach(pushMatchAsAccount)
  }

  return collected
}

function normalizeDouyinAccounts(accounts = []) {
  if (!Array.isArray(accounts)) {
    return []
  }

  const normalizedAccounts = []
  const identityMap = new Map()

  accounts.forEach(account => {
    const normalizedAccount = normalizeDouyinAccount(account)
    if (
      !normalizedAccount.douyinAccount &&
      !normalizedAccount.douyinAccountId &&
      !normalizedAccount.cooperationCode
    ) {
      return
    }

    const identity = buildDouyinAccountIdentity(normalizedAccount)
    if (identity && identity !== '::' && identityMap.has(identity)) {
      const existingAccount = identityMap.get(identity)
      existingAccount.douyinAccount =
        existingAccount.douyinAccount || normalizedAccount.douyinAccount
      existingAccount.douyinAccountId =
        existingAccount.douyinAccountId || normalizedAccount.douyinAccountId
      existingAccount.cooperationCode =
        existingAccount.cooperationCode || normalizedAccount.cooperationCode
      existingAccount.updatedAt = normalizedAccount.updatedAt || existingAccount.updatedAt
      return
    }

    const nextAccount = { ...normalizedAccount }
    normalizedAccounts.push(nextAccount)
    if (identity && identity !== '::') {
      identityMap.set(identity, nextAccount)
    }
  })

  return normalizedAccounts
}

function getNormalizedUserDouyinAccounts(user = {}) {
  return normalizeDouyinAccounts([
    ...(Array.isArray(user.douyinAccounts) ? user.douyinAccounts : []),
    ...collectLegacyDouyinAccounts(user),
  ])
}

function findMatchingDouyinAccount(match = {}, douyinAccounts = []) {
  const normalizedDouyinAccount = String(match.douyinAccount || '').trim()
  const normalizedDouyinAccountId = String(match.douyinAccountId || '').trim()

  if (normalizedDouyinAccount && normalizedDouyinAccountId) {
    const exactMatchedAccount = douyinAccounts.find(
      account =>
        account.douyinAccount === normalizedDouyinAccount &&
        account.douyinAccountId === normalizedDouyinAccountId
    )
    if (exactMatchedAccount) {
      return exactMatchedAccount
    }
  }

  if (normalizedDouyinAccountId) {
    const matchedById = douyinAccounts.find(
      account => account.douyinAccountId === normalizedDouyinAccountId
    )
    if (matchedById) {
      return matchedById
    }
  }

  if (normalizedDouyinAccount) {
    return douyinAccounts.find(account => account.douyinAccount === normalizedDouyinAccount) || null
  }

  return null
}

function resolveDouyinAccountRefId(match = {}, douyinAccounts = []) {
  const douyinAccountRefId = String(match.douyinAccountRefId || '').trim()

  if (douyinAccountRefId && douyinAccounts.some(account => account.id === douyinAccountRefId)) {
    return douyinAccountRefId
  }

  return findMatchingDouyinAccount(match, douyinAccounts)?.id || ''
}

export function normalizeDouyinMaterialMatch(match = {}, douyinAccounts = []) {
  return {
    id: String(match.id || crypto.randomUUID()),
    douyinAccountRefId: resolveDouyinAccountRefId(match, douyinAccounts),
    materialRange: String(match.materialRange || '').trim(),
    createdAt: match.createdAt || nowIso(),
    updatedAt: match.updatedAt || nowIso(),
  }
}

export function resolveDouyinMaterialMatches(matches = [], douyinAccounts = []) {
  const normalizedDouyinAccounts = normalizeDouyinAccounts(douyinAccounts)
  const douyinAccountMap = new Map(normalizedDouyinAccounts.map(account => [account.id, account]))

  return normalizeDouyinMaterialMatches(matches, normalizedDouyinAccounts)
    .map(match => {
      const relatedDouyinAccount = douyinAccountMap.get(match.douyinAccountRefId)
      if (!relatedDouyinAccount) {
        return null
      }

      return {
        ...match,
        douyinAccount: relatedDouyinAccount.douyinAccount,
        douyinAccountId: relatedDouyinAccount.douyinAccountId,
        cooperationCode: relatedDouyinAccount.cooperationCode,
      }
    })
    .filter(match => match && match.douyinAccount && match.douyinAccountId && match.materialRange)
}

export function normalizeDownloadCenterConfig(config = {}) {
  const base = defaultDownloadCenterConfig()
  return {
    id: String(config.id || base.id),
    name: String(config.name || '').trim(),
    owner: String(config.owner || '').trim(),
    secretKey: String(config.secretKey || '').trim(),
    appId: String(config.appId || '').trim(),
    cookie: String(config.cookie || '').trim(),
    distributorId: String(config.distributorId || '').trim(),
    adUserId: String(config.adUserId || '').trim(),
    rootAdUserId: String(config.rootAdUserId || '').trim(),
    isDefault: Boolean(config.isDefault),
    createdAt: config.createdAt || base.createdAt,
    updatedAt: config.updatedAt || nowIso(),
  }
}

function normalizeDownloadCenterConfigs(configs = []) {
  if (!Array.isArray(configs)) {
    return []
  }

  const normalizedConfigs = configs
    .map(normalizeDownloadCenterConfig)
    .filter(
      config => config.name || config.owner || config.cookie || config.secretKey || config.appId
    )

  if (normalizedConfigs.length === 0) {
    return []
  }

  const firstDefaultIndex = normalizedConfigs.findIndex(config => config.isDefault)
  const defaultIndex = firstDefaultIndex >= 0 ? firstDefaultIndex : 0

  return normalizedConfigs.map((config, index) => ({
    ...config,
    isDefault: index === defaultIndex,
  }))
}

function normalizeDouyinMaterialMatches(matches = [], douyinAccounts = []) {
  if (!Array.isArray(matches)) {
    return []
  }

  return matches
    .map(match => normalizeDouyinMaterialMatch(match, douyinAccounts))
    .filter(match => match.douyinAccountRefId && match.materialRange)
}

function normalizeOrderUserStats(config = {}) {
  const usernames = Array.isArray(config?.usernames)
    ? config.usernames
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
    : []

  return {
    enabled: Boolean(config?.enabled),
    sortMode: config?.sortMode === 'amount_desc' ? 'amount_desc' : 'manual',
    usernames,
  }
}

function normalizeFeishuConfig(feishu = {}) {
  return {
    dramaListTableId: String(feishu?.dramaListTableId || '').trim(),
    dramaStatusTableId: String(feishu?.dramaStatusTableId || '').trim(),
    accountTableId: String(feishu?.accountTableId || '').trim(),
  }
}

function normalizeUserChannelConfig(config = {}, douyinAccounts = []) {
  const resolvedEnabled =
    typeof config.enabled === 'boolean'
      ? config.enabled
      : hasCustomUserChannelConfig(config, douyinAccounts)
  const defaultConfig = defaultUserChannelConfig()

  return {
    enabled: resolvedEnabled,
    feishu: normalizeFeishuConfig(config.feishu || config),
    materialPreview: {
      ...defaultMaterialPreview(),
      ...(config.materialPreview || {}),
      enabled: Boolean(config.materialPreview?.enabled),
    },
    permissions: {
      syncAccount: Boolean(config.permissions?.syncAccount),
      webMenus: {
        overview:
          typeof config.permissions?.webMenus?.overview === 'boolean'
            ? config.permissions.webMenus.overview
            : defaultConfig.permissions.webMenus.overview,
        report:
          typeof config.permissions?.webMenus?.report === 'boolean'
            ? config.permissions.webMenus.report
            : defaultConfig.permissions.webMenus.report,
      },
      desktopMenus: {
        download: Boolean(config.permissions?.desktopMenus?.download),
        materialClip: Boolean(config.permissions?.desktopMenus?.materialClip),
        upload: Boolean(config.permissions?.desktopMenus?.upload),
        juliangUpload: Boolean(config.permissions?.desktopMenus?.juliangUpload),
        uploadBuild: Boolean(config.permissions?.desktopMenus?.uploadBuild),
        juliangBuild: Boolean(config.permissions?.desktopMenus?.juliangBuild),
      },
    },
    orderUserStats: {
      ...defaultOrderUserStats(),
      ...normalizeOrderUserStats(config.orderUserStats),
    },
    independentOrderStats: {
      ...defaultIndependentOrderStats(),
      ...(config.independentOrderStats || {}),
      enabled: Boolean(config.independentOrderStats?.enabled),
    },
    douyinMaterialMatches: normalizeDouyinMaterialMatches(
      config.douyinMaterialMatches,
      douyinAccounts
    ),
  }
}

function hasCustomUserChannelConfig(config = {}, douyinAccounts = []) {
  if (!config || typeof config !== 'object') {
    return false
  }

  const hasExplicitMaterialPreview =
    config.materialPreview &&
    typeof config.materialPreview === 'object' &&
    Object.keys(config.materialPreview).length > 0
  const hasExplicitWebPermissionConfig =
    typeof config.permissions?.webMenus?.overview === 'boolean' ||
    typeof config.permissions?.webMenus?.report === 'boolean'
  const hasPermissionConfig =
    Boolean(config.permissions?.syncAccount) ||
    Object.values(config.permissions?.desktopMenus || {}).some(Boolean)
  const hasOrderUserStats =
    Boolean(config.orderUserStats?.enabled) ||
    (Array.isArray(config.orderUserStats?.usernames) && config.orderUserStats.usernames.length > 0)
  const hasIndependentOrderStats = Boolean(config.independentOrderStats?.enabled)

  return (
    hasFeishuConfig(normalizeFeishuConfig(config.feishu || config)) ||
    hasExplicitMaterialPreview ||
    hasExplicitWebPermissionConfig ||
    hasPermissionConfig ||
    hasOrderUserStats ||
    hasIndependentOrderStats ||
    normalizeDouyinMaterialMatches(config.douyinMaterialMatches, douyinAccounts).length > 0
  )
}

function hasFeishuConfig(feishu = {}) {
  return Boolean(feishu.dramaListTableId || feishu.dramaStatusTableId || feishu.accountTableId)
}

function normalizeUserChannelConfigs(
  user = {},
  channelIds = [],
  defaultChannelId = '',
  douyinAccounts = []
) {
  const rawChannelConfigs =
    user.channelConfigs && typeof user.channelConfigs === 'object' ? user.channelConfigs : {}
  const normalizedConfigs = {}

  channelIds.forEach(channelId => {
    normalizedConfigs[channelId] = normalizeUserChannelConfig(
      rawChannelConfigs[channelId] || {},
      douyinAccounts
    )
  })

  const legacyFeishuConfig = normalizeFeishuConfig(user.feishu || {})
  const legacyMaterialPreview = {
    ...defaultMaterialPreview(),
    ...(user.materialPreview || {}),
    enabled: Boolean(user.materialPreview?.enabled),
  }
  const legacyDouyinMaterialMatches = normalizeDouyinMaterialMatches(
    user.douyinMaterialMatches,
    douyinAccounts
  )
  const legacyChannelId = defaultChannelId || channelIds[0] || ''
  if (legacyChannelId && hasFeishuConfig(legacyFeishuConfig)) {
    normalizedConfigs[legacyChannelId] = {
      ...defaultUserChannelConfig(),
      ...(normalizedConfigs[legacyChannelId] || {}),
      feishu:
        normalizedConfigs[legacyChannelId] &&
        hasFeishuConfig(normalizedConfigs[legacyChannelId].feishu)
          ? normalizedConfigs[legacyChannelId].feishu
          : legacyFeishuConfig,
    }
  }

  if (
    legacyChannelId &&
    user.materialPreview &&
    !rawChannelConfigs[legacyChannelId]?.materialPreview
  ) {
    normalizedConfigs[legacyChannelId] = {
      ...defaultUserChannelConfig(),
      ...(normalizedConfigs[legacyChannelId] || {}),
      materialPreview: {
        ...defaultMaterialPreview(),
        ...(normalizedConfigs[legacyChannelId]?.materialPreview || {}),
        ...legacyMaterialPreview,
      },
    }
  }

  if (
    legacyChannelId &&
    legacyDouyinMaterialMatches.length > 0 &&
    (!normalizedConfigs[legacyChannelId] ||
      !Array.isArray(normalizedConfigs[legacyChannelId].douyinMaterialMatches) ||
      normalizedConfigs[legacyChannelId].douyinMaterialMatches.length === 0)
  ) {
    normalizedConfigs[legacyChannelId] = {
      ...defaultUserChannelConfig(),
      ...(normalizedConfigs[legacyChannelId] || {}),
      douyinMaterialMatches: legacyDouyinMaterialMatches,
    }
  }

  return normalizedConfigs
}

export function getUserChannelConfig(user = {}, channelId = '') {
  const normalizedChannelId = String(channelId || '').trim()
  const rawChannelIds = Array.isArray(user.channelIds)
    ? user.channelIds
    : user.channelId
      ? [user.channelId]
      : []
  const channelIds = rawChannelIds.map(item => String(item || '').trim()).filter(Boolean)
  const defaultChannelId = String(user.defaultChannelId || user.channelId || '').trim()
  const douyinAccounts = getNormalizedUserDouyinAccounts(user)
  const normalizedConfigs = normalizeUserChannelConfigs(
    user,
    channelIds,
    defaultChannelId,
    douyinAccounts
  )
  const targetChannelId = normalizedChannelId || defaultChannelId || channelIds[0] || ''

  if (targetChannelId && normalizedConfigs[targetChannelId]) {
    return normalizedConfigs[targetChannelId]
  }

  return defaultUserChannelConfig()
}

export function ensureUserChannelConfig(user = {}, channelId = '') {
  const normalizedChannelId = String(channelId || '').trim()
  if (!normalizedChannelId) {
    return defaultUserChannelConfig()
  }

  if (!user.channelConfigs || typeof user.channelConfigs !== 'object') {
    user.channelConfigs = {}
  }

  const douyinAccounts = getNormalizedUserDouyinAccounts(user)
  user.channelConfigs[normalizedChannelId] = normalizeUserChannelConfig(
    user.channelConfigs[normalizedChannelId] || {},
    douyinAccounts
  )

  return user.channelConfigs[normalizedChannelId]
}

function getDefaultRuntimeFeishu(user = {}, defaultChannelId = '') {
  return getRuntimeUserChannelConfig(user, defaultChannelId).feishu
}

function getDefaultRuntimeMaterialPreview(user = {}, defaultChannelId = '') {
  return getRuntimeUserChannelConfig(user, defaultChannelId).materialPreview
}

function getReadonlyChannelRuntimeConfig() {
  return {
    ...defaultUserChannelConfig(),
    enabled: false,
    materialPreview: {
      ...defaultMaterialPreview(),
      enabled: false,
    },
  }
}

function getRuntimeUserChannelConfig(user = {}, channelId = '') {
  const channelConfig = getUserChannelConfig(user, channelId)

  if (channelConfig.enabled) {
    return channelConfig
  }

  return getReadonlyChannelRuntimeConfig()
}

export function buildRuntimeUser(user = {}, channelId = '') {
  const normalizedUser = normalizeUser(user)
  const sourceChannelConfig = getUserChannelConfig(normalizedUser, channelId)
  const channelConfig = getRuntimeUserChannelConfig(normalizedUser, channelId)
  const douyinMaterialMatches = resolveDouyinMaterialMatches(
    channelConfig.douyinMaterialMatches,
    normalizedUser.douyinAccounts
  )

  return {
    ...normalizedUser,
    feishu: channelConfig.feishu,
    materialPreview: channelConfig.materialPreview,
    permissions: channelConfig.permissions,
    orderUserStats: channelConfig.orderUserStats,
    independentOrderStats: channelConfig.independentOrderStats,
    douyinMaterialMatches,
    channelConfigEnabled: Boolean(sourceChannelConfig.enabled),
  }
}

export function normalizeUser(user = {}) {
  const base = createDefaultUserBase()
  const rawChannelIds = Array.isArray(user.channelIds)
    ? user.channelIds
    : user.channelId
      ? [user.channelId]
      : []
  const channelIds = rawChannelIds.map(item => String(item || '').trim()).filter(Boolean)
  const defaultChannelId = String(user.defaultChannelId || user.channelId || '').trim()
  const resolvedDefaultChannelId = channelIds.includes(defaultChannelId)
    ? defaultChannelId
    : channelIds[0] || ''
  const douyinAccounts = getNormalizedUserDouyinAccounts(user)
  const channelConfigs = normalizeUserChannelConfigs(
    user,
    channelIds,
    resolvedDefaultChannelId,
    douyinAccounts
  )
  const defaultRuntimeFeishu = getDefaultRuntimeFeishu(
    {
      ...user,
      channelIds,
      defaultChannelId: resolvedDefaultChannelId,
      channelConfigs,
      douyinAccounts,
    },
    resolvedDefaultChannelId
  )
  const defaultRuntimeMaterialPreview = getDefaultRuntimeMaterialPreview(
    {
      ...user,
      channelIds,
      defaultChannelId: resolvedDefaultChannelId,
      channelConfigs,
      douyinAccounts,
    },
    resolvedDefaultChannelId
  )

  return {
    id: String(user.id || crypto.randomUUID()),
    nickname: String(user.nickname || '').trim(),
    account: String(user.account || '').trim(),
    brandName: String(user.brandName || base.brandName || '小红').trim() || '小红',
    password: String(user.password || '').trim(),
    authTokens: normalizeAuthTokens(user),
    userType: user.userType === 'admin' ? 'admin' : 'normal',
    channelIds,
    defaultChannelId: resolvedDefaultChannelId,
    channelConfigs,
    douyinAccounts,
    feishu: defaultRuntimeFeishu,
    materialPreview: defaultRuntimeMaterialPreview,
    createdAt: user.createdAt || base.createdAt,
    updatedAt: user.updatedAt || nowIso(),
  }
}

export function normalizeChannel(channel = {}) {
  const base = defaultChannelConfig()
  const rawJuliang = channel.juliang || {}
  const normalizedBuildConfig = normalizeBuildConfig(
    rawJuliang.buildConfig || base.juliang.buildConfig
  )
  const secretKey = String(
    channel.changdu?.secretKey || normalizedBuildConfig.secretKey || base.changdu.secretKey
  ).trim()

  return {
    id: String(channel.id || base.id),
    name: String(channel.name || '').trim(),
    juliang: {
      cookie: String(rawJuliang.cookie || '').trim(),
      buildConfig: {
        ...normalizedBuildConfig,
        secretKey,
      },
    },
    changdu: {
      secretKey,
      cookie: String(channel.changdu?.cookie || '').trim(),
      distributorId: String(channel.changdu?.distributorId || '').trim(),
      adUserId: String(channel.changdu?.adUserId || '').trim(),
      rootAdUserId: String(channel.changdu?.rootAdUserId || '').trim(),
      appId: String(channel.changdu?.appId || '').trim(),
    },
    adx: {
      cookie: String(channel.adx?.cookie || '').trim(),
    },
    createdAt: channel.createdAt || base.createdAt,
    updatedAt: channel.updatedAt || nowIso(),
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function ensureStudioData() {
  if (!resolvedStudioDataDir) {
    try {
      await ensureDir(PREFERRED_STUDIO_DATA_DIR)
      resolvedStudioDataDir = PREFERRED_STUDIO_DATA_DIR
    } catch (error) {
      console.warn(
        `[StudioData] 无法写入 ${PREFERRED_STUDIO_DATA_DIR}，已降级到 ${FALLBACK_STUDIO_DATA_DIR}:`,
        error.message
      )
      await ensureDir(FALLBACK_STUDIO_DATA_DIR)
      resolvedStudioDataDir = FALLBACK_STUDIO_DATA_DIR
    }
  }

  await ensureDir(getStudioDataDir())
  await ensureDir(getUserinfoDir())

  try {
    await fs.access(getChannelsFilePath())
  } catch {
    await fs.writeFile(
      getChannelsFilePath(),
      JSON.stringify({ channels: [], updatedAt: nowIso() }, null, 2),
      'utf-8'
    )
  }

  try {
    await fs.access(getDownloadCenterConfigsFilePath())
  } catch {
    await fs.writeFile(
      getDownloadCenterConfigsFilePath(),
      JSON.stringify({ configs: [], updatedAt: nowIso() }, null, 2),
      'utf-8'
    )
  }
}

export async function readChannels() {
  await ensureStudioData()
  const raw = await fs.readFile(getChannelsFilePath(), 'utf-8')
  const parsed = JSON.parse(raw)
  const channels = Array.isArray(parsed.channels) ? parsed.channels.map(normalizeChannel) : []
  return { channels, updatedAt: parsed.updatedAt || nowIso() }
}

export async function writeChannels(channels) {
  await ensureStudioData()
  const normalizedChannels = channels.map(normalizeChannel)
  const payload = {
    channels: normalizedChannels,
    updatedAt: nowIso(),
  }
  await fs.writeFile(getChannelsFilePath(), JSON.stringify(payload, null, 2), 'utf-8')
  return payload
}

export async function readDownloadCenterConfigs() {
  await ensureStudioData()
  const raw = await fs.readFile(getDownloadCenterConfigsFilePath(), 'utf-8')
  const parsed = JSON.parse(raw)
  const configs = normalizeDownloadCenterConfigs(parsed.configs)
  return {
    configs,
    updatedAt: parsed.updatedAt || nowIso(),
  }
}

export async function writeDownloadCenterConfigs(configs) {
  await ensureStudioData()
  const normalizedConfigs = normalizeDownloadCenterConfigs(configs)
  const payload = {
    configs: normalizedConfigs,
    updatedAt: nowIso(),
  }
  await fs.writeFile(getDownloadCenterConfigsFilePath(), JSON.stringify(payload, null, 2), 'utf-8')
  return payload
}

export async function getDefaultDownloadCenterConfig() {
  const { configs } = await readDownloadCenterConfigs()
  return configs.find(config => config.isDefault) || null
}

export async function listUsers() {
  await ensureStudioData()
  const files = await fs.readdir(getUserinfoDir())
  const users = []

  for (const fileName of files) {
    if (!fileName.endsWith('.json')) continue
    const filePath = path.join(getUserinfoDir(), fileName)
    const raw = await fs.readFile(filePath, 'utf-8')
    users.push(normalizeUser(JSON.parse(raw)))
  }

  return users.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function readUser(userId) {
  await ensureStudioData()
  const filePath = path.join(getUserinfoDir(), `${userId}.json`)
  const raw = await fs.readFile(filePath, 'utf-8')
  return normalizeUser(JSON.parse(raw))
}

export async function writeUser(user) {
  await ensureStudioData()
  const normalizedUser = normalizeUser(user)
  const filePath = path.join(getUserinfoDir(), `${normalizedUser.id}.json`)
  await fs.writeFile(filePath, JSON.stringify(normalizedUser, null, 2), 'utf-8')
  return normalizedUser
}

export async function deleteUser(userId) {
  const filePath = path.join(getUserinfoDir(), `${userId}.json`)
  await fs.unlink(filePath)
}

export function sanitizeUser(user) {
  const rest = { ...user }
  delete rest.password
  delete rest.authTokens
  delete rest.authToken
  return rest
}

export async function findUserByAccount(account) {
  const users = await listUsers()
  return users.find(user => user.account === account) || null
}

export async function findUserByToken(token) {
  if (!token) return null
  const users = await listUsers()
  return (
    users.find(user => Array.isArray(user.authTokens) && user.authTokens.includes(token)) || null
  )
}

export async function resolveUserChannel(user) {
  if (!user?.defaultChannelId) {
    return null
  }

  const { channels } = await readChannels()
  return channels.find(channel => channel.id === user.defaultChannelId) || null
}

export async function findUsersByChannelId(channelId) {
  if (!channelId) return []
  const users = await listUsers()
  return users.filter(user =>
    Array.isArray(user.channelIds)
      ? user.channelIds.includes(channelId)
      : user.channelId === channelId
  )
}

export async function resolveRuntimeContext(sessionUser, requestedChannelId = '') {
  const { channels } = await readChannels()

  if (!sessionUser) {
    return {
      channel: null,
      runtimeUser: null,
    }
  }

  const accessibleChannelIds = Array.isArray(sessionUser.channelIds)
    ? sessionUser.channelIds
    : sessionUser.channelId
      ? [sessionUser.channelId]
      : []
  const availableChannels = channels.filter(item => accessibleChannelIds.includes(item.id))
  const channel =
    availableChannels.find(item => item.id === requestedChannelId) ||
    availableChannels.find(item => item.id === sessionUser.defaultChannelId) ||
    availableChannels[0] ||
    null

  if (!channel) {
    return {
      channel: null,
      runtimeUser: buildRuntimeUser(sessionUser),
      availableChannels: [],
    }
  }

  return {
    channel,
    runtimeUser: buildRuntimeUser(sessionUser, channel.id),
    availableChannels,
  }
}
