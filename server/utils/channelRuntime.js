import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'
import { getSessionUser } from './studioSession.js'
import { readChannels, resolveRuntimeContext } from './studioData.js'
import { CHANGDU_DISTRIBUTOR_ID, CHANGDU_SECRET_KEY } from '../config/changdu.js'

const DEFAULT_APP_TYPE = '7'
const DEFAULT_AGW_JS_CONV = 'str'
const DEFAULT_CHANGDU_APP_ID = '40011566'

export function extractCsrfToken(cookie = '') {
  const match = String(cookie || '').match(/(?:^|;\s*)csrftoken=([^;]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function buildRuntimeFromChannel(channel = null) {
  const buildConfig = normalizeBuildConfig(channel?.juliang?.buildConfig || DEFAULT_BUILD_CONFIG)
  const juliangCookie = String(channel?.juliang?.cookie || '').trim()
  const changduSecretKey = String(
    channel?.changdu?.secretKey || buildConfig.secretKey || CHANGDU_SECRET_KEY
  ).trim()

  return {
    channelId: String(channel?.id || '').trim(),
    channelName: String(channel?.name || '').trim(),
    buildConfig,
    juliang: {
      cookie: juliangCookie,
      csrfToken: extractCsrfToken(juliangCookie),
    },
    changdu: {
      cookie: String(channel?.changdu?.cookie || '').trim(),
      distributorId: String(channel?.changdu?.distributorId || CHANGDU_DISTRIBUTOR_ID).trim(),
      secretKey: changduSecretKey,
      adUserId: String(channel?.changdu?.adUserId || '').trim(),
      rootAdUserId: String(channel?.changdu?.rootAdUserId || '').trim(),
      appId: String(channel?.changdu?.appId || DEFAULT_CHANGDU_APP_ID).trim(),
      appType: DEFAULT_APP_TYPE,
      agwJsConv: DEFAULT_AGW_JS_CONV,
    },
  }
}

export function normalizeChannelRuntime(runtime = {}) {
  if (runtime?.buildConfig && runtime?.juliang && runtime?.changdu) {
    return {
      channelId: String(runtime.channelId || '').trim(),
      channelName: String(runtime.channelName || '').trim(),
      buildConfig: normalizeBuildConfig(runtime.buildConfig),
      juliang: {
        cookie: String(runtime.juliang.cookie || '').trim(),
        csrfToken: String(
          runtime.juliang.csrfToken || extractCsrfToken(runtime.juliang.cookie || '')
        ).trim(),
      },
      changdu: {
        cookie: String(runtime.changdu.cookie || '').trim(),
        distributorId: String(runtime.changdu.distributorId || CHANGDU_DISTRIBUTOR_ID).trim(),
        secretKey: String(
          runtime.changdu.secretKey || runtime.buildConfig.secretKey || CHANGDU_SECRET_KEY
        ).trim(),
        adUserId: String(runtime.changdu.adUserId || '').trim(),
        rootAdUserId: String(runtime.changdu.rootAdUserId || '').trim(),
        appId: String(runtime.changdu.appId || DEFAULT_CHANGDU_APP_ID).trim(),
        appType: String(runtime.changdu.appType || DEFAULT_APP_TYPE).trim(),
        agwJsConv: String(runtime.changdu.agwJsConv || DEFAULT_AGW_JS_CONV).trim(),
      },
    }
  }

  return buildRuntimeFromChannel(runtime?.channel || null)
}

export async function resolveChannelRuntimeById(channelId = '') {
  const normalizedChannelId = String(channelId || '').trim()
  const { channels } = await readChannels()
  const channel = channels.find(item => item.id === normalizedChannelId) || channels[0] || null
  return buildRuntimeFromChannel(channel)
}

export async function resolveChannelRuntime(ctx = null) {
  if (!ctx) {
    return resolveChannelRuntimeById('')
  }

  const requestedChannelId = String(
    ctx.get('x-studio-channel-id') || ctx.request.body?.channelId || ctx.query?.channelId || ''
  ).trim()
  const sessionUser = ctx.state?.sessionUser || (await getSessionUser(ctx))

  if (sessionUser) {
    const { channel } = await resolveRuntimeContext(sessionUser, requestedChannelId)
    return buildRuntimeFromChannel(channel)
  }

  return resolveChannelRuntimeById(requestedChannelId)
}

export function getChannelLabel(runtime = {}) {
  return runtime.channelName || runtime.channelId || '默认渠道'
}
