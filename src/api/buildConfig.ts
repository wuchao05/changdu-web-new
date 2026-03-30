import { ENV } from '@/config/env'
import { buildSessionHeaders } from '@/utils/sessionToken'

export interface BuildConfig {
  secretKey: string
  source: string
  productId: string
  productPlatformId: string
  landingUrl: string
  microAppName: string
  microAppId: string
  ccId: string
  rechargeTemplateId: string
  adCallbackConfigId: string
  advanceHoursAfterTen: string
  advanceHoursBeforeTen: string
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
  microAppName: '',
  microAppId: '',
  ccId: '',
  rechargeTemplateId: '',
  adCallbackConfigId: '',
  advanceHoursAfterTen: '0',
  advanceHoursBeforeTen: '0',
}

function normalizeStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
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
    microAppName: normalizeStringValue(config.microAppName),
    microAppId: normalizeStringValue(config.microAppId),
    ccId: normalizeStringValue(config.ccId),
    rechargeTemplateId: normalizeStringValue(config.rechargeTemplateId),
    adCallbackConfigId: normalizeStringValue(config.adCallbackConfigId),
    advanceHoursAfterTen: normalizeStringValue(config.advanceHoursAfterTen, '0'),
    advanceHoursBeforeTen: normalizeStringValue(config.advanceHoursBeforeTen, '0'),
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
