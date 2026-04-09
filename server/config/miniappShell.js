import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PREFERRED_MINIAPP_SHELL_FILE_PATH =
  process.env.MINIAPP_SHELL_FILE_PATH || '/data/changdu-web/miniapp-shell.json'
const FALLBACK_MINIAPP_SHELL_FILE_PATH = path.join(__dirname, '../data/miniapp-shell.json')

let resolvedMiniAppShellFilePath = ''

function clonePlainData(data) {
  return JSON.parse(JSON.stringify(data || {}))
}

async function resolveMiniAppShellFilePath() {
  if (resolvedMiniAppShellFilePath) {
    return resolvedMiniAppShellFilePath
  }

  try {
    await fs.access(PREFERRED_MINIAPP_SHELL_FILE_PATH)
    resolvedMiniAppShellFilePath = PREFERRED_MINIAPP_SHELL_FILE_PATH
  } catch {
    resolvedMiniAppShellFilePath = FALLBACK_MINIAPP_SHELL_FILE_PATH
  }

  return resolvedMiniAppShellFilePath
}

async function readMiniAppShellConfig() {
  const filePath = await resolveMiniAppShellFilePath()
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw)
}

function applyAppId(data, appId) {
  const nextData = clonePlainData(data)
  nextData.app_id = appId
  return nextData
}

async function getMiniAppShellId() {
  const config = await readMiniAppShellConfig()
  return String(config.shell_id || '').trim()
}

async function buildBootstrapData(appId) {
  const config = await readMiniAppShellConfig()
  return applyAppId(config.bootstrap, appId)
}

async function buildLayoutData(appId) {
  const config = await readMiniAppShellConfig()
  return applyAppId(config.layout, appId)
}

export {
  PREFERRED_MINIAPP_SHELL_FILE_PATH,
  FALLBACK_MINIAPP_SHELL_FILE_PATH,
  resolveMiniAppShellFilePath,
  readMiniAppShellConfig,
  getMiniAppShellId,
  buildBootstrapData,
  buildLayoutData,
}
