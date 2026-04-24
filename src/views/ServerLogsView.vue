<template>
  <div class="server-logs-page">
    <header class="server-logs-page__header">
      <div class="server-logs-page__title-wrap">
        <div class="server-logs-page__title-top">
          <n-button text class="server-logs-page__back" @click="handleBack">
            <template #icon>
              <Icon icon="mdi:arrow-left" />
            </template>
            返回
          </n-button>
          <span class="server-logs-page__eyebrow">管理员工具</span>
        </div>

        <div class="server-logs-page__title-block">
          <h1 class="server-logs-page__title">服务端日志</h1>
          <p class="server-logs-page__subtitle">实时展示当前服务进程输出的全部可用日志</p>
        </div>
      </div>

      <div class="server-logs-page__actions-card">
        <div class="server-logs-page__status-row">
          <div class="server-logs-page__metric">
            <span class="server-logs-page__metric-label">日志总数</span>
            <strong class="server-logs-page__metric-value">{{ entries.length }}</strong>
          </div>

          <div class="server-logs-page__metric">
            <span class="server-logs-page__metric-label">当前展示</span>
            <strong class="server-logs-page__metric-value">{{ filteredEntries.length }}</strong>
          </div>

          <div class="server-logs-page__status">
            <span class="server-logs-page__status-label">连接状态</span>
            <n-tag size="small" :type="statusTagType" round>
              {{ statusText }}
            </n-tag>
          </div>
        </div>

        <div class="server-logs-page__toolbar">
          <div class="server-logs-page__switch-group">
            <span class="server-logs-page__switch-label">自动定位最新</span>
            <n-switch v-model:value="autoScroll" size="small" />
          </div>

          <n-button class="server-logs-page__action-button" @click="restartStream">
            <template #icon>
              <Icon icon="mdi:refresh" />
            </template>
            重新连接
          </n-button>

          <n-button
            class="server-logs-page__action-button server-logs-page__action-button--subtle"
            @click="clearEntries"
          >
            <template #icon>
              <Icon icon="mdi:delete-outline" />
            </template>
            清空
          </n-button>
        </div>

        <div class="server-logs-page__filters">
          <n-select
            v-model:value="selectedLevel"
            class="server-logs-page__filter"
            :options="levelOptions"
            clearable
            placeholder="按日志类型过滤"
          />
          <n-select
            v-model:value="selectedScope"
            class="server-logs-page__filter"
            :options="scopeOptions"
            clearable
            filterable
            placeholder="按前缀过滤"
          />
          <n-select
            v-model:value="selectedUserName"
            class="server-logs-page__filter"
            :options="userNameOptions"
            clearable
            filterable
            placeholder="按用户名过滤"
          />
          <n-select
            v-model:value="selectedChannelName"
            class="server-logs-page__filter"
            :options="channelOptions"
            clearable
            filterable
            placeholder="按渠道过滤"
          />
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

        <div
          ref="logContainerRef"
          class="terminal-shell__viewport"
          @scroll="handleLogViewportScroll"
        >
          <transition-group
            v-if="displayedEntries.length"
            tag="div"
            class="terminal-shell__content"
            name="terminal-log"
            :css="shouldAnimateLogEntries"
          >
            <div
              v-for="entry in displayedEntries"
              :key="getEntryKey(entry)"
              class="terminal-shell__line"
              :class="`terminal-shell__line--${entry.level}`"
            >
              <span class="terminal-shell__time">{{ formatTimestamp(entry.timestamp) }}</span>
              <span class="terminal-shell__level">{{ entry.level.toUpperCase() }}</span>
              <pre class="terminal-shell__message">{{ entry.message }}</pre>
            </div>
          </transition-group>

          <div v-else-if="isInitialLogLoading" class="terminal-shell__loading" aria-live="polite">
            <div class="terminal-loader">
              <div class="terminal-loader__visual" aria-hidden="true">
                <span class="terminal-loader__halo terminal-loader__halo--outer"></span>
                <span class="terminal-loader__halo terminal-loader__halo--inner"></span>
                <span class="terminal-loader__core"></span>
                <span class="terminal-loader__scan"></span>
              </div>

              <div class="terminal-loader__copy">
                <p class="terminal-loader__title">正在接入日志流</p>
                <p class="terminal-loader__desc">同步最近 10,000 条服务端输出，请稍候</p>
              </div>

              <div class="terminal-loader__code" aria-hidden="true">
                <span>connect server.log.stream</span>
                <span>handshake current session</span>
                <span>tail -f runtime/output.log</span>
              </div>
            </div>
          </div>

          <div v-else class="terminal-shell__empty">
            <Icon icon="mdi:console-line" class="terminal-shell__empty-icon" />
            <p class="terminal-shell__empty-title">{{ emptyStateTitle }}</p>
            <p class="terminal-shell__empty-desc">{{ emptyStateDescription }}</p>
          </div>
        </div>

        <n-button
          v-show="showBackTopButton"
          class="terminal-shell__back-top"
          round
          @click="scrollToLogTop"
        >
          <template #icon>
            <Icon icon="mdi:arrow-up" />
          </template>
          回到顶部
        </n-button>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NSelect, NSwitch, NTag } from 'naive-ui'
import { connectDebugLogStream, type DebugLogEntry, type DebugLogLevel } from '@/api/debug'

defineOptions({
  name: 'ServerLogsPage',
})

type DebugConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'
type SelectOption = {
  label: string
  value: string
}
type ParsedLogMeta = {
  scope: string
  userName: string
  channelName: string
}

const router = useRouter()
const autoScroll = ref(true)
const entries = ref<DebugLogEntry[]>([])
const errorMessage = ref('')
const hasReceivedSnapshot = ref(false)
const shouldAnimateLogEntries = ref(false)
const connectionStatus = ref<DebugConnectionStatus>('idle')
const logContainerRef = ref<HTMLElement | null>(null)
const showBackTopButton = ref(false)
const selectedLevel = ref<DebugLogLevel | null>(null)
const selectedScope = ref<string | null>(null)
const selectedUserName = ref<string | null>(null)
const selectedChannelName = ref<string | null>(null)
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

function parseLogMeta(message: string): ParsedLogMeta | null {
  const normalizedMessage = String(message || '').trim()
  const matchedPrefix = normalizedMessage.match(/^\[([^\]]+)\]/)
  if (!matchedPrefix?.[1]) {
    return null
  }

  const segments = matchedPrefix[1]
    .split('-')
    .map(segment => segment.trim())
    .filter(Boolean)

  if (segments.length < 3) {
    return null
  }

  return {
    scope: segments[0],
    userName: segments[1],
    channelName: segments.slice(2).join('-'),
  }
}

function buildSelectOptions(values: string[]): SelectOption[] {
  return values.map(value => ({
    label: value,
    value,
  }))
}

const levelOptions: SelectOption[] = [
  { label: 'LOG', value: 'log' },
  { label: 'INFO', value: 'info' },
  { label: 'WARN', value: 'warn' },
  { label: 'ERROR', value: 'error' },
]

const parsedEntries = computed(() =>
  entries.value.map(entry => ({
    entry,
    meta: parseLogMeta(entry.message),
  }))
)

const scopeOptions = computed<SelectOption[]>(() => {
  const values = new Set<string>()
  parsedEntries.value.forEach(({ meta }) => {
    if (meta?.scope) {
      values.add(meta.scope)
    }
  })
  return buildSelectOptions(Array.from(values))
})

const userNameOptions = computed<SelectOption[]>(() => {
  const values = new Set<string>()
  parsedEntries.value.forEach(({ meta }) => {
    if (meta?.userName) {
      values.add(meta.userName)
    }
  })
  return buildSelectOptions(Array.from(values))
})

const channelOptions = computed<SelectOption[]>(() => {
  const values = new Set<string>()
  parsedEntries.value.forEach(({ meta }) => {
    if (meta?.channelName) {
      values.add(meta.channelName)
    }
  })
  return buildSelectOptions(Array.from(values))
})

const filteredEntries = computed(() =>
  parsedEntries.value
    .filter(({ entry, meta }) => {
      if (selectedScope.value && meta?.scope !== selectedScope.value) {
        return false
      }

      if (selectedUserName.value && meta?.userName !== selectedUserName.value) {
        return false
      }

      if (selectedChannelName.value && meta?.channelName !== selectedChannelName.value) {
        return false
      }

      if (selectedLevel.value && entry.level !== selectedLevel.value) {
        return false
      }

      if (selectedScope.value || selectedUserName.value || selectedChannelName.value) {
        return Boolean(meta)
      }

      return true
    })
    .map(({ entry }) => entry)
)

const displayedEntries = computed(() => [...filteredEntries.value].reverse())

const isInitialLogLoading = computed(
  () =>
    entries.value.length === 0 &&
    !hasReceivedSnapshot.value &&
    (connectionStatus.value === 'connecting' || connectionStatus.value === 'connected')
)

const emptyStateTitle = computed(() => {
  if (entries.value.length === 0) {
    return '等待服务端输出日志'
  }

  return '没有匹配的日志'
})

const emptyStateDescription = computed(() => {
  if (entries.value.length === 0) {
    return '页面打开后会自动连接日志流并持续接收最新打印内容'
  }

  return '试试清空部分过滤条件，或等待新的匹配日志进入'
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
  showBackTopButton.value = false
}

function getEntryKey(entry: DebugLogEntry) {
  return `${entry.timestamp}-${entry.id}-${entry.level}`
}

function scrollToLatest() {
  const container = logContainerRef.value
  if (!container || !autoScroll.value) {
    return
  }

  container.scrollTop = 0
  showBackTopButton.value = false
}

function handleLogViewportScroll() {
  const container = logContainerRef.value
  showBackTopButton.value = Boolean(container && container.scrollTop > 120)
}

function scrollToLogTop() {
  const container = logContainerRef.value
  if (!container) {
    return
  }

  container.scrollTo({ top: 0, behavior: 'smooth' })
  showBackTopButton.value = false
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
  if (entries.value.length === 0) {
    hasReceivedSnapshot.value = false
    shouldAnimateLogEntries.value = false
  }
  connectionStatus.value = 'connecting'
  const streamId = activeStreamId

  disconnectStream = connectDebugLogStream({
    limit: 10000,
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

      hasReceivedSnapshot.value = true
      shouldAnimateLogEntries.value = false
      mergeEntries(Array.isArray(snapshot) ? snapshot : [])
      void nextTick(() => {
        scrollToLatest()
        shouldAnimateLogEntries.value = true
      })
    },
    onLog: entry => {
      if (streamId !== activeStreamId) {
        return
      }

      hasReceivedSnapshot.value = true
      shouldAnimateLogEntries.value = true
      mergeEntries([entry])
    },
    onError: error => {
      if (streamId !== activeStreamId) {
        return
      }

      hasReceivedSnapshot.value = true
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
  () => displayedEntries.value.length,
  async () => {
    await nextTick()
    scrollToLatest()
  }
)

watch(autoScroll, enabled => {
  if (!enabled) {
    return
  }

  void nextTick(() => {
    scrollToLatest()
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
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top, rgba(14, 165, 233, 0.14), transparent 28%),
    radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.12), transparent 22%),
    linear-gradient(180deg, #020617 0%, #0f172a 42%, #020617 100%);
  color: #e2e8f0;
}

.server-logs-page__header {
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 20px;
  padding: 22px 28px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  background:
    linear-gradient(180deg, rgba(3, 7, 18, 0.96), rgba(6, 13, 28, 0.88)),
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 28%);
  backdrop-filter: blur(18px);
}

.server-logs-page__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.server-logs-page__title-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.server-logs-page__title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.server-logs-page__back {
  padding: 0;
  color: #86efac;
}

.server-logs-page__eyebrow {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 999px;
  background: rgba(8, 47, 73, 0.28);
  color: #67e8f9;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.server-logs-page__title {
  margin: 0;
  color: #f8fafc;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.05;
}

.server-logs-page__subtitle {
  margin: 0;
  color: #a5b4fc;
  font-size: 15px;
}

.server-logs-page__actions-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 540px;
  padding: 16px 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.82)),
    radial-gradient(circle at top right, rgba(34, 197, 94, 0.09), transparent 34%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.server-logs-page__status-row {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.server-logs-page__metric,
.server-logs-page__status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(30, 41, 59, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.server-logs-page__metric {
  min-width: 130px;
}

.server-logs-page__metric-label,
.server-logs-page__status-label {
  color: #94a3b8;
  font-size: 12px;
}

.server-logs-page__metric-value {
  color: #f8fafc;
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}

.server-logs-page__status {
  color: #cbd5e1;
  font-size: 13px;
}

.server-logs-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.server-logs-page__filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.server-logs-page__filter {
  min-width: 0;
}

:deep(.server-logs-page__filter .n-base-selection) {
  min-height: 42px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.88) !important;
  border: none !important;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.16) !important;
}

:deep(.server-logs-page__filter .n-base-selection__border),
:deep(.server-logs-page__filter .n-base-selection__state-border) {
  display: none !important;
}

:deep(.server-logs-page__filter .n-base-selection-label) {
  background: transparent !important;
}

:deep(.server-logs-page__filter .n-base-selection-placeholder),
:deep(.server-logs-page__filter .n-base-selection-input),
:deep(.server-logs-page__filter .n-base-selection__input),
:deep(.server-logs-page__filter .n-base-selection__placeholder) {
  background: transparent !important;
}

:deep(.server-logs-page__filter .n-base-selection-label) {
  color: #e2e8f0;
}

:deep(.server-logs-page__filter .n-base-selection-placeholder) {
  color: #94a3b8;
}

.server-logs-page__switch-group {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.server-logs-page__switch-label {
  color: #cbd5e1;
  font-size: 13px;
}

.server-logs-page__action-button {
  min-width: 128px;
  border-radius: 14px;
  border: 1px solid rgba(34, 197, 94, 0.28);
  background: linear-gradient(180deg, rgba(22, 101, 52, 0.32), rgba(20, 83, 45, 0.22));
  color: #dcfce7;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.server-logs-page__action-button:hover {
  border-color: rgba(74, 222, 128, 0.42);
  background: linear-gradient(180deg, rgba(22, 101, 52, 0.42), rgba(21, 94, 51, 0.28));
  color: #f0fdf4;
}

.server-logs-page__action-button--subtle {
  border-color: rgba(148, 163, 184, 0.22);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.88), rgba(15, 23, 42, 0.82));
  color: #e2e8f0;
}

.server-logs-page__action-button--subtle:hover {
  border-color: rgba(148, 163, 184, 0.38);
  background: linear-gradient(180deg, rgba(51, 65, 85, 0.9), rgba(30, 41, 59, 0.88));
  color: #f8fafc;
}

:deep(.server-logs-page__action-button .n-button__content) {
  font-weight: 600;
}

.server-logs-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 28px 28px;
}

.server-logs-page__alert {
  border-radius: 14px;
}

.terminal-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 24%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
  box-shadow:
    0 28px 80px rgba(2, 6, 23, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}

.terminal-shell__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.9)),
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 28%);
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
  font-family: var(--app-font-family);
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
  scrollbar-gutter: stable;
}

.terminal-shell__viewport::-webkit-scrollbar-thumb {
  background: rgba(56, 189, 248, 0.28);
}

.terminal-shell__viewport::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 222, 128, 0.36);
}

.terminal-shell__back-top {
  position: absolute;
  right: 22px;
  bottom: 22px;
  z-index: 2;
  border: 1px solid rgba(74, 222, 128, 0.32);
  background:
    linear-gradient(180deg, rgba(22, 101, 52, 0.82), rgba(15, 23, 42, 0.88)),
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.2), transparent 44%);
  color: #dcfce7;
  box-shadow:
    0 14px 36px rgba(2, 6, 23, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
}

.terminal-shell__back-top:hover {
  border-color: rgba(125, 211, 252, 0.5);
  background:
    linear-gradient(180deg, rgba(22, 101, 52, 0.94), rgba(15, 23, 42, 0.92)),
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.28), transparent 44%);
  color: #f0fdf4;
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

.terminal-log-enter-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease,
    background-color 0.9s ease,
    box-shadow 0.9s ease;
}

.terminal-log-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.992);
  background-color: rgba(56, 189, 248, 0.12);
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.1);
}

.terminal-log-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  background-color: transparent;
  box-shadow: none;
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
  font-family: var(--app-font-family);
}

.terminal-shell__loading {
  position: relative;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
}

.terminal-shell__loading::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: 24px;
  background:
    linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(circle, #000 0%, transparent 72%);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 72%);
}

.terminal-loader {
  position: relative;
  z-index: 1;
  width: min(520px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 30px 28px;
  border: 1px solid rgba(56, 189, 248, 0.18);
  border-radius: 28px;
  background:
    radial-gradient(circle at 50% 0%, rgba(34, 197, 94, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.86));
  box-shadow:
    0 24px 70px rgba(2, 6, 23, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.terminal-loader::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    120deg,
    transparent 24%,
    rgba(125, 211, 252, 0.14) 48%,
    transparent 72%
  );
  transform: translateX(-110%);
  animation: terminal-loader-shimmer 2.8s ease-in-out infinite;
  pointer-events: none;
}

.terminal-loader__visual {
  position: relative;
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
}

.terminal-loader__halo,
.terminal-loader__core,
.terminal-loader__scan {
  position: absolute;
  border-radius: 999px;
}

.terminal-loader__halo {
  border: 1px solid rgba(56, 189, 248, 0.2);
  box-shadow: 0 0 28px rgba(56, 189, 248, 0.12);
}

.terminal-loader__halo--outer {
  inset: 0;
  border-top-color: rgba(74, 222, 128, 0.92);
  border-right-color: rgba(56, 189, 248, 0.56);
  animation: terminal-loader-spin 1.6s linear infinite;
}

.terminal-loader__halo--inner {
  inset: 18px;
  border-left-color: rgba(125, 211, 252, 0.86);
  border-bottom-color: rgba(34, 197, 94, 0.7);
  animation: terminal-loader-spin 2.2s linear infinite reverse;
}

.terminal-loader__core {
  width: 34px;
  height: 34px;
  background: radial-gradient(
    circle,
    #e0f2fe 0 16%,
    #67e8f9 17% 44%,
    rgba(34, 197, 94, 0.34) 45% 100%
  );
  box-shadow:
    0 0 22px rgba(56, 189, 248, 0.75),
    0 0 44px rgba(34, 197, 94, 0.28);
  animation: terminal-loader-pulse 1.4s ease-in-out infinite;
}

.terminal-loader__scan {
  width: 78px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(103, 232, 249, 0.95), transparent);
  transform-origin: center;
  animation: terminal-loader-scan 1.9s ease-in-out infinite;
}

.terminal-loader__copy {
  text-align: center;
}

.terminal-loader__title {
  margin: 0;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.terminal-loader__desc {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

.terminal-loader__code {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.48);
  color: #67e8f9;
  font-family: var(--app-font-family);
  font-size: 12px;
  text-align: left;
}

.terminal-loader__code span {
  position: relative;
  display: block;
  padding-left: 16px;
  opacity: 0.46;
  animation: terminal-loader-code 1.8s ease-in-out infinite;
}

.terminal-loader__code span::before {
  content: '>';
  position: absolute;
  left: 0;
  color: #4ade80;
}

.terminal-loader__code span:nth-child(2) {
  animation-delay: 0.18s;
}

.terminal-loader__code span:nth-child(3) {
  animation-delay: 0.36s;
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

@keyframes terminal-loader-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes terminal-loader-pulse {
  0%,
  100% {
    transform: scale(0.92);
    opacity: 0.72;
  }

  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

@keyframes terminal-loader-scan {
  0%,
  100% {
    transform: translateY(-30px) rotate(0deg);
    opacity: 0;
  }

  45%,
  55% {
    opacity: 1;
  }

  50% {
    transform: translateY(30px) rotate(180deg);
  }
}

@keyframes terminal-loader-shimmer {
  0% {
    transform: translateX(-110%);
  }

  48%,
  100% {
    transform: translateX(110%);
  }
}

@keyframes terminal-loader-code {
  0%,
  100% {
    opacity: 0.38;
    transform: translateX(0);
  }

  50% {
    opacity: 1;
    transform: translateX(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .terminal-loader::after,
  .terminal-loader__halo--outer,
  .terminal-loader__halo--inner,
  .terminal-loader__core,
  .terminal-loader__scan,
  .terminal-loader__code span {
    animation: none;
  }

  .terminal-log-enter-active {
    transition: none;
  }
}

@media (max-width: 960px) {
  .server-logs-page__header {
    grid-template-columns: 1fr;
    padding: 18px 16px 14px;
  }

  .server-logs-page__title {
    font-size: 32px;
  }

  .server-logs-page__actions-card {
    width: 100%;
    min-width: 0;
  }

  .server-logs-page__filters {
    grid-template-columns: 1fr;
  }

  .server-logs-page__body {
    padding: 14px 16px 16px;
  }
}

@media (max-width: 640px) {
  .server-logs-page__title {
    font-size: 24px;
  }

  .server-logs-page__title-top,
  .server-logs-page__status-row,
  .server-logs-page__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .server-logs-page__switch-group,
  .server-logs-page__action-button {
    width: 100%;
  }

  .terminal-shell__line {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
