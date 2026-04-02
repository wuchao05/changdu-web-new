<template>
  <div class="scheduler-overview-page">
    <div class="scheduler-overview-page__noise" />
    <div class="scheduler-overview-page__aurora scheduler-overview-page__aurora--left" />
    <div class="scheduler-overview-page__aurora scheduler-overview-page__aurora--right" />
    <div class="scheduler-overview-page__ring" />
    <div class="scheduler-overview-page__beam scheduler-overview-page__beam--left" />
    <div class="scheduler-overview-page__beam scheduler-overview-page__beam--right" />

    <header class="scheduler-overview-page__header">
      <div class="scheduler-overview-page__title-wrap">
        <div class="scheduler-overview-page__title-top">
          <n-button text class="scheduler-overview-page__back" @click="handleBack">
            <template #icon>
              <Icon icon="mdi:arrow-left" />
            </template>
            返回
          </n-button>
          <span class="scheduler-overview-page__eyebrow">监控面板</span>
        </div>

        <div class="scheduler-overview-page__title-block">
          <h1 class="scheduler-overview-page__title">轮询任务总览</h1>
          <p class="scheduler-overview-page__subtitle">
            现在按用户聚合全部渠道节点，每张卡片集中展示该用户的自动提交、后台搭建和素材预览状态。
          </p>
        </div>

        <div class="scheduler-overview-page__live-strip">
          <span class="scheduler-overview-page__live-dot" />
          <span>实时链路在线</span>
          <span class="scheduler-overview-page__live-divider" />
          <button
            type="button"
            class="scheduler-overview-page__live-filter"
            :class="{
              'scheduler-overview-page__live-filter--active': abnormalOnly,
              'scheduler-overview-page__live-filter--disabled': !dashboardSummary.abnormalUsers,
            }"
            :disabled="!dashboardSummary.abnormalUsers"
            @click="toggleAbnormalOnly"
          >
            异常用户 {{ dashboardSummary.abnormalUsers }}
          </button>
        </div>
      </div>

      <div class="scheduler-overview-page__actions-card">
        <div class="scheduler-overview-page__toolbar">
          <div class="scheduler-overview-page__toolbar-primary">
            <div class="scheduler-overview-page__filter">
              <span class="scheduler-overview-page__filter-label">监控用户</span>
              <n-select
                :value="selectedUserId || ''"
                :options="userSelectOptions"
                :theme-overrides="selectThemeOverrides"
                filterable
                clearable
                placeholder="查看指定用户"
                class="scheduler-overview-page__filter-select"
                @update:value="handleUserFilterChange"
              />
            </div>

            <button
              type="button"
              class="scheduler-overview-page__refresh-button"
              :class="{ 'scheduler-overview-page__refresh-button--spinning': refreshing }"
              :disabled="refreshing"
              @click="handleManualRefresh"
            >
              <span class="scheduler-overview-page__refresh-icon">
                <Icon icon="mdi:refresh" />
              </span>
              <span>{{ refreshing ? '同步中...' : '立即刷新' }}</span>
            </button>
          </div>

          <div class="scheduler-overview-page__toolbar-meta">
            <div class="scheduler-overview-page__status">
              <span class="scheduler-overview-page__status-label">刷新策略</span>
              <span class="scheduler-overview-page__status-value">每 10 秒自动同步</span>
            </div>

            <div class="scheduler-overview-page__status">
              <span class="scheduler-overview-page__status-label">最近刷新</span>
              <span class="scheduler-overview-page__status-value">
                {{ updatedAtText || '尚未加载' }}
              </span>
            </div>

            <div class="scheduler-overview-page__status">
              <span class="scheduler-overview-page__status-label">已启用任务</span>
              <span class="scheduler-overview-page__status-value">
                {{ dashboardSummary.enabledTasks }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="scheduler-overview-page__body">
      <n-alert
        v-if="errorMessage"
        type="error"
        :show-icon="false"
        class="scheduler-overview-page__alert"
      >
        {{ errorMessage }}
      </n-alert>

      <div v-if="loading" class="scheduler-overview-page__loading">
        <n-spin size="large" />
      </div>

      <n-empty
        v-else-if="!displayUserGroups.length"
        description="当前还没有可展示的轮询任务"
        class="scheduler-overview-page__empty"
      />

      <div v-else class="scheduler-overview-page__grid">
        <article
          v-for="(group, groupIndex) in displayUserGroups"
          :key="group.userId"
          class="user-monitor-card"
          :class="{
            'user-monitor-card--abnormal': group.summary.hasAbnormal,
            'user-monitor-card--running': !group.summary.hasAbnormal && group.summary.hasRunning,
            'user-monitor-card--wide': group.summary.channelCount > 1,
          }"
          :style="{ '--panel-delay': `${groupIndex * 80}ms` }"
        >
          <div class="user-monitor-card__scan" />

          <header class="user-monitor-card__header">
            <div class="user-monitor-card__identity">
              <span
                class="user-monitor-card__pulse"
                :class="{
                  'user-monitor-card__pulse--danger': group.summary.hasAbnormal,
                  'user-monitor-card__pulse--running':
                    !group.summary.hasAbnormal && group.summary.hasRunning,
                }"
              />

              <div class="user-monitor-card__title-block">
                <div class="user-monitor-card__title-row">
                  <h2 class="user-monitor-card__title">{{ group.runtimeUserName }}</h2>
                  <span
                    class="user-monitor-card__badge"
                    :class="{
                      'user-monitor-card__badge--danger': group.summary.hasAbnormal,
                      'user-monitor-card__badge--running':
                        !group.summary.hasAbnormal && group.summary.hasRunning,
                    }"
                  >
                    {{ getUserStatusText(group) }}
                  </span>
                </div>
                <p class="user-monitor-card__subtitle">账号：{{ group.account || '-' }}</p>
              </div>
            </div>

            <div class="user-monitor-card__stats">
              <span class="user-monitor-card__stat">渠道 {{ group.summary.channelCount }}</span>
              <span class="user-monitor-card__stat">启用 {{ group.summary.enabledCount }}</span>
              <span class="user-monitor-card__stat">异常 {{ group.summary.abnormalCount }}</span>
            </div>
          </header>

          <p class="user-monitor-card__headline">{{ getUserHeadline(group) }}</p>

          <div
            class="user-monitor-card__channel-grid"
            :class="{ 'user-monitor-card__channel-grid--multi': group.summary.channelCount > 1 }"
          >
            <section
              v-for="(channel, channelIndex) in group.channels"
              :key="channel.channelId"
              class="channel-panel"
              :class="{
                'channel-panel--abnormal': channel.summary.hasAbnormal,
                'channel-panel--running':
                  !channel.summary.hasAbnormal && channel.summary.runningCount > 0,
              }"
              :style="{ '--channel-delay': `${groupIndex * 80 + channelIndex * 50}ms` }"
            >
              <header class="channel-panel__header">
                <div>
                  <span class="channel-panel__eyebrow">渠道节点</span>
                  <h3 class="channel-panel__title">{{ channel.channelName }}</h3>
                </div>
                <div class="channel-panel__status">
                  <span class="channel-panel__status-dot" />
                  {{ getChannelStatusText(channel) }}
                </div>
              </header>

              <div class="channel-panel__summary">
                <div class="channel-panel__summary-item">
                  <span class="channel-panel__summary-label">启用</span>
                  <strong class="channel-panel__summary-value">{{
                    channel.summary.enabledCount
                  }}</strong>
                </div>
                <div class="channel-panel__summary-item">
                  <span class="channel-panel__summary-label">运行</span>
                  <strong class="channel-panel__summary-value">{{
                    channel.summary.runningCount
                  }}</strong>
                </div>
                <div class="channel-panel__summary-item">
                  <span class="channel-panel__summary-label">异常</span>
                  <strong class="channel-panel__summary-value">{{
                    channel.summary.abnormalCount
                  }}</strong>
                </div>
              </div>

              <div class="channel-panel__task-grid">
                <article
                  v-for="task in channel.taskList"
                  :key="task.key"
                  class="task-monitor"
                  :class="getTaskStateClass(task)"
                >
                  <div class="task-monitor__head">
                    <div class="task-monitor__title-block">
                      <h4 class="task-monitor__title">{{ task.title }}</h4>
                      <p class="task-monitor__time">
                        上次运行：{{ task.lastRunTimeText || '暂无' }}
                      </p>
                    </div>
                    <span class="task-monitor__state">{{ getTaskStateText(task) }}</span>
                  </div>

                  <div class="task-monitor__fact-grid">
                    <div class="task-monitor__fact">
                      <span class="task-monitor__fact-label">轮询间隔</span>
                      <span class="task-monitor__fact-value">{{ formatInterval(task) }}</span>
                    </div>
                    <div class="task-monitor__fact">
                      <span class="task-monitor__fact-label">{{ getSecondFactLabel(task) }}</span>
                      <span class="task-monitor__fact-value">{{ formatCurrentTask(task) }}</span>
                    </div>
                    <div class="task-monitor__fact">
                      <span class="task-monitor__fact-label">核心统计</span>
                      <span class="task-monitor__fact-value">{{ formatTaskStats(task) }}</span>
                    </div>
                    <div class="task-monitor__fact">
                      <span class="task-monitor__fact-label">{{ getFourthFactLabel(task) }}</span>
                      <span class="task-monitor__fact-value">{{ formatTaskExtra(task) }}</span>
                    </div>
                  </div>

                  <div
                    v-if="task.isAbnormal && task.abnormalReasons.length"
                    class="task-monitor__alerts"
                  >
                    <span
                      v-for="reason in task.abnormalReasons.slice(0, 2)"
                      :key="reason"
                      class="task-monitor__alert-chip"
                    >
                      {{ reason }}
                    </span>
                  </div>

                  <p v-else-if="getTaskLatestRecord(task)" class="task-monitor__history">
                    {{ getTaskLatestRecord(task) }}
                  </p>
                </article>
              </div>
            </section>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NEmpty, NSelect, NSpin } from 'naive-ui'
import {
  getSchedulerOverview,
  type SchedulerOverviewAutoSubmitTask,
  type SchedulerOverviewBuildWorkflowTask,
  type SchedulerOverviewItem,
  type SchedulerOverviewMaterialPreviewTask,
  type SchedulerOverviewResponse,
  type SchedulerOverviewUserGroup,
} from '@/api/admin'

defineOptions({
  name: 'SchedulerOverviewView',
})

type SchedulerOverviewTask =
  | SchedulerOverviewAutoSubmitTask
  | SchedulerOverviewBuildWorkflowTask
  | SchedulerOverviewMaterialPreviewTask

interface SchedulerChannelGroup extends SchedulerOverviewItem {
  taskList: SchedulerOverviewTask[]
}

const REFRESH_INTERVAL_MS = 10_000

const router = useRouter()
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
const overview = ref<SchedulerOverviewResponse | null>(null)
const selectedUserId = ref<string | null>(null)
const abnormalOnly = ref(false)

let refreshTimer: number | null = null
let requestPending = false

const userGroups = computed<SchedulerOverviewUserGroup[]>(() => overview.value?.users || [])
const displayUserGroups = computed(() => {
  const visibleGroups = abnormalOnly.value
    ? userGroups.value.filter(group => group.summary.hasAbnormal)
    : userGroups.value

  return visibleGroups.map(group => ({
    ...group,
    channels: group.channels.map(channel => ({
      ...channel,
      taskList: getTaskList(channel),
    })),
  }))
})
const updatedAtText = computed(() => formatTime(overview.value?.updatedAt || null))
const dashboardSummary = computed(
  () =>
    overview.value?.summary || {
      totalUsers: 0,
      totalChannels: 0,
      abnormalUsers: 0,
      runningTasks: 0,
      enabledTasks: 0,
    }
)
const userSelectOptions = computed(() => [
  { label: '全部用户', value: '' },
  ...(overview.value?.userOptions || []).map(user => ({
    label: user.account ? `${user.runtimeUserName}（${user.account}）` : user.runtimeUserName,
    value: user.userId,
  })),
])
const selectThemeOverrides = {
  borderRadius: '16px',
  peers: {
    InternalSelection: {
      color: 'rgba(7, 18, 32, 0.92)',
      textColor: '#e7fbff',
      placeholderColor: 'rgba(193, 235, 255, 0.42)',
      caretColor: '#8af5ff',
      border: '1px solid rgba(66, 214, 255, 0.18)',
      borderHover: '1px solid rgba(103, 232, 249, 0.55)',
      borderFocus: '1px solid rgba(110, 231, 255, 0.7)',
      boxShadowFocus: '0 0 0 2px rgba(34, 211, 238, 0.18)',
      colorActive: 'rgba(8, 24, 42, 0.98)',
      textColorDisabled: 'rgba(193, 235, 255, 0.32)',
    },
    InternalSelectMenu: {
      color: 'rgba(6, 18, 32, 0.98)',
      optionTextColor: '#dff7ff',
      optionTextColorPending: '#f3feff',
      optionTextColorActive: '#f3feff',
      optionColorPending: 'rgba(34, 211, 238, 0.16)',
      optionColorActive: 'rgba(45, 212, 191, 0.14)',
      optionColorActivePending:
        'linear-gradient(90deg, rgba(103, 232, 249, 0.92), rgba(45, 212, 191, 0.92))',
      optionCheckColor: '#34d399',
      groupHeaderTextColor: 'rgba(193, 235, 255, 0.52)',
      dividerColor: 'rgba(56, 189, 248, 0.12)',
      boxShadow: '0 20px 40px rgba(2, 8, 23, 0.55)',
      borderRadius: '18px',
    },
  },
} as const

function getTaskList(item: SchedulerOverviewItem): SchedulerOverviewTask[] {
  return [item.tasks.buildWorkflow, item.tasks.materialPreview, item.tasks.autoSubmit]
}

function formatTime(value: string | null) {
  if (!value) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatInterval(task: SchedulerOverviewTask) {
  if (!task.intervalMinutes) {
    return '未配置'
  }
  return `${task.intervalMinutes} 分钟`
}

function formatCurrentTask(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return task.submissionType
  }

  if (task.key === 'buildWorkflow') {
    return String(task.stats.pendingCount || 0)
  }

  return task.running ? '执行中' : '待机'
}

function formatTaskStats(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return `处理 ${task.stats.totalProcessed}，成功 ${task.stats.successCount}，失败 ${task.stats.failCount}，跳过 ${task.stats.skipCount}`
  }

  if (task.key === 'buildWorkflow') {
    return `累计 ${task.stats.totalBuilt}，成功 ${task.stats.successCount}，失败 ${task.stats.failCount}`
  }

  return `预览 ${task.stats.totalPreviewed}，删除 ${task.stats.totalDeleted}`
}

function formatTaskExtra(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return task.runningDurationText
  }

  if (task.key === 'buildWorkflow') {
    return String(task.stats.buildableCount || 0)
  }

  return `前 ${task.buildTimeWindowStart} 分钟到后 ${task.buildTimeWindowEnd} 分钟`
}

function getSecondFactLabel(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return '提交类型'
  }
  if (task.key === 'buildWorkflow') {
    return '待搭建剧'
  }
  return '当前状态'
}

function getFourthFactLabel(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return '运行时长'
  }
  if (task.key === 'buildWorkflow') {
    return '可搭建剧'
  }
  return '时间窗口'
}

function getTaskHistory(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return task.taskHistory.slice(0, 2).map(record => {
      const timeText = record.timestamp || '未知时间'
      if (record.status === 'error') {
        return `${timeText} 执行失败：${record.error || '未知错误'}`
      }
      return `${timeText} 完成 ${record.processed || 0} 部，成功 ${record.success || 0} 部`
    })
  }

  if (task.key === 'buildWorkflow') {
    return task.taskHistory.slice(0, 2).map(record => {
      const timeText = formatTime(record.completedAt) || '未知时间'
      const suffix = record.error ? `：${record.error}` : ''
      return `${timeText} ${record.dramaName} ${record.status}${suffix}`
    })
  }

  if (task.lastError) {
    return [`最近错误：${task.lastError}`]
  }

  if (task.lastStatus) {
    return [`最近结果：${task.lastStatus === 'success' ? '成功' : '失败'}`]
  }

  return []
}

function getTaskLatestRecord(task: SchedulerOverviewTask) {
  return getTaskHistory(task)[0] || ''
}

function getTaskStateText(task: SchedulerOverviewTask) {
  if (task.isAbnormal) {
    return '告警'
  }
  if (task.running) {
    return '运行中'
  }
  if (task.enabled) {
    return '已布防'
  }
  return '待机'
}

function getTaskStateClass(task: SchedulerOverviewTask) {
  if (task.isAbnormal) {
    return 'task-monitor--abnormal'
  }
  if (task.running) {
    return 'task-monitor--running'
  }
  if (task.enabled) {
    return 'task-monitor--enabled'
  }
  return 'task-monitor--idle'
}

function getUserStatusText(group: SchedulerOverviewUserGroup) {
  if (group.summary.hasAbnormal) {
    return `异常 ${group.summary.abnormalCount}`
  }
  if (group.summary.hasRunning) {
    return `运行中 ${group.summary.runningCount}`
  }
  return '状态稳定'
}

function getUserHeadline(group: SchedulerOverviewUserGroup) {
  if (group.summary.hasAbnormal) {
    return `当前有 ${group.summary.abnormalChannels} 个渠道节点出现告警，建议优先排查最近执行失败的任务。`
  }
  if (group.summary.hasRunning) {
    return `该用户的 ${group.summary.runningCount} 个任务正在持续执行，所有渠道已收拢在同一张监控卡片中。`
  }
  if (group.summary.enabledCount > 0) {
    return `当前暂无执行中的轮询，但已有 ${group.summary.enabledCount} 个任务处于启用待命状态。`
  }
  return '该用户下的全部渠道节点当前均未启用自动任务。'
}

function getChannelStatusText(channel: SchedulerChannelGroup) {
  if (channel.summary.hasAbnormal) {
    return `告警 ${channel.summary.abnormalCount}`
  }
  if (channel.summary.runningCount > 0) {
    return `运行中 ${channel.summary.runningCount}`
  }
  if (channel.summary.enabledCount > 0) {
    return `已启用 ${channel.summary.enabledCount}`
  }
  return '空闲'
}

function clearRefreshTimer() {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function startRefreshTimer() {
  clearRefreshTimer()
  refreshTimer = window.setInterval(() => {
    void fetchOverview({ silent: true })
  }, REFRESH_INTERVAL_MS)
}

async function fetchOverview(options: { silent?: boolean } = {}) {
  if (requestPending) {
    return
  }

  requestPending = true
  if (options.silent) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  try {
    overview.value = await getSchedulerOverview(selectedUserId.value || undefined)
    selectedUserId.value = overview.value.selectedUserId || null
    errorMessage.value = ''
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = '加载轮询任务总览失败'
    }
  } finally {
    requestPending = false
    loading.value = false
    refreshing.value = false
  }
}

function handleBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.push('/')
}

function handleManualRefresh() {
  void fetchOverview({ silent: true })
}

function toggleAbnormalOnly() {
  if (!dashboardSummary.value.abnormalUsers) {
    return
  }

  abnormalOnly.value = !abnormalOnly.value
}

function handleUserFilterChange(value: string | null) {
  selectedUserId.value = value ? String(value) : null
  void fetchOverview({ silent: true })
}

onMounted(async () => {
  await fetchOverview()
  startRefreshTimer()
})

onBeforeUnmount(() => {
  clearRefreshTimer()
})
</script>

<style scoped>
.scheduler-overview-page {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(34, 211, 238, 0.26), transparent 24%),
    radial-gradient(circle at 85% 12%, rgba(56, 189, 248, 0.22), transparent 22%),
    radial-gradient(circle at 50% 100%, rgba(45, 212, 191, 0.12), transparent 28%),
    linear-gradient(180deg, #071724 0%, #091a2c 38%, #07121f 100%);
  color: #e2f3ff;
}

.scheduler-overview-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(34, 211, 238, 0.06) 1px, transparent 1px),
    linear-gradient(180deg, rgba(34, 211, 238, 0.05) 1px, transparent 1px);
  background-size: 36px 36px;
  opacity: 0.25;
  pointer-events: none;
}

.scheduler-overview-page::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 20%, rgba(103, 232, 249, 0.1), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 24%);
  mix-blend-mode: screen;
  pointer-events: none;
}

.scheduler-overview-page__noise {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 40%),
    repeating-linear-gradient(
      180deg,
      rgba(148, 163, 184, 0.04) 0,
      rgba(148, 163, 184, 0.04) 1px,
      transparent 1px,
      transparent 6px
    );
  mix-blend-mode: screen;
  opacity: 0.65;
  animation: noiseFloat 14s linear infinite;
  pointer-events: none;
}

.scheduler-overview-page__aurora {
  position: absolute;
  border-radius: 999px;
  filter: blur(18px);
  opacity: 0.9;
  pointer-events: none;
}

.scheduler-overview-page__aurora--left {
  left: -10%;
  top: -8%;
  width: 440px;
  height: 440px;
  background: radial-gradient(
    circle,
    rgba(45, 212, 191, 0.18),
    rgba(34, 211, 238, 0.12) 45%,
    transparent 72%
  );
  animation: auroraFloatLeft 14s ease-in-out infinite;
}

.scheduler-overview-page__aurora--right {
  right: -6%;
  top: 10%;
  width: 520px;
  height: 520px;
  background: radial-gradient(
    circle,
    rgba(96, 165, 250, 0.18),
    rgba(34, 211, 238, 0.1) 42%,
    transparent 72%
  );
  animation: auroraFloatRight 16s ease-in-out infinite;
}

.scheduler-overview-page__ring {
  position: absolute;
  right: 10%;
  top: 12%;
  width: 520px;
  height: 520px;
  border-radius: 999px;
  border: 1px solid rgba(103, 232, 249, 0.08);
  box-shadow:
    0 0 0 30px rgba(56, 189, 248, 0.02),
    0 0 0 60px rgba(45, 212, 191, 0.015);
  opacity: 0.9;
  animation: rotateRing 18s linear infinite;
  pointer-events: none;
}

.scheduler-overview-page__ring::before,
.scheduler-overview-page__ring::after {
  content: '';
  position: absolute;
  inset: 20px;
  border-radius: inherit;
  border: 1px dashed rgba(125, 211, 252, 0.08);
}

.scheduler-overview-page__ring::after {
  inset: 60px;
  border-style: solid;
  border-color: rgba(45, 212, 191, 0.08);
}

.scheduler-overview-page__beam {
  position: absolute;
  top: 0;
  width: 34vw;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(103, 232, 249, 0.65), transparent);
  opacity: 0.5;
  pointer-events: none;
}

.scheduler-overview-page__beam--left {
  left: 8%;
  animation: beamSweep 8s linear infinite;
}

.scheduler-overview-page__beam--right {
  right: 4%;
  top: auto;
  bottom: 18%;
  animation: beamSweep 10s linear infinite reverse;
}

.scheduler-overview-page__header,
.scheduler-overview-page__body {
  position: relative;
  z-index: 1;
}

.scheduler-overview-page__header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 32px 20px;
  flex-wrap: wrap;
}

.scheduler-overview-page__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 620px;
}

.scheduler-overview-page__title-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scheduler-overview-page__back {
  color: #d7ecff;
  text-shadow: 0 0 10px rgba(103, 232, 249, 0.18);
}

.scheduler-overview-page__eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid rgba(45, 212, 191, 0.24);
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(8, 22, 36, 0.88), rgba(12, 31, 47, 0.74));
  color: #7dd3fc;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.scheduler-overview-page__title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scheduler-overview-page__title {
  margin: 0;
  font-size: 38px;
  font-weight: 700;
  line-height: 1.08;
  color: #f8fdff;
}

.scheduler-overview-page__subtitle {
  margin: 0;
  color: rgba(196, 225, 255, 0.78);
  line-height: 1.8;
}

.scheduler-overview-page__live-strip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  padding: 10px 14px;
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(7, 23, 36, 0.92), rgba(9, 30, 46, 0.72));
  box-shadow:
    inset 0 0 0 1px rgba(15, 118, 110, 0.18),
    0 0 24px rgba(34, 211, 238, 0.08);
  color: #c9efff;
  font-size: 13px;
  overflow: hidden;
}

.scheduler-overview-page__live-strip::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 15%,
    rgba(103, 232, 249, 0.14) 50%,
    transparent 85%
  );
  transform: translateX(-120%);
  animation: stripShine 4.8s ease-in-out infinite;
  pointer-events: none;
}

.scheduler-overview-page__live-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #2dd4bf;
  box-shadow: 0 0 0 6px rgba(45, 212, 191, 0.14);
  animation: pulse 1.8s ease-in-out infinite;
}

.scheduler-overview-page__live-divider {
  width: 1px;
  height: 12px;
  background: rgba(125, 211, 252, 0.22);
}

.scheduler-overview-page__live-filter {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(125, 211, 252, 0.2);
  border-radius: 999px;
  background: rgba(10, 26, 41, 0.7);
  color: #dff7ff;
  font: inherit;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.scheduler-overview-page__live-filter:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(103, 232, 249, 0.48);
  background: rgba(11, 35, 52, 0.92);
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.16);
}

.scheduler-overview-page__live-filter--active {
  border-color: rgba(251, 113, 133, 0.42);
  background: linear-gradient(90deg, rgba(69, 10, 10, 0.88), rgba(76, 29, 60, 0.82));
  color: #ffe4ea;
  box-shadow: 0 0 20px rgba(251, 113, 133, 0.18);
}

.scheduler-overview-page__live-filter--disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.scheduler-overview-page__actions-card {
  position: relative;
  min-width: min(100%, 640px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(10, 27, 44, 0.88), rgba(7, 23, 36, 0.82)),
    radial-gradient(circle at top right, rgba(34, 211, 238, 0.12), transparent 28%);
  box-shadow:
    0 24px 48px rgba(2, 8, 23, 0.32),
    0 0 40px rgba(34, 211, 238, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.scheduler-overview-page__actions-card::after {
  content: '';
  position: absolute;
  inset: -20% auto auto -30%;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.16), transparent 70%);
  pointer-events: none;
}

.scheduler-overview-page__toolbar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.scheduler-overview-page__toolbar-primary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  min-width: min(100%, 300px);
}

.scheduler-overview-page__toolbar-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex: 1;
  flex-wrap: wrap;
  min-height: 52px;
}

.scheduler-overview-page__filter {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: min(100%, 300px);
  padding: 8px 12px;
  border: 1px solid rgba(66, 214, 255, 0.18);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(8, 22, 38, 0.84), rgba(8, 18, 30, 0.7));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 0 24px rgba(34, 211, 238, 0.05);
}

.scheduler-overview-page__filter-label {
  flex-shrink: 0;
  color: rgba(186, 221, 255, 0.68);
  font-size: 12px;
}

.scheduler-overview-page__filter-select {
  min-width: 180px;
  flex: 1;
}

.scheduler-overview-page__filter-select :deep(.n-base-selection) {
  background: linear-gradient(180deg, rgba(8, 20, 35, 0.98), rgba(8, 18, 30, 0.9)) !important;
  border-color: rgba(66, 214, 255, 0.2) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 20px rgba(34, 211, 238, 0.06);
}

.scheduler-overview-page__filter-select :deep(.n-base-selection:hover) {
  border-color: rgba(103, 232, 249, 0.42) !important;
}

.scheduler-overview-page__filter-select :deep(.n-base-selection-label),
.scheduler-overview-page__filter-select :deep(.n-base-selection-input) {
  color: #e2f3ff !important;
}

.scheduler-overview-page__filter-select :deep(.n-base-selection-placeholder) {
  color: rgba(186, 221, 255, 0.48) !important;
}

.scheduler-overview-page__filter-select :deep(.n-base-suffix),
.scheduler-overview-page__filter-select :deep(.n-base-clear) {
  color: rgba(186, 221, 255, 0.72) !important;
}

.scheduler-overview-page__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(66, 214, 255, 0.14);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(8, 23, 38, 0.82), rgba(7, 20, 32, 0.68));
}

.scheduler-overview-page__status-label {
  font-size: 12px;
  color: rgba(186, 221, 255, 0.62);
}

.scheduler-overview-page__status-value {
  font-size: 13px;
  font-weight: 600;
  color: #dff6ff;
}

.scheduler-overview-page__refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 18px;
  border: 1px solid rgba(110, 231, 255, 0.24);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(7, 31, 47, 0.95), rgba(7, 53, 66, 0.9)),
    radial-gradient(circle at top left, rgba(45, 212, 191, 0.18), transparent 34%);
  box-shadow:
    0 18px 32px rgba(2, 8, 23, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 24px rgba(34, 211, 238, 0.08);
  color: #f4fdff;
  font: inherit;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.scheduler-overview-page__refresh-button:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(125, 211, 252, 0.48);
  box-shadow:
    0 20px 36px rgba(2, 8, 23, 0.32),
    0 0 28px rgba(34, 211, 238, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.scheduler-overview-page__refresh-button:disabled {
  opacity: 0.72;
  cursor: wait;
}

.scheduler-overview-page__refresh-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #8af5ff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.scheduler-overview-page__refresh-button--spinning .scheduler-overview-page__refresh-icon {
  animation: refreshSpin 0.9s linear infinite;
}

.scheduler-overview-page__body {
  padding: 0 32px 32px;
}

.scheduler-overview-page__alert {
  margin-bottom: 20px;
}

.scheduler-overview-page__loading,
.scheduler-overview-page__empty {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scheduler-overview-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 22px;
}

.user-monitor-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  border: 1px solid rgba(56, 189, 248, 0.18);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(10, 28, 44, 0.94), rgba(5, 17, 29, 0.96)),
    linear-gradient(120deg, rgba(45, 212, 191, 0.08), transparent 30%);
  box-shadow:
    0 24px 48px rgba(2, 8, 23, 0.3),
    0 0 34px rgba(34, 211, 238, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
  animation: cardEnter 0.6s ease both;
  animation-delay: var(--panel-delay);
}

.user-monitor-card--wide {
  grid-column: 1 / -1;
}

.user-monitor-card::after {
  content: '';
  position: absolute;
  inset: auto -10% -35% auto;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.14), transparent 72%);
  pointer-events: none;
}

.user-monitor-card--abnormal {
  border-color: rgba(251, 113, 133, 0.28);
  box-shadow:
    0 24px 52px rgba(127, 29, 29, 0.24),
    inset 0 0 0 1px rgba(251, 113, 133, 0.08);
}

.user-monitor-card--running {
  border-color: rgba(45, 212, 191, 0.24);
}

.user-monitor-card__scan {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent, rgba(103, 232, 249, 0.12), transparent);
  transform: translateY(-110%);
  animation: scanDown 5.5s linear infinite;
  pointer-events: none;
}

.user-monitor-card__header {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.user-monitor-card__identity {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.user-monitor-card__pulse {
  width: 12px;
  height: 12px;
  margin-top: 8px;
  border-radius: 999px;
  background: #38bdf8;
  box-shadow: 0 0 0 8px rgba(56, 189, 248, 0.12);
  animation: pulse 1.9s ease-in-out infinite;
}

.user-monitor-card__pulse--danger {
  background: #fb7185;
  box-shadow: 0 0 0 8px rgba(251, 113, 133, 0.14);
}

.user-monitor-card__pulse--running {
  background: #2dd4bf;
  box-shadow: 0 0 0 8px rgba(45, 212, 191, 0.14);
}

.user-monitor-card__title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-monitor-card__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-monitor-card__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #f8fdff;
}

.user-monitor-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 999px;
  background: rgba(8, 19, 31, 0.72);
  color: #a5f3fc;
  font-size: 12px;
  font-weight: 600;
}

.user-monitor-card__badge--danger {
  border-color: rgba(251, 113, 133, 0.28);
  color: #fecdd3;
}

.user-monitor-card__badge--running {
  border-color: rgba(45, 212, 191, 0.28);
  color: #99f6e4;
}

.user-monitor-card__subtitle {
  margin: 0;
  color: rgba(188, 220, 247, 0.72);
  font-size: 13px;
}

.user-monitor-card__stats {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.user-monitor-card__stat {
  display: inline-flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.62);
  color: #d7efff;
  font-size: 12px;
  border: 1px solid rgba(71, 85, 105, 0.34);
}

.user-monitor-card__headline {
  margin: 0;
  color: rgba(206, 231, 255, 0.78);
  line-height: 1.7;
}

.user-monitor-card__channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.user-monitor-card__channel-grid--multi {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
}

.user-monitor-card__channel-grid--multi .channel-panel {
  flex: 1 1 0;
  min-width: 0;
}

.channel-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(56, 189, 248, 0.14);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(11, 26, 42, 0.96), rgba(7, 18, 31, 0.98)),
    radial-gradient(circle at top right, rgba(34, 211, 238, 0.14), transparent 32%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 0 20px rgba(34, 211, 238, 0.04);
  animation: cardEnter 0.6s ease both;
  animation-delay: var(--channel-delay);
}

.channel-panel--abnormal {
  border-color: rgba(251, 113, 133, 0.24);
  background:
    linear-gradient(180deg, rgba(45, 12, 22, 0.78), rgba(17, 9, 16, 0.96)),
    radial-gradient(circle at top right, rgba(251, 113, 133, 0.18), transparent 34%);
}

.channel-panel--running {
  border-color: rgba(45, 212, 191, 0.2);
}

.channel-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.channel-panel__eyebrow {
  display: inline-block;
  margin-bottom: 6px;
  color: rgba(143, 221, 255, 0.56);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.channel-panel__title {
  margin: 0;
  font-size: 18px;
  color: #f8fdff;
}

.channel-panel__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(4, 14, 24, 0.7);
  color: #d5f2ff;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(56, 189, 248, 0.16);
}

.channel-panel__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #38bdf8;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
  animation: pulse 1.6s ease-in-out infinite;
}

.channel-panel__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.channel-panel__summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(4, 14, 24, 0.68);
  border: 1px solid rgba(59, 130, 246, 0.12);
}

.channel-panel__summary-label {
  font-size: 12px;
  color: rgba(191, 219, 254, 0.62);
}

.channel-panel__summary-value {
  font-size: 18px;
  color: #effbff;
}

.channel-panel__task-grid {
  display: grid;
  gap: 10px;
}

.task-monitor {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(71, 85, 105, 0.34);
  background:
    linear-gradient(180deg, rgba(5, 14, 25, 0.94), rgba(4, 12, 22, 0.82)),
    radial-gradient(circle at top right, rgba(34, 211, 238, 0.06), transparent 32%);
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.task-monitor::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: rgba(148, 163, 184, 0.6);
}

.task-monitor--idle::before {
  background: rgba(100, 116, 139, 0.7);
}

.task-monitor--enabled::before {
  background: linear-gradient(180deg, #38bdf8, #2dd4bf);
}

.task-monitor--running::before {
  background: linear-gradient(180deg, #2dd4bf, #67e8f9);
  box-shadow: 0 0 12px rgba(45, 212, 191, 0.38);
}

.task-monitor--abnormal::before {
  background: linear-gradient(180deg, #fb7185, #f97316);
  box-shadow: 0 0 12px rgba(251, 113, 133, 0.34);
}

.task-monitor__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.task-monitor__title-block {
  min-width: 0;
}

.task-monitor__title {
  margin: 0;
  font-size: 15px;
  color: #f8fdff;
}

.task-monitor__time {
  margin: 6px 0 0;
  color: rgba(186, 221, 255, 0.6);
  font-size: 12px;
}

.task-monitor__state {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.74);
  border: 1px solid rgba(56, 189, 248, 0.16);
  color: #d6f6ff;
  font-size: 12px;
  font-weight: 600;
}

.task-monitor__fact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.task-monitor__fact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.46);
}

.task-monitor__fact-label {
  color: rgba(186, 221, 255, 0.58);
  font-size: 11px;
}

.task-monitor__fact-value {
  color: #edf9ff;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.task-monitor__alerts {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-monitor__alert-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(127, 29, 29, 0.46);
  color: #fecdd3;
  font-size: 12px;
  border: 1px solid rgba(251, 113, 133, 0.22);
}

.task-monitor__history {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(8, 19, 31, 0.82);
  color: rgba(196, 235, 255, 0.74);
  font-size: 12px;
  line-height: 1.6;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.16);
    opacity: 0.72;
  }
}

@keyframes scanDown {
  0% {
    transform: translateY(-110%);
  }
  100% {
    transform: translateY(110%);
  }
}

@keyframes cardEnter {
  0% {
    opacity: 0;
    transform: translateY(16px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes noiseFloat {
  0% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -14px, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes auroraFloatLeft {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(40px, 30px, 0) scale(1.08);
  }
}

@keyframes auroraFloatRight {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-36px, 28px, 0) scale(1.06);
  }
}

@keyframes rotateRing {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes beamSweep {
  0% {
    transform: translateX(-12%) scaleX(0.8);
    opacity: 0.18;
  }
  50% {
    transform: translateX(6%) scaleX(1);
    opacity: 0.52;
  }
  100% {
    transform: translateX(18%) scaleX(0.82);
    opacity: 0.16;
  }
}

@keyframes stripShine {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}

@keyframes refreshSpin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 1080px) {
  .scheduler-overview-page__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .scheduler-overview-page__header,
  .scheduler-overview-page__body {
    padding-left: 18px;
    padding-right: 18px;
  }

  .task-monitor__fact-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .channel-panel__summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .scheduler-overview-page__toolbar-meta {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .scheduler-overview-page__title {
    font-size: 30px;
  }

  .scheduler-overview-page__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .user-monitor-card,
  .channel-panel {
    padding: 16px;
  }

  .channel-panel__summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .user-monitor-card--wide {
    grid-column: auto;
  }

  .user-monitor-card__channel-grid--multi {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .user-monitor-card__header,
  .channel-panel__header,
  .task-monitor__head {
    flex-direction: column;
  }

  .scheduler-overview-page__live-strip,
  .scheduler-overview-page__toolbar,
  .scheduler-overview-page__toolbar-primary,
  .scheduler-overview-page__toolbar-meta,
  .scheduler-overview-page__filter,
  .scheduler-overview-page__refresh-button {
    width: 100%;
  }

  .scheduler-overview-page__refresh-button {
    justify-content: center;
  }
}
</style>
