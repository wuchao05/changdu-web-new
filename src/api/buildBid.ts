import httpInstance from './http'

export interface BuildBidConfig {
  channelId: string
  channelName: string
  channelBidEnabled: boolean
  channelDefaultBid: string
  userBid: string
  effectiveBid: string
  effectiveSource: 'user' | 'channel' | 'disabled' | ''
}

export function getBuildBidConfig() {
  return httpInstance.get('/build-bid/config').then(res => res.data.data as BuildBidConfig)
}

export function updateBuildBidConfig(payload: { bid: string }) {
  return httpInstance.put('/build-bid/config', payload).then(res => res.data.data as BuildBidConfig)
}
