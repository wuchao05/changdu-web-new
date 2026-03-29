import Router from '@koa/router'
import { PassThrough } from 'node:stream'
import { requireAdmin } from '../utils/studioSession.js'
import { getRecentDebugLogs, subscribeDebugLogs } from '../utils/debugLogStream.js'

const router = new Router({
  prefix: '/api/debug',
})

function resolveLimit(rawLimit) {
  const parsedLimit = Number.parseInt(String(rawLimit || ''), 10)
  if (!Number.isFinite(parsedLimit)) {
    return 200
  }

  return Math.min(Math.max(parsedLimit, 20), 500)
}

router.get('/logs/stream', requireAdmin, async ctx => {
  const stream = new PassThrough()
  const limit = resolveLimit(ctx.query.limit)

  let closed = false

  const writePacket = packet => {
    if (closed || stream.destroyed || !ctx.res.writable) {
      return
    }

    stream.write(`${JSON.stringify(packet)}\n`)
  }

  const cleanup = () => {
    if (closed) {
      return
    }

    closed = true
    clearInterval(heartbeatTimer)
    unsubscribe()
    stream.end()
  }

  const unsubscribe = subscribeDebugLogs(entry => {
    writePacket({
      type: 'log',
      entry,
    })
  })

  const heartbeatTimer = setInterval(() => {
    writePacket({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    })
  }, 15000)

  ctx.req.setTimeout(0)
  ctx.status = 200
  ctx.set('Content-Type', 'application/x-ndjson; charset=utf-8')
  ctx.set('Cache-Control', 'no-cache, no-transform')
  ctx.set('Connection', 'keep-alive')
  ctx.set('X-Accel-Buffering', 'no')
  ctx.body = stream

  writePacket({
    type: 'snapshot',
    entries: getRecentDebugLogs(limit),
  })

  ctx.req.on('close', cleanup)
  ctx.req.on('aborted', cleanup)
  ctx.res.on('close', cleanup)
})

export default router
