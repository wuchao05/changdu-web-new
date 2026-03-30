import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { BUILD_WORKFLOW_CONFIG } from './buildWorkflow.js'
import { CHANGDU_SECRET_KEY } from './changdu.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isProduction = process.env.NODE_ENV === 'production'

export const BUILD_CONFIG_FILE_PATH = isProduction
  ? '/data/changdu-web/build-config.json'
  : path.join(__dirname, '../data/build-config.json')

export const DEFAULT_BUILD_CONFIG = {
  secretKey: CHANGDU_SECRET_KEY,
  source: BUILD_WORKFLOW_CONFIG.build.promotion.source,
  productId: BUILD_WORKFLOW_CONFIG.build.project.product_id,
  productPlatformId: BUILD_WORKFLOW_CONFIG.build.project.product_platform_id,
  landingUrl: BUILD_WORKFLOW_CONFIG.build.promotion.external_url,
  microAppName: BUILD_WORKFLOW_CONFIG.juliang.microAppName,
  microAppId: BUILD_WORKFLOW_CONFIG.juliang.microAppId,
  ccId: '1849832732821859',
  rechargeTemplateId: String(BUILD_WORKFLOW_CONFIG.changdu.rechargeTemplateId),
  adCallbackConfigId: String(BUILD_WORKFLOW_CONFIG.changdu.adCallbackConfigId),
  advanceHoursAfterTen: '0',
  advanceHoursBeforeTen: '0',
}

function normalizeStringValue(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export function normalizeBuildConfig(config = {}) {
  return {
    secretKey: normalizeStringValue(config.secretKey, DEFAULT_BUILD_CONFIG.secretKey),
    source: normalizeStringValue(config.source, DEFAULT_BUILD_CONFIG.source),
    productId: normalizeStringValue(config.productId, DEFAULT_BUILD_CONFIG.productId),
    productPlatformId: normalizeStringValue(
      config.productPlatformId,
      DEFAULT_BUILD_CONFIG.productPlatformId
    ),
    landingUrl: normalizeStringValue(config.landingUrl, DEFAULT_BUILD_CONFIG.landingUrl),
    microAppName: normalizeStringValue(config.microAppName, DEFAULT_BUILD_CONFIG.microAppName),
    microAppId: normalizeStringValue(config.microAppId, DEFAULT_BUILD_CONFIG.microAppId),
    ccId: normalizeStringValue(config.ccId, DEFAULT_BUILD_CONFIG.ccId),
    rechargeTemplateId: normalizeStringValue(
      config.rechargeTemplateId,
      DEFAULT_BUILD_CONFIG.rechargeTemplateId
    ),
    adCallbackConfigId: normalizeStringValue(
      config.adCallbackConfigId,
      DEFAULT_BUILD_CONFIG.adCallbackConfigId
    ),
    advanceHoursAfterTen: normalizeStringValue(
      config.advanceHoursAfterTen,
      DEFAULT_BUILD_CONFIG.advanceHoursAfterTen
    ),
    advanceHoursBeforeTen: normalizeStringValue(
      config.advanceHoursBeforeTen,
      DEFAULT_BUILD_CONFIG.advanceHoursBeforeTen
    ),
  }
}

export async function readBuildConfig() {
  try {
    const data = await fs.readFile(BUILD_CONFIG_FILE_PATH, 'utf-8')
    return normalizeBuildConfig(JSON.parse(data))
  } catch (error) {
    if (error.code === 'ENOENT') {
      const defaultConfig = normalizeBuildConfig(DEFAULT_BUILD_CONFIG)
      await writeBuildConfig(defaultConfig)
      return defaultConfig
    }
    throw error
  }
}

export async function writeBuildConfig(config) {
  const normalizedConfig = normalizeBuildConfig(config)
  const dir = path.dirname(BUILD_CONFIG_FILE_PATH)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(BUILD_CONFIG_FILE_PATH, JSON.stringify(normalizedConfig, null, 2), 'utf-8')
  return normalizedConfig
}
