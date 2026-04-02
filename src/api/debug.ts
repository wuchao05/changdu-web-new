import { ENV } from '@/config/env'
import { buildSessionHeaders } from '@/utils/sessionToken'

export type DebugLogLevel = 'log' | 'info' | 'warn' | 'error'

export interface DebugLogEntry {
  id: number
  level: DebugLogLevel
  message: string
  timestamp: string
}

interface DebugSnapshotPacket {
  type: 'snapshot'
  entries: DebugLogEntry[]
}

interface DebugLogPacket {
  type: 'log'
  entry: DebugLogEntry
}

interface DebugHeartbeatPacket {
  type: 'heartbeat'
  timestamp: string
}

type DebugStreamPacket = DebugSnapshotPacket | DebugLogPacket | DebugHeartbeatPacket

interface ConnectDebugLogStreamOptions {
  limit?: number
  onConnected?: () => void
  onDisconnected?: () => void
  onSnapshot?: (entries: DebugLogEntry[]) => void
  onLog?: (entry: DebugLogEntry) => void
  onError?: (error: Error) => void
}

function parseErrorMessage(text: string, fallbackMessage: string) {
  if (!text) {
    return fallbackMessage
  }

  try {
    const parsed = JSON.parse(text) as { message?: string }
    return parsed.message || fallbackMessage
  } catch {
    return text
  }
}

function resolveLimit(limit?: number) {
  if (!Number.isFinite(limit)) {
    return 500
  }

  return Math.min(Math.max(Math.trunc(limit as number), 20), 20000)
}

function handlePacket(packet: DebugStreamPacket, options: ConnectDebugLogStreamOptions) {
  if (packet.type === 'snapshot') {
    options.onSnapshot?.(Array.isArray(packet.entries) ? packet.entries : [])
    return
  }

  if (packet.type === 'log') {
    options.onLog?.(packet.entry)
  }
}

export function connectDebugLogStream(options: ConnectDebugLogStreamOptions = {}) {
  const controller = new AbortController()

  const start = async () => {
    try {
      const response = await fetch(
        `${ENV.BASE_URL}/debug/logs/stream?limit=${resolveLimit(options.limit)}`,
        {
          method: 'GET',
          headers: buildSessionHeaders(),
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(parseErrorMessage(text, `连接日志流失败 (${response.status})`))
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('当前浏览器不支持实时日志流')
      }

      options.onConnected?.()

      const decoder = new TextDecoder()
      let buffer = ''

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        while (true) {
          const lineBreakIndex = buffer.indexOf('\n')
          if (lineBreakIndex < 0) {
            break
          }

          const line = buffer.slice(0, lineBreakIndex).trim()
          buffer = buffer.slice(lineBreakIndex + 1)

          if (!line) {
            continue
          }

          const packet = JSON.parse(line) as DebugStreamPacket
          handlePacket(packet, options)
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      options.onError?.(error instanceof Error ? error : new Error('连接实时日志失败'))
    } finally {
      options.onDisconnected?.()
    }
  }

  void start()

  return () => {
    controller.abort()
  }
}
