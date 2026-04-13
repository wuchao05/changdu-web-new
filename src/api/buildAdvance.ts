import httpInstance from './http'

export interface BuildAdvanceRuleConfig {
  forbiddenAdvanceStartHour: string
  forbiddenAdvanceEndHour: string
  advanceBuildHours: string
}

export interface BuildAdvanceConfigResponse {
  channelId: string
  channelName: string
  allowCustom: boolean
  useCustom: boolean
  channelDefaultConfig: BuildAdvanceRuleConfig
  userCustomConfig: BuildAdvanceRuleConfig
  effectiveConfig: BuildAdvanceRuleConfig
  effectiveSource: 'channel' | 'user'
}

export function getBuildAdvanceConfig() {
  return httpInstance
    .get('/build-advance/config')
    .then(res => res.data.data as BuildAdvanceConfigResponse)
}

export function updateBuildAdvanceConfig(payload: BuildAdvanceRuleConfig) {
  return httpInstance
    .put('/build-advance/config', payload)
    .then(res => res.data.data as BuildAdvanceConfigResponse)
}

export function resetBuildAdvanceConfig() {
  return httpInstance
    .delete('/build-advance/config')
    .then(res => res.data.data as BuildAdvanceConfigResponse)
}
