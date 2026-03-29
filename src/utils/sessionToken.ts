const SESSION_TOKEN_KEY = 'changdu_web_studio_token'
const SELECTED_CHANNEL_KEY = 'changdu_web_studio_selected_channel'

export function getSessionToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(SESSION_TOKEN_KEY) || ''
}

export function setSessionToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

export function clearSessionToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

export function getSelectedChannelId() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(SELECTED_CHANNEL_KEY) || ''
}

export function setSelectedChannelId(channelId: string) {
  if (typeof window === 'undefined') return
  if (!channelId) {
    localStorage.removeItem(SELECTED_CHANNEL_KEY)
    return
  }
  localStorage.setItem(SELECTED_CHANNEL_KEY, channelId)
}

export function clearSelectedChannelId() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SELECTED_CHANNEL_KEY)
}

export function buildSessionHeaders(headers: HeadersInit = {}) {
  const token = getSessionToken()
  const channelId = getSelectedChannelId()
  if (!token) {
    return headers
  }

  return {
    ...headers,
    'X-Studio-Token': token,
    ...(channelId ? { 'X-Studio-Channel-Id': channelId } : {}),
  }
}
