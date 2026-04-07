import { ENV } from '@/config/env'
import { buildSessionHeaders } from '@/utils/sessionToken'

export interface BuildConfig {
  secretKey: string
  source: string
  productId: string
  productPlatformId: string
  landingUrl: string
  useNewMicroAppAssetFlow: boolean
  clearExistingProjectsBeforeBuild: boolean
  recycleAccountsWhenExhausted: boolean
  advertiserName: string
  ebpid: string
  microAppName: string
  microAppId: string
  microAppInstanceId: string
  ccId: string
  rechargeTemplateId: string
  adCallbackConfigId: string
  forbiddenAdvanceStartHour: string
  forbiddenAdvanceEndHour: string
  advanceBuildHours: string
}

type BuildConfigResponse = {
  code?: number
  data?: unknown
  message?: string
  error?: string
}

export const DEFAULT_BUILD_CONFIG: BuildConfig = {
  secretKey: '',
  source: '',
  productId: '',
  productPlatformId: '',
  landingUrl: '',
  useNewMicroAppAssetFlow: false,
  clearExistingProjectsBeforeBuild: false,
  recycleAccountsWhenExhausted: false,
  advertiserName: '',
  ebpid: '',
  microAppName: '',
  microAppId: '',
  microAppInstanceId: '',
  ccId: '',
  rechargeTemplateId: '',
  adCallbackConfigId: '',
  forbiddenAdvanceStartHour: '0',
  forbiddenAdvanceEndHour: '0',
  advanceBuildHours: '0',
}

function normalizeStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeBooleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeBuildConfig(payload: unknown): BuildConfig {
  const source =
    payload && typeof payload === 'object' && 'buildConfig' in payload
      ? (payload as { buildConfig?: unknown }).buildConfig
      : payload

  const config = (source ?? {}) as Partial<BuildConfig>

  return {
    secretKey: normalizeStringValue(config.secretKey),
    source: normalizeStringValue(config.source),
    productId: normalizeStringValue(config.productId),
    productPlatformId: normalizeStringValue(config.productPlatformId),
    landingUrl: normalizeStringValue(config.landingUrl),
    useNewMicroAppAssetFlow: normalizeBooleanValue(config.useNewMicroAppAssetFlow),
    clearExistingProjectsBeforeBuild: normalizeBooleanValue(
      config.clearExistingProjectsBeforeBuild
    ),
    recycleAccountsWhenExhausted: normalizeBooleanValue(config.recycleAccountsWhenExhausted),
    advertiserName: normalizeStringValue(config.advertiserName),
    ebpid: normalizeStringValue(config.ebpid),
    microAppName: normalizeStringValue(config.microAppName),
    microAppId: normalizeStringValue(config.microAppId),
    microAppInstanceId: normalizeStringValue(config.microAppInstanceId),
    ccId: normalizeStringValue(config.ccId),
    rechargeTemplateId: normalizeStringValue(config.rechargeTemplateId),
    adCallbackConfigId: normalizeStringValue(config.adCallbackConfigId),
    forbiddenAdvanceStartHour: normalizeStringValue(config.forbiddenAdvanceStartHour, '0'),
    forbiddenAdvanceEndHour: normalizeStringValue(config.forbiddenAdvanceEndHour, '0'),
    advanceBuildHours: normalizeStringValue(config.advanceBuildHours, '0'),
  }
}

function getResponseErrorMessage(result: BuildConfigResponse, fallback: string) {
  return result.message || result.error || fallback
}

export async function getBuildConfig(): Promise<BuildConfig> {
  const response = await fetch(`${ENV.BASE_URL}/build-config`, {
    headers: buildSessionHeaders(),
  })

  if (!response.ok) {
    throw new Error(`加载搭建参数配置失败: ${response.statusText}`)
  }

  const result = (await response.json()) as BuildConfigResponse | BuildConfig

  if ('code' in result && result.code !== undefined && result.code !== 0 && result.code !== 200) {
    throw new Error(getResponseErrorMessage(result, '加载搭建参数配置失败'))
  }

  const payload = 'data' in result ? result.data : result
  return normalizeBuildConfig(payload)
}

export async function updateBuildConfig(config: BuildConfig): Promise<void> {
  const response = await fetch(`${ENV.BASE_URL}/build-config`, {
    method: 'PUT',
    headers: buildSessionHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(config),
  })

  if (!response.ok) {
    throw new Error(`保存搭建参数配置失败: ${response.statusText}`)
  }

  const result = (await response.json()) as BuildConfigResponse

  if (result.code !== undefined && result.code !== 0 && result.code !== 200) {
    throw new Error(getResponseErrorMessage(result, '保存搭建参数配置失败'))
  }
}
