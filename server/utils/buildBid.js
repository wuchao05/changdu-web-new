const BUILD_BID_PATTERN = /^\d+(\.\d+)?$/

export function normalizeBuildBidValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isValidBuildBidValue(value) {
  const normalizedValue = normalizeBuildBidValue(value)
  return Boolean(normalizedValue) && BUILD_BID_PATTERN.test(normalizedValue)
}

export function toBuildBidNumber(value, fieldLabel = '出价') {
  const normalizedValue = normalizeBuildBidValue(value)
  if (!normalizedValue) {
    throw new Error(`${fieldLabel}不能为空`)
  }
  if (!BUILD_BID_PATTERN.test(normalizedValue)) {
    throw new Error(`${fieldLabel}必须是数字`)
  }

  return Number(normalizedValue)
}

export function validateCustomBidConfig(buildConfig = {}) {
  if (!buildConfig || typeof buildConfig !== 'object') {
    return
  }

  if (!buildConfig.enableCustomBid) {
    return
  }

  try {
    toBuildBidNumber(buildConfig.defaultBid, '默认出价')
  } catch (error) {
    error.status = 400
    throw error
  }
}

export function resolveEffectiveBuildBid(buildConfig = {}, runtimeUser = null) {
  const enabled = Boolean(buildConfig?.enableCustomBid)
  if (!enabled) {
    return {
      enabled: false,
      bid: null,
      bidText: '',
      source: 'disabled',
    }
  }

  const userBid = normalizeBuildBidValue(runtimeUser?.buildPreference?.bid)
  const defaultBid = normalizeBuildBidValue(buildConfig?.defaultBid)
  const resolvedBid = userBid || defaultBid

  return {
    enabled: true,
    bid: toBuildBidNumber(resolvedBid, userBid ? '用户出价' : '默认出价'),
    bidText: resolvedBid,
    source: userBid ? 'user' : 'channel',
  }
}
