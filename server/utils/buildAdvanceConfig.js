import { DEFAULT_BUILD_CONFIG, normalizeBuildConfig } from '../config/buildConfig.js'

export const DEFAULT_USER_BUILD_ADVANCE_CONFIG = {
  allowCustom: false,
  useCustom: false,
  forbiddenAdvanceStartHour: '0',
  forbiddenAdvanceEndHour: '0',
  advanceBuildHours: '0',
}

function normalizeAdvanceHourString(value, fallback = '0') {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  const normalizedValue = Math.trunc(numericValue)
  if (normalizedValue < 0) {
    return '0'
  }
  if (normalizedValue > 24) {
    return '24'
  }
  return String(normalizedValue)
}

function normalizeAdvanceHoursString(value, fallback = '0') {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback
  }
  return String(Math.floor(numericValue))
}

export function normalizeUserBuildAdvanceConfig(config = {}) {
  return {
    allowCustom: Boolean(config?.allowCustom),
    useCustom: Boolean(config?.useCustom),
    forbiddenAdvanceStartHour: normalizeAdvanceHourString(
      config?.forbiddenAdvanceStartHour,
      DEFAULT_USER_BUILD_ADVANCE_CONFIG.forbiddenAdvanceStartHour
    ),
    forbiddenAdvanceEndHour: normalizeAdvanceHourString(
      config?.forbiddenAdvanceEndHour,
      DEFAULT_USER_BUILD_ADVANCE_CONFIG.forbiddenAdvanceEndHour
    ),
    advanceBuildHours: normalizeAdvanceHoursString(
      config?.advanceBuildHours,
      DEFAULT_USER_BUILD_ADVANCE_CONFIG.advanceBuildHours
    ),
  }
}

export function extractBuildAdvanceRuleConfig(buildConfig = {}) {
  const normalizedBuildConfig = normalizeBuildConfig(buildConfig || DEFAULT_BUILD_CONFIG)

  return {
    forbiddenAdvanceStartHour: normalizedBuildConfig.forbiddenAdvanceStartHour,
    forbiddenAdvanceEndHour: normalizedBuildConfig.forbiddenAdvanceEndHour,
    advanceBuildHours: normalizedBuildConfig.advanceBuildHours,
  }
}

export function resolveEffectiveBuildAdvanceRuleConfig(
  channelBuildConfig = {},
  userBuildAdvanceConfig = {}
) {
  const channelRuleConfig = extractBuildAdvanceRuleConfig(channelBuildConfig)
  const normalizedUserConfig = normalizeUserBuildAdvanceConfig(userBuildAdvanceConfig)

  if (!normalizedUserConfig.allowCustom || !normalizedUserConfig.useCustom) {
    return channelRuleConfig
  }

  return {
    forbiddenAdvanceStartHour: normalizedUserConfig.forbiddenAdvanceStartHour,
    forbiddenAdvanceEndHour: normalizedUserConfig.forbiddenAdvanceEndHour,
    advanceBuildHours: normalizedUserConfig.advanceBuildHours,
  }
}

export function applyUserBuildAdvanceToBuildConfig(
  channelBuildConfig = {},
  userBuildAdvanceConfig = {}
) {
  const normalizedBuildConfig = normalizeBuildConfig(channelBuildConfig || DEFAULT_BUILD_CONFIG)
  const effectiveRuleConfig = resolveEffectiveBuildAdvanceRuleConfig(
    normalizedBuildConfig,
    userBuildAdvanceConfig
  )

  return {
    ...normalizedBuildConfig,
    ...effectiveRuleConfig,
  }
}
