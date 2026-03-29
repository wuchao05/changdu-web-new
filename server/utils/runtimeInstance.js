function normalizeInstancePart(value = '', fallback = 'default') {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
  return normalized || fallback
}

export function buildRuntimeInstanceKey(runtimeContext = {}) {
  const userId = normalizeInstancePart(
    runtimeContext.runtimeUser?.id || runtimeContext.userId || '',
    'anonymous'
  )
  const channelId = normalizeInstancePart(
    runtimeContext.channelRuntime?.channelId || runtimeContext.channelId || '',
    'default'
  )
  return `${userId}__${channelId}`
}

export function normalizeRuntimeInstanceKey(instanceKey = '') {
  return normalizeInstancePart(instanceKey, 'anonymous__default')
}
