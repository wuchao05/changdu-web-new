import { normalizeChannelRuntime } from './channelRuntime.js'
import { resolveRuntimeContext } from './studioData.js'
import { requireSession } from './studioSession.js'

/**
 * 统一注入“当前登录用户 + 当前渠道”的运行时上下文。
 * 会同时写入：
 * 1. ctx.state.channelRuntime
 * 2. ctx.state[contextStateKey]
 */
export function createSessionRuntimeContextMiddleware(contextStateKey = 'runtimeContext') {
  return async function sessionRuntimeContextMiddleware(ctx, next) {
    await requireSession(ctx, async () => {
      const requestedChannelId = String(ctx.get('x-studio-channel-id') || '').trim()
      const runtimeContext = await resolveRuntimeContext(ctx.state.sessionUser, requestedChannelId)
      const channelRuntime = normalizeChannelRuntime({
        channel: runtimeContext.channel,
        runtimeUser: runtimeContext.runtimeUser,
      })

      ctx.state.channelRuntime = channelRuntime
      ctx.state[contextStateKey] = {
        requestedChannelId,
        channel: runtimeContext.channel,
        availableChannels: runtimeContext.availableChannels,
        channelRuntime,
        runtimeUser: runtimeContext.runtimeUser,
      }

      await next()
    })
  }
}
