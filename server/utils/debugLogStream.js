import { inspect } from 'node:util'

const MAX_LOG_ENTRIES = 5000
const SUPPORTED_LEVELS = ['log', 'info', 'warn', 'error']
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g

const logEntries = []
const listeners = new Set()
const originalConsole = new Map()

let installed = false
let sequence = 0

function normalizeLimit(limit) {
  if (!Number.isFinite(limit)) {
    return 200
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LOG_ENTRIES)
}

function serializeArg(arg) {
  if (typeof arg === 'string') {
    return arg
  }

  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`
  }

  return inspect(arg, {
    depth: 5,
    colors: false,
    compact: false,
    breakLength: 120,
    maxArrayLength: 100,
  })
}

function serializeArgs(args) {
  return args.map(serializeArg).join(' ').replace(ANSI_ESCAPE_PATTERN, '').trimEnd()
}

function appendLogEntry(entry) {
  logEntries.push(entry)
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.shift()
  }

  for (const listener of listeners) {
    try {
      listener(entry)
    } catch (error) {
      const consoleError = originalConsole.get('error')
      if (consoleError) {
        consoleError('[调试日志] 推送日志到订阅端失败:', error)
      }
    }
  }
}

export function installDebugLogCapture() {
  if (installed) {
    return
  }

  installed = true

  for (const level of SUPPORTED_LEVELS) {
    const method = console[level].bind(console)
    originalConsole.set(level, method)

    console[level] = (...args) => {
      appendLogEntry({
        id: ++sequence,
        level,
        message: serializeArgs(args),
        timestamp: new Date().toISOString(),
      })

      method(...args)
    }
  }
}

export function getRecentDebugLogs(limit = 200) {
  const resolvedLimit = normalizeLimit(Number(limit))
  return logEntries.slice(-resolvedLimit)
}

export function subscribeDebugLogs(listener) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
