export const CHANNEL_TYPE_XINGTIAN = 'xingtian'
export const CHANNEL_TYPE_OTHER = 'other'

export function normalizeChannelType(value) {
  return String(value || '').trim() === CHANNEL_TYPE_XINGTIAN
    ? CHANNEL_TYPE_XINGTIAN
    : CHANNEL_TYPE_OTHER
}

export function isXingtianChannelType(value) {
  return normalizeChannelType(value) === CHANNEL_TYPE_XINGTIAN
}
