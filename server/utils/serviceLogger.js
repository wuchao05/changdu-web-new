function normalizeLogSegment(value, fallbackValue) {
  const normalizedValue = String(value || '').trim()
  if (normalizedValue) {
    return normalizedValue
  }

  return fallbackValue
}

function inferScopeFromArgs(args = [], defaultScope = '服务') {
  const firstArg = args[0]
  if (typeof firstArg !== 'string') {
    return defaultScope
  }

  const match = firstArg.match(/^\[([^\]-]+)(?:-[^\]]+)?\]/)
  return match?.[1] || defaultScope
}

export function buildServiceLogPrefix(scope, profile = {}) {
  const runtimeUserName = normalizeLogSegment(
    profile.runtimeUserName || profile.userName || profile.userId,
    '未知用户'
  )
  const channelName = normalizeLogSegment(profile.channelName || profile.channelId, '默认渠道')
  return `[${scope}-${runtimeUserName}-${channelName}]`
}

export function formatScopedLogArgs(scope, profile = {}, args = []) {
  const logPrefix = buildServiceLogPrefix(scope, profile)
  if (!Array.isArray(args) || args.length === 0) {
    return [logPrefix]
  }

  const [firstArg, ...restArgs] = args
  if (typeof firstArg !== 'string') {
    return [logPrefix, ...args]
  }

  const exactPrefix = `[${scope}]`
  if (firstArg.startsWith(exactPrefix)) {
    return [`${logPrefix}${firstArg.slice(exactPrefix.length)}`, ...restArgs]
  }

  const scopedPrefixPattern = new RegExp(`^\\[${scope}-[^\\]]+\\]`)
  if (scopedPrefixPattern.test(firstArg)) {
    return [`${logPrefix}${firstArg.replace(scopedPrefixPattern, '')}`, ...restArgs]
  }

  return [`${logPrefix} ${firstArg}`, ...restArgs]
}

export function createScopedConsole(defaultScope, resolveProfile, resolveScope = null) {
  const getProfile = typeof resolveProfile === 'function' ? args => resolveProfile(args) : () => ({})
  const getScope =
    typeof resolveScope === 'function'
      ? args => resolveScope(args) || defaultScope
      : args => inferScopeFromArgs(args, defaultScope)

  return {
    log(...args) {
      const scope = getScope(args)
      globalThis.console.log(...formatScopedLogArgs(scope, getProfile(args), args))
    },
    warn(...args) {
      const scope = getScope(args)
      globalThis.console.warn(...formatScopedLogArgs(scope, getProfile(args), args))
    },
    error(...args) {
      const scope = getScope(args)
      globalThis.console.error(...formatScopedLogArgs(scope, getProfile(args), args))
    },
  }
}
