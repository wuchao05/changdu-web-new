<template>
  <div class="scheduler-overview-page">
    <header class="scheduler-overview-page__header">
      <div class="scheduler-overview-page__title-wrap">
        <div class="scheduler-overview-page__title-top">
          <n-button text class="scheduler-overview-page__back" @click="handleBack">
            <template #icon>
              <Icon icon="mdi:arrow-left" />
            </template>
            返回
          </n-button>
          <span class="scheduler-overview-page__eyebrow">管理员工具</span>
        </div>

        <div class="scheduler-overview-page__title-block">
          <h1 class="scheduler-overview-page__title">轮询任务总览</h1>
          <p class="scheduler-overview-page__subtitle">
            展示全部用户在全部渠道下的自动提交、后台搭建和素材预览状态。
          </p>
        </div>
      </div>

      <div class="scheduler-overview-page__actions-card">
        <div class="scheduler-overview-page__status-row">
          <div class="scheduler-overview-page__metric">
            <span class="scheduler-overview-page__metric-label">用户渠道组</span>
            <strong class="scheduler-overview-page__metric-value">{{ summary.totalGroups }}</strong>
          </div>

          <div class="scheduler-overview-page__metric">
            <span class="scheduler-overview-page__metric-label">异常分组</span>
            <strong class="scheduler-overview-page__metric-value scheduler-overview-page__metric-value--danger">
              {{ summary.abnormalGroups }}
            </strong>
          </div>

          <div class="scheduler-overview-page__metric">
            <span class="scheduler-overview-page__metric-label">运行中分组</span>
            <strong class="scheduler-overview-page__metric-value">{{ summary.runningGroups }}</strong>
          </div>

          <div class="scheduler-overview-page__metric">
            <span class="scheduler-overview-page__metric-label">已启用任务</span>
            <strong class="scheduler-overview-page__metric-value">{{ summary.enabledTasks }}</strong>
          </div>
        </div>

        <div class="scheduler-overview-page__toolbar">
          <div class="scheduler-overview-page__status">
            <span class="scheduler-overview-page__status-label">刷新策略</span>
            <n-tag size="small" type="info" round>每 10 秒自动刷新</n-tag>
          </div>

          <div class="scheduler-overview-page__status">
            <span class="scheduler-overview-page__status-label">最近刷新</span>
            <span class="scheduler-overview-page__status-value">
              {{ updatedAtText || '尚未加载' }}
            </span>
          </div>

          <n-button
            class="scheduler-overview-page__action-button"
            :loading="refreshing"
            @click="handleManualRefresh"
          >
            <template #icon>
              <Icon icon="mdi:refresh" />
            </template>
            立即刷新
          </n-button>
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
        v-else-if="!items.length"
        description="当前还没有可展示的轮询任务分组"
        class="scheduler-overview-page__empty"
      />

      <div v-else class="scheduler-overview-page__grid">
        <n-card
          v-for="item in items"
          :key="`${item.userId}-${item.channelId}`"
          class="scheduler-card"
          :bordered="false"
        >
          <template #header>
            <div class="scheduler-card__header">
              <div class="scheduler-card__title-block">
                <div class="scheduler-card__title-row">
                  <h2 class="scheduler-card__title">{{ item.runtimeUserName }}</h2>
                  <n-tag size="small" :type="item.summary.hasAbnormal ? 'error' : 'success'" round>
                    {{ item.summary.hasAbnormal ? `异常 ${item.summary.abnormalCount}` : '整体正常' }}
                  </n-tag>
                </div>
                <p class="scheduler-card__subtitle">
                  账号：{{ item.account || '-' }} ｜ 渠道：{{ item.channelName }}
                </p>
              </div>

              <div class="scheduler-card__summary">
                <span>运行中 {{ item.summary.runningCount }}</span>
                <span>已启用 {{ item.summary.enabledCount }}</span>
              </div>
            </div>
          </template>

          <div class="scheduler-card__task-list">
            <section
              v-for="task in getTaskList(item)"
              :key="task.key"
              class="task-panel"
              :class="{ 'task-panel--abnormal': task.isAbnormal }"
            >
              <div class="task-panel__head">
                <div>
                  <h3 class="task-panel__title">{{ task.title }}</h3>
                  <p class="task-panel__meta">
                    上次运行：{{ task.lastRunTimeText || '暂无' }} ｜ 下次运行：{{
                      task.nextRunTimeText || '暂无'
                    }}
                  </p>
                </div>

                <div class="task-panel__tags">
                  <n-tag size="small" :type="task.enabled ? 'success' : 'default'" round>
                    {{ task.enabled ? '已启用' : '未启用' }}
                  </n-tag>
                  <n-tag size="small" :type="task.running ? 'warning' : 'default'" round>
                    {{ task.running ? '运行中' : '空闲' }}
                  </n-tag>
                  <n-tag size="small" :type="task.isAbnormal ? 'error' : 'success'" round>
                    {{ task.isAbnormal ? '异常' : '正常' }}
                  </n-tag>
                </div>
              </div>

              <div class="task-panel__detail-grid">
                <div class="task-panel__detail-item">
                  <span class="task-panel__detail-label">轮询间隔</span>
                  <span class="task-panel__detail-value">{{ formatInterval(task) }}</span>
                </div>

                <div class="task-panel__detail-item">
                  <span class="task-panel__detail-label">当前任务</span>
                  <span class="task-panel__detail-value">{{ formatCurrentTask(task) }}</span>
                </div>

                <div class="task-panel__detail-item">
                  <span class="task-panel__detail-label">核心统计</span>
                  <span class="task-panel__detail-value">{{ formatTaskStats(task) }}</span>
                </div>

                <div class="task-panel__detail-item">
                  <span class="task-panel__detail-label">补充信息</span>
                  <span class="task-panel__detail-value">{{ formatTaskExtra(task) }}</span>
                </div>
              </div>

              <div v-if="task.isAbnormal" class="task-panel__abnormal">
                <span class="task-panel__abnormal-label">异常原因</span>
                <div class="task-panel__abnormal-list">
                  <span
                    v-for="reason in task.abnormalReasons"
                    :key="reason"
                    class="task-panel__abnormal-chip"
                  >
                    {{ reason }}
                  </span>
                </div>
              </div>

              <div v-if="getTaskHistory(task).length" class="task-panel__history">
                <span class="task-panel__history-label">最近记录</span>
                <div class="task-panel__history-list">
                  <span
                    v-for="history in getTaskHistory(task)"
                    :key="history"
                    class="task-panel__history-item"
                  >
                    {{ history }}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </n-card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NCard, NEmpty, NSpin, NTag } from 'naive-ui'
import {
  getSchedulerOverview,
  type SchedulerOverviewAutoSubmitTask,
  type SchedulerOverviewBuildWorkflowTask,
  type SchedulerOverviewItem,
  type SchedulerOverviewMaterialPreviewTask,
  type SchedulerOverviewResponse,
} from '@/api/admin'

defineOptions({
  name: 'SchedulerOverviewView',
})

type SchedulerOverviewTask =
  | SchedulerOverviewAutoSubmitTask
  | SchedulerOverviewBuildWorkflowTask
  | SchedulerOverviewMaterialPreviewTask

const REFRESH_INTERVAL_MS = 10_000

const router = useRouter()
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
const overview = ref<SchedulerOverviewResponse | null>(null)

let refreshTimer: number | null = null
let requestPending = false

const items = computed(() => overview.value?.items || [])
const summary = computed(
  () =>
    overview.value?.summary || {
      totalGroups: 0,
      abnormalGroups: 0,
      runningGroups: 0,
      enabledTasks: 0,
    }
)
const updatedAtText = computed(() => formatTime(overview.value?.updatedAt || null))

function getTaskList(item: SchedulerOverviewItem): SchedulerOverviewTask[] {
  return [item.tasks.autoSubmit, item.tasks.buildWorkflow, item.tasks.materialPreview]
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
    if (task.progress.currentDrama) {
      return `${task.progress.currentDrama}（${task.progress.current}/${task.progress.total || 0}）`
    }
    return task.running ? '自动提交运行中' : '无'
  }

  if (task.key === 'buildWorkflow') {
    return task.currentTask?.dramaName || (task.running ? '后台搭建运行中' : '无')
  }

  return task.running ? `素材预览执行中（开始于 ${task.lastRunTimeText || '未知'}）` : '无'
}

function formatTaskStats(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return `处理 ${task.stats.totalProcessed}，成功 ${task.stats.successCount}，失败 ${task.stats.failCount}，跳过 ${task.stats.skipCount}`
  }

  if (task.key === 'buildWorkflow') {
    return `累计 ${task.stats.totalBuilt}，成功 ${task.stats.successCount}，失败 ${task.stats.failCount}`
  }

  return `处理 ${task.stats.totalProcessed}，预览 ${task.stats.totalPreviewed}，删除 ${task.stats.totalDeleted}`
}

function formatTaskExtra(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return task.onlyRedFlag ? '仅红标剧模式' : '处理全部剧集'
  }

  if (task.key === 'buildWorkflow') {
    return task.tableId ? `状态表：${task.tableId}` : '使用默认状态表'
  }

  return `时间窗口：前 ${task.buildTimeWindowStart} 分钟到后 ${task.buildTimeWindowEnd} 分钟`
}

function getTaskHistory(task: SchedulerOverviewTask) {
  if (task.key === 'autoSubmit') {
    return task.taskHistory
      .slice(0, 2)
      .map(record => {
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
    overview.value = await getSchedulerOverview()
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
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 34%),
    linear-gradient(180deg, #f8fbff 0%, #f5f7fb 46%, #eef2f7 100%);
  color: #0f172a;
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
  gap: 14px;
  max-width: 560px;
}

.scheduler-overview-page__title-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scheduler-overview-page__back {
  color: #475569;
}

.scheduler-overview-page__eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
}

.scheduler-overview-page__title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scheduler-overview-page__title {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
}

.scheduler-overview-page__subtitle {
  margin: 0;
  color: #475569;
  line-height: 1.7;
}

.scheduler-overview-page__actions-card {
  min-width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
}

.scheduler-overview-page__status-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.scheduler-overview-page__metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  background: #f8fafc;
}

.scheduler-overview-page__metric-label {
  font-size: 12px;
  color: #64748b;
}

.scheduler-overview-page__metric-value {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.scheduler-overview-page__metric-value--danger {
  color: #dc2626;
}

.scheduler-overview-page__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.scheduler-overview-page__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: #f8fafc;
}

.scheduler-overview-page__status-label {
  font-size: 12px;
  color: #64748b;
}

.scheduler-overview-page__status-value {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.scheduler-overview-page__action-button {
  margin-left: auto;
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
  gap: 20px;
}

.scheduler-card {
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
}

.scheduler-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.scheduler-card__title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scheduler-card__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.scheduler-card__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.scheduler-card__subtitle {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.scheduler-card__summary {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: #f8fafc;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.scheduler-card__task-list {
  display: grid;
  gap: 14px;
}

.task-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 18px 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.82), rgba(255, 255, 255, 0.96));
}

.task-panel--abnormal {
  border-color: rgba(239, 68, 68, 0.25);
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.82), rgba(255, 255, 255, 0.96));
}

.task-panel__head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.task-panel__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.task-panel__meta {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.task-panel__tags {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.task-panel__detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.task-panel__detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.task-panel__detail-label {
  font-size: 12px;
  color: #64748b;
}

.task-panel__detail-value {
  color: #1e293b;
  font-size: 13px;
  line-height: 1.6;
}

.task-panel__abnormal,
.task-panel__history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-panel__abnormal-label,
.task-panel__history-label {
  font-size: 12px;
  color: #64748b;
}

.task-panel__abnormal-list,
.task-panel__history-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-panel__abnormal-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.1);
  color: #b91c1c;
  font-size: 12px;
}

.task-panel__history-item {
  padding: 7px 10px;
  border-radius: 12px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .scheduler-overview-page__header,
  .scheduler-overview-page__body {
    padding-left: 18px;
    padding-right: 18px;
  }

  .scheduler-overview-page__status-row,
  .task-panel__detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .scheduler-overview-page__action-button {
    margin-left: 0;
  }
}
</style>
