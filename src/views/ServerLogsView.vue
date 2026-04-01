<template>
  <div class="server-logs-page">
    <header class="server-logs-page__header">
      <div class="server-logs-page__title-wrap">
        <n-button text class="server-logs-page__back" @click="handleBack">
          <template #icon>
            <Icon icon="mdi:arrow-left" />
          </template>
          返回
        </n-button>

        <div>
          <p class="server-logs-page__eyebrow">管理员工具</p>
          <h1 class="server-logs-page__title">服务端日志</h1>
          <p class="server-logs-page__subtitle">实时展示当前服务进程输出的全部可用日志</p>
        </div>
      </div>

      <div class="server-logs-page__actions">
        <div class="server-logs-page__status">
          <span>日志 {{ entries.length }} 条</span>
          <n-tag size="small" :type="statusTagType">
            {{ statusText }}
          </n-tag>
        </div>

        <div class="server-logs-page__toolbar">
          <span class="server-logs-page__switch-label">自动滚动</span>
          <n-switch v-model:value="autoScroll" size="small" />
          <n-button secondary @click="restartStream">重新连接</n-button>
          <n-button quaternary @click="clearEntries">清空</n-button>
        </div>
      </div>
    </header>

    <main class="server-logs-page__body">
      <n-alert v-if="errorMessage" type="error" :show-icon="false" class="server-logs-page__alert">
        {{ errorMessage }}
      </n-alert>

      <section class="terminal-shell">
        <div class="terminal-shell__meta">
          <div class="terminal-shell__meta-left">
            <span class="terminal-shell__dot terminal-shell__dot--danger"></span>
            <span class="terminal-shell__dot terminal-shell__dot--warning"></span>
            <span class="terminal-shell__dot terminal-shell__dot--success"></span>
            <span class="terminal-shell__meta-title">server.log.stream</span>
          </div>
          <span class="terminal-shell__meta-right">{{ statusText }}</span>
        </div>

        <div ref="logContainerRef" class="terminal-shell__viewport">
          <div v-if="entries.length" class="terminal-shell__content">
            <div
              v-for="entry in entries"
              :key="getEntryKey(entry)"
              class="terminal-shell__line"
              :class="`terminal-shell__line--${entry.level}`"
            >
              <span class="terminal-shell__time">{{ formatTimestamp(entry.timestamp) }}</span>
              <span class="terminal-shell__level">{{ entry.level.toUpperCase() }}</span>
              <pre class="terminal-shell__message">{{ entry.message }}</pre>
            </div>
          </div>

          <div v-else class="terminal-shell__empty">
            <Icon icon="mdi:console-line" class="terminal-shell__empty-icon" />
            <p class="terminal-shell__empty-title">等待服务端输出日志</p>
            <p class="terminal-shell__empty-desc">页面打开后会自动连接日志流并持续接收最新打印内容</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NSwitch, NTag } from 'naive-ui'
import { connectDebugLogStream, type DebugLogEntry } from '@/api/debug'

defineOptions({
  name: 'ServerLogsPage',
})

type DebugConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

const router = useRouter()
const autoScroll = ref(true)
const entries = ref<DebugLogEntry[]>([])
const errorMessage = ref('')
const connectionStatus = ref<DebugConnectionStatus>('idle')
const logContainerRef = ref<HTMLElement | null>(null)
const entryKeySet = new Set<string>()

let disconnectStream: null | (() => void) = null
let reconnectTimer: number | null = null
let activeStreamId = 0
let keepStreaming = true

const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connecting':
      return '连接中'
    case 'connected':
      return '实时同步中'
    case 'error':
      return '连接异常，准备重连'
    default:
      return '未连接'
  }
})

const statusTagType = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'success'
    case 'connecting':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'default'
  }
})

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function clearEntries() {
  entryKeySet.clear()
  entries.value = []
}

function getEntryKey(entry: DebugLogEntry) {
  return `${entry.timestamp}-${entry.id}-${entry.level}`
}

function scrollToBottom() {
  const container = logContainerRef.value
  if (!container || !autoScroll.value) {
    return
  }

  container.scrollTop = container.scrollHeight
}

function mergeEntries(nextEntries: DebugLogEntry[]) {
  if (!Array.isArray(nextEntries) || nextEntries.length === 0) {
    return
  }

  const mergedEntries = [...entries.value]
  let changed = false

  for (const entry of nextEntries) {
    const entryKey = getEntryKey(entry)
    if (entryKeySet.has(entryKey)) {
      continue
    }

    entryKeySet.add(entryKey)
    mergedEntries.push(entry)
    changed = true
  }

  if (changed) {
    entries.value = mergedEntries
  }
}

function clearReconnectTimer() {
  if (reconnectTimer === null) {
    return
  }

  window.clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function stopStream(resetStatus = true) {
  activeStreamId += 1
  clearReconnectTimer()
  disconnectStream?.()
  disconnectStream = null

  if (resetStatus) {
    connectionStatus.value = 'idle'
  }
}

function scheduleReconnect() {
  if (!keepStreaming) {
    return
  }

  clearReconnectTimer()
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    startStream()
  }, 2000)
}

function startStream() {
  stopStream(false)
  errorMessage.value = ''
  connectionStatus.value = 'connecting'
  const streamId = activeStreamId

  disconnectStream = connectDebugLogStream({
    limit: 5000,
    onConnected: () => {
      if (streamId !== activeStreamId) {
        return
      }

      connectionStatus.value = 'connected'
    },
    onDisconnected: () => {
      if (streamId !== activeStreamId) {
        return
      }

      if (connectionStatus.value !== 'error') {
        connectionStatus.value = 'idle'
      }

      scheduleReconnect()
    },
    onSnapshot: snapshot => {
      if (streamId !== activeStreamId) {
        return
      }

      mergeEntries(Array.isArray(snapshot) ? snapshot : [])
      void nextTick(() => {
        scrollToBottom()
      })
    },
    onLog: entry => {
      if (streamId !== activeStreamId) {
        return
      }

      mergeEntries([entry])
    },
    onError: error => {
      if (streamId !== activeStreamId) {
        return
      }

      errorMessage.value = error.message
      connectionStatus.value = 'error'
      scheduleReconnect()
    },
  })
}

function restartStream() {
  startStream()
}

function handleBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.push('/')
}

watch(
  () => entries.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

watch(autoScroll, enabled => {
  if (!enabled) {
    return
  }

  void nextTick(() => {
    scrollToBottom()
  })
})

onMounted(() => {
  keepStreaming = true
  startStream()
})

onBeforeUnmount(() => {
  keepStreaming = false
  stopStream()
})
</script>

<style scoped>
.server-logs-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.14), transparent 28%),
    radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.12), transparent 22%),
    linear-gradient(180deg, #020617 0%, #0f172a 42%, #020617 100%);
  color: #e2e8f0;
}

.server-logs-page__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 28px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(18px);
}

.server-logs-page__title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.server-logs-page__back {
  color: #cbd5e1;
}

.server-logs-page__eyebrow {
  margin: 0 0 6px;
  color: #38bdf8;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.server-logs-page__title {
  margin: 0;
  color: #f8fafc;
  font-size: 28px;
  font-weight: 700;
}

.server-logs-page__subtitle {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 14px;
}

.server-logs-page__actions {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.server-logs-page__status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #cbd5e1;
  font-size: 13px;
}

.server-logs-page__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.server-logs-page__switch-label {
  color: #94a3b8;
  font-size: 12px;
}

.server-logs-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 28px 28px;
}

.server-logs-page__alert {
  border-radius: 14px;
}

.terminal-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98)),
    linear-gradient(90deg, rgba(34, 197, 94, 0.06), rgba(56, 189, 248, 0.05));
  box-shadow:
    0 28px 80px rgba(2, 6, 23, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.terminal-shell__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.92);
  color: #94a3b8;
  font-size: 12px;
}

.terminal-shell__meta-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.terminal-shell__meta-title {
  color: #cbd5e1;
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
}

.terminal-shell__meta-right {
  color: #38bdf8;
}

.terminal-shell__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.terminal-shell__dot--danger {
  background: #fb7185;
}

.terminal-shell__dot--warning {
  background: #fbbf24;
}

.terminal-shell__dot--success {
  background: #34d399;
}

.terminal-shell__viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px 22px 24px;
}

.terminal-shell__content {
  display: flex;
  flex-direction: column;
}

.terminal-shell__line {
  display: grid;
  grid-template-columns: 88px 64px minmax(0, 1fr);
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.6;
}

.terminal-shell__line:last-child {
  border-bottom: none;
}

.terminal-shell__line--warn .terminal-shell__level {
  color: #fbbf24;
}

.terminal-shell__line--error .terminal-shell__level {
  color: #f87171;
}

.terminal-shell__line--info .terminal-shell__level {
  color: #38bdf8;
}

.terminal-shell__time {
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.terminal-shell__level {
  color: #4ade80;
  font-weight: 700;
}

.terminal-shell__message {
  margin: 0;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
}

.terminal-shell__empty {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: #94a3b8;
  text-align: center;
}

.terminal-shell__empty-icon {
  font-size: 36px;
  color: #38bdf8;
}

.terminal-shell__empty-title {
  margin: 0;
  color: #e2e8f0;
  font-size: 18px;
  font-weight: 600;
}

.terminal-shell__empty-desc {
  margin: 0;
  max-width: 520px;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 960px) {
  .server-logs-page__header {
    padding: 18px 16px 14px;
    flex-direction: column;
  }

  .server-logs-page__title-wrap {
    width: 100%;
    flex-direction: column;
    gap: 12px;
  }

  .server-logs-page__actions {
    width: 100%;
    justify-content: space-between;
  }

  .server-logs-page__body {
    padding: 14px 16px 16px;
  }
}

@media (max-width: 640px) {
  .server-logs-page__title {
    font-size: 24px;
  }

  .server-logs-page__actions {
    align-items: flex-start;
  }

  .terminal-shell__line {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
