<template>
  <div v-if="shouldShow">
    <n-button class="debug-fab" circle type="primary" @click="drawerVisible = true">
      <template #icon>
        <Icon icon="mdi:bug-outline" />
      </template>
    </n-button>

    <n-drawer v-model:show="drawerVisible" placement="right" :width="drawerWidth">
      <n-drawer-content title="服务端调试日志" closable>
        <div class="debug-console">
          <div class="debug-console__toolbar">
            <div class="debug-console__summary">
              <span>管理员调试面板</span>
              <span>{{ channelLabel }}</span>
              <span>日志 {{ entries.length }} 条</span>
              <n-tag size="small" :type="statusTagType">
                {{ statusText }}
              </n-tag>
            </div>

            <div class="debug-console__actions">
              <span class="debug-console__switch-label">自动滚动</span>
              <n-switch v-model:value="autoScroll" size="small" />
              <n-button text type="primary" @click="clearEntries">清空</n-button>
            </div>
          </div>

          <n-alert v-if="errorMessage" type="error" :show-icon="false" class="debug-console__error">
            {{ errorMessage }}
          </n-alert>

          <div v-if="entries.length" ref="logContainerRef" class="debug-console__log-list">
            <div
              v-for="entry in entries"
              :key="entry.id"
              class="debug-console__log-item"
              :class="`debug-console__log-item--${entry.level}`"
            >
              <span class="debug-console__time">{{ formatTimestamp(entry.timestamp) }}</span>
              <span class="debug-console__level">{{ entry.level.toUpperCase() }}</span>
              <pre class="debug-console__message">{{ entry.message }}</pre>
            </div>
          </div>

          <div v-else class="debug-console__empty">
            <Icon icon="mdi:file-document-outline" class="debug-console__empty-icon" />
            <span>打开后会实时接收服务端日志</span>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NDrawer, NDrawerContent, NSwitch, NTag } from 'naive-ui'
import { useRoute } from 'vue-router'
import { connectDebugLogStream, type DebugLogEntry } from '@/api/debug'
import { useSessionStore } from '@/stores/session'

const MAX_VISIBLE_ENTRIES = 500

type DebugConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

const route = useRoute()
const sessionStore = useSessionStore()

const drawerVisible = ref(false)
const autoScroll = ref(true)
const entries = ref<DebugLogEntry[]>([])
const errorMessage = ref('')
const connectionStatus = ref<DebugConnectionStatus>('idle')
const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
const logContainerRef = ref<HTMLElement | null>(null)

let disconnectStream: null | (() => void) = null
let activeStreamId = 0
const enableDebugDrawer = import.meta.env.VITE_ENABLE_DEBUG_DRAWER === 'true'

const shouldShow = computed(
  () =>
    enableDebugDrawer &&
    sessionStore.isAuthenticated &&
    sessionStore.isAdmin &&
    route.name !== 'login'
)

const drawerWidth = computed(() => {
  if (viewportWidth.value <= 768) {
    return Math.max(viewportWidth.value - 16, 320)
  }

  return 720
})

const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connecting':
      return '连接中'
    case 'connected':
      return '实时同步中'
    case 'error':
      return '连接异常'
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

const channelLabel = computed(() => {
  const channelId = sessionStore.selectedChannelId || sessionStore.currentChannel?.id || ''
  const matchedChannel = sessionStore.availableChannels.find(channel => channel.id === channelId)
  return matchedChannel ? `当前渠道：${matchedChannel.name}` : '当前渠道：未选择'
})

function syncViewportWidth() {
  if (typeof window === 'undefined') {
    return
  }

  viewportWidth.value = window.innerWidth
}

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
  entries.value = []
}

function scrollToBottom() {
  const container = logContainerRef.value
  if (!container || !autoScroll.value) {
    return
  }

  container.scrollTop = container.scrollHeight
}

function appendEntry(entry: DebugLogEntry) {
  entries.value = [...entries.value, entry].slice(-MAX_VISIBLE_ENTRIES)
}

function stopStream(resetStatus = true) {
  activeStreamId += 1
  disconnectStream?.()
  disconnectStream = null

  if (resetStatus) {
    connectionStatus.value = 'idle'
  }
}

function startStream() {
  stopStream(false)
  errorMessage.value = ''
  connectionStatus.value = 'connecting'
  const streamId = activeStreamId

  disconnectStream = connectDebugLogStream({
    limit: 200,
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
    },
    onSnapshot: snapshot => {
      if (streamId !== activeStreamId) {
        return
      }

      entries.value = snapshot.slice(-MAX_VISIBLE_ENTRIES)
      void nextTick(() => {
        scrollToBottom()
      })
    },
    onLog: entry => {
      if (streamId !== activeStreamId) {
        return
      }

      appendEntry(entry)
    },
    onError: error => {
      if (streamId !== activeStreamId) {
        return
      }

      errorMessage.value = error.message
      connectionStatus.value = 'error'
    },
  })
}

watch(drawerVisible, visible => {
  if (visible) {
    startStream()
    return
  }

  stopStream()
})

watch(
  () => sessionStore.selectedChannelId,
  () => {
    if (drawerVisible.value) {
      startStream()
    }
  }
)

watch(
  () => entries.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

watch(shouldShow, visible => {
  if (!visible) {
    drawerVisible.value = false
    entries.value = []
    stopStream()
  }
})

onMounted(() => {
  if (typeof window === 'undefined') {
    return
  }

  syncViewportWidth()
  window.addEventListener('resize', syncViewportWidth)
})

onBeforeUnmount(() => {
  stopStream()
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncViewportWidth)
  }
})
</script>

<style scoped>
.debug-fab {
  position: fixed;
  right: 24px;
  bottom: 96px;
  z-index: 1200;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
}

.debug-console {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.debug-console__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.debug-console__summary {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: #475569;
  font-size: 13px;
}

.debug-console__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.debug-console__switch-label {
  color: #64748b;
  font-size: 12px;
}

.debug-console__error {
  border-radius: 12px;
}

.debug-console__log-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.08), transparent 30%),
    linear-gradient(180deg, #0f172a 0%, #111827 100%);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.15);
}

.debug-console__log-item {
  display: grid;
  grid-template-columns: 72px 56px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.55;
}

.debug-console__log-item:last-child {
  border-bottom: none;
}

.debug-console__log-item--warn .debug-console__level {
  color: #fbbf24;
}

.debug-console__log-item--error .debug-console__level {
  color: #f87171;
}

.debug-console__log-item--info .debug-console__level {
  color: #38bdf8;
}

.debug-console__time {
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.debug-console__level {
  color: #34d399;
  font-weight: 600;
}

.debug-console__message {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
}

.debug-console__empty {
  display: flex;
  flex: 1;
  min-height: 240px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: #64748b;
  border: 1px dashed rgba(148, 163, 184, 0.45);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(241, 245, 249, 0.95));
}

.debug-console__empty-icon {
  font-size: 28px;
}

@media (max-width: 640px) {
  .debug-fab {
    right: 16px;
    bottom: 84px;
  }

  .debug-console__log-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
