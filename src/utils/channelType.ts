export type ChannelType = 'xingtian' | 'other'

export const CHANNEL_TYPE_OPTIONS: Array<{ label: string; value: ChannelType }> = [
  { label: '形天', value: 'xingtian' },
  { label: '其他', value: 'other' },
]

export function normalizeChannelType(value: unknown): ChannelType {
  return String(value || '').trim() === 'xingtian' ? 'xingtian' : 'other'
}

export function isXingtianChannelType(value: unknown): boolean {
  return normalizeChannelType(value) === 'xingtian'
}

export function getChannelTypeLabel(value: unknown): string {
  return isXingtianChannelType(value) ? '形天' : '其他'
}
