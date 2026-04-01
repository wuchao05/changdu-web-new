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

export function parseRuntimeInstanceKey(instanceKey = '') {
  const normalizedInstanceKey = String(instanceKey || '').trim()
  if (!normalizedInstanceKey) {
    return {
      userId: '',
      channelId: '',
    }
  }

  const separatorIndex = normalizedInstanceKey.indexOf('__')
  if (separatorIndex === -1) {
    return {
      userId: '',
      channelId: normalizedInstanceKey,
    }
  }

  return {
    userId: normalizedInstanceKey.slice(0, separatorIndex).trim(),
    channelId: normalizedInstanceKey.slice(separatorIndex + 2).trim(),
  }
}

export function patchRuntimeIdentityFromInstanceKey(target = {}, instanceKey = '') {
  if (!target || typeof target !== 'object') {
    return target
  }

  const identity = parseRuntimeInstanceKey(instanceKey)

  if (!target.userId && identity.userId && identity.userId !== 'anonymous') {
    target.userId = identity.userId
  }

  if (!target.channelId && identity.channelId && identity.channelId !== 'default') {
    target.channelId = identity.channelId
  }

  return target
}
