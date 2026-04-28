<template>
  <div class="feishu-panel">
    <div class="feishu-panel__header">
      <div class="feishu-panel__title-wrap">
        <div class="feishu-panel__title">
          <span class="feishu-panel__icon-box">
            <Icon icon="mdi:view-dashboard-outline" class="feishu-panel__icon" />
          </span>
          <span>飞书表格</span>
          <n-tag size="small" :bordered="false" type="info" class="feishu-panel__hint">只读</n-tag>
        </div>
        <p class="feishu-panel__subtitle">
          按日期聚合当前渠道剧目状态，快速查看提交、下载、剪辑和搭建进度
        </p>
      </div>
      <div class="feishu-panel__actions">
        <n-select
          v-if="isAdmin"
          v-model:value="selectedUserId"
          :options="userOptions"
          size="small"
          class="feishu-panel__select"
          filterable
          placeholder="选择用户"
        />
        <n-button
          size="small"
          secondary
          :loading="loading"
          :disabled="!resolvedTableId"
          @click="refresh"
        >
          <template #icon>
            <Icon icon="mdi:refresh" />
          </template>
          刷新
        </n-button>
      </div>
    </div>

    <div class="feishu-panel__body">
      <div class="feishu-panel__toolbar">
        <n-tabs
          v-model:value="selectedDateKey"
          type="segment"
          size="medium"
          animated
          class="feishu-panel__tabs"
        >
          <n-tab-pane
            v-for="tab in dateTabs"
            :key="tab.key"
            :name="tab.key"
            display-directive="show"
          >
            <template #tab>
              <span class="feishu-panel__date-tab">
                <span class="feishu-panel__date-tab-label">{{ tab.label }}</span>
                <span
                  class="feishu-panel__date-tab-count"
                  :class="{
                    'is-active': selectedDateKey === tab.key,
                    'is-zero': dateCounts[tab.key] === 0,
                  }"
                >
                  {{ dateCounts[tab.key] ?? 0 }}
                </span>
              </span>
            </template>
          </n-tab-pane>
        </n-tabs>
        <span class="feishu-panel__summary-total">
          共 <strong>{{ visibleRecords.length }}</strong> 条记录
        </span>
      </div>

      <div v-if="!resolvedTableId" class="feishu-panel__empty">
        <Icon icon="mdi:link-variant-off" class="feishu-panel__empty-icon" />
        <p class="feishu-panel__empty-title">未配置飞书状态表</p>
        <p class="feishu-panel__empty-desc">
          {{
            isAdmin
              ? '所选用户的当前渠道尚未配置剧集状态表 ID'
              : '当前渠道尚未配置剧集状态表 ID,请联系管理员'
          }}
        </p>
      </div>

      <template v-else>
        <n-spin :show="loading">
          <div class="feishu-panel__groups">
            <div v-for="group in groupedRecords" :key="group.status" class="feishu-panel__group">
              <div class="feishu-panel__group-head">
                <n-tag
                  :type="STATUS_TAG_TYPE[group.status] || 'default'"
                  size="small"
                  :bordered="false"
                  round
                >
                  {{ group.status }}
                </n-tag>
                <span class="feishu-panel__group-count">{{ group.records.length }}</span>
              </div>
              <n-data-table
                v-if="group.records.length"
                class="feishu-panel__table"
                size="small"
                :columns="tableColumns"
                :data="group.records"
                :bordered="false"
                :single-line="false"
                :scroll-x="980"
                striped
                :row-key="getRowKey"
              />
              <div v-else class="feishu-panel__group-empty">该状态暂无记录</div>
            </div>

            <div v-if="!loading && groupedRecords.length === 0" class="feishu-panel__empty">
              <Icon icon="mdi:tray-remove" class="feishu-panel__empty-icon" />
              <p class="feishu-panel__empty-title">没有匹配的剧目</p>
              <p class="feishu-panel__empty-desc">该日期下没有处于跟进中状态的剧目</p>
            </div>
          </div>
        </n-spin>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  NButton,
  NDataTable,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  type DataTableColumns,
} from 'naive-ui'
import dayjs from 'dayjs'

import * as adminApi from '@/api/admin'
import { feishuApi } from '@/api/feishu'
import { useApiConfigStore } from '@/stores/apiConfig'
import { useSessionStore } from '@/stores/session'

interface BoardRecord {
  recordId: string
  dramaName: string
  account: string
  publishTime: string
  rating: string
  status: string
  date: string
}

interface DateTab {
  key: string
  label: string
  date: string | null
}

// 关心的状态及顺序
const TARGET_STATUSES = [
  '待提交',
  '待下载',
  '下载中',
  '待剪辑',
  '剪辑中',
  '待上传',
  '上传中',
  '待搭建',
] as const
type TargetStatus = (typeof TARGET_STATUSES)[number]

const STATUS_TAG_TYPE: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  待提交: 'default',
  待下载: 'default',
  下载中: 'info',
  待剪辑: 'default',
  剪辑中: 'info',
  待上传: 'default',
  上传中: 'info',
  待搭建: 'warning',
}

const RATING_TAG_TYPE: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  红标: 'error',
  绿标: 'success',
  黄标: 'warning',
}

const sessionStore = useSessionStore()
const apiConfigStore = useApiConfigStore()

const loading = ref(false)
const records = ref<BoardRecord[]>([])

// 请求代际:Tab 切换时通过 cancelAllRequests() 自增,在途响应回来后丢弃
let requestGeneration = 0

function beginRequest() {
  requestGeneration += 1
  return requestGeneration
}

function isStaleRequest(generation: number) {
  return generation !== requestGeneration
}

function cancelAllRequests() {
  requestGeneration += 1
  loading.value = false
}

// 管理员选择器
const adminUsers = ref<adminApi.UserProfile[]>([])
const selectedUserId = ref('')

const isAdmin = computed(() => sessionStore.isAdmin)

// 用户下拉
const userOptions = computed(() =>
  adminUsers.value.map(user => ({
    label: `${user.nickname || user.account}${user.userType === 'admin' ? ' · 管理员' : ''}`,
    value: user.id,
  }))
)

const selectedUser = computed(() => adminUsers.value.find(user => user.id === selectedUserId.value))

// 解析当前要查询的 tableId:严格按"当前选中的渠道"取
// - 管理员:用面板内选中的用户 + 顶部全局渠道(sessionStore.activeChannelId)
// - 普通用户:直接用 apiConfigStore.config.dramaStatusTableId(已是当前渠道下的)
const resolvedTableId = computed(() => {
  if (isAdmin.value) {
    const user = selectedUser.value
    if (!user) return ''
    const activeChannelId =
      sessionStore.activeChannelId || user.defaultChannelId || user.channelIds?.[0] || ''
    if (!activeChannelId) return ''
    const binding = user.channelConfigs?.[activeChannelId]
    return String(binding?.feishu?.dramaStatusTableId || '').trim()
  }
  return String(apiConfigStore.config.dramaStatusTableId || '').trim()
})

// 日期 Tab：昨天 / 今天 / 明天 / 后天 + 总览
const DATE_OFFSET_LABELS: Record<number, string> = {
  [-1]: '昨天',
  0: '今天',
  1: '明天',
  2: '后天',
}
const dateTabs = computed<DateTab[]>(() => {
  const today = dayjs().startOf('day')
  const tabs: DateTab[] = [{ key: 'overview', label: '总览', date: null }]
  for (const offset of [-1, 0, 1, 2]) {
    const day = today.add(offset, 'day')
    const prefix = DATE_OFFSET_LABELS[offset]
    tabs.push({
      key: day.format('YYYY-MM-DD'),
      label: prefix,
      date: day.format('YYYY-MM-DD'),
    })
  }
  return tabs
})

const selectedDateKey = ref<string>('overview')

const dateCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = { overview: records.value.length }
  for (const tab of dateTabs.value) {
    if (tab.date) {
      counts[tab.key] = records.value.filter(record => record.date === tab.date).length
    }
  }
  return counts
})

const visibleRecords = computed(() => {
  if (selectedDateKey.value === 'overview') {
    return records.value
  }
  return records.value.filter(record => record.date === selectedDateKey.value)
})

const groupedRecords = computed(() => {
  const map = new Map<TargetStatus, BoardRecord[]>()
  TARGET_STATUSES.forEach(status => map.set(status, []))
  visibleRecords.value.forEach(record => {
    const bucket = map.get(record.status as TargetStatus)
    if (bucket) bucket.push(record)
  })
  return TARGET_STATUSES.filter(status => (map.get(status) || []).length > 0).map(status => ({
    status,
    records: (map.get(status) || []).slice().sort((a, b) => {
      return (b.publishTime || '').localeCompare(a.publishTime || '')
    }),
  }))
})

const tableColumns = computed<DataTableColumns<BoardRecord>>(() => [
  {
    title: '剧名',
    key: 'dramaName',
    width: 280,
    ellipsis: { tooltip: true },
  },
  {
    title: '账号',
    key: 'account',
    width: 210,
    ellipsis: { tooltip: true },
    render: row => row.account || '—',
  },
  {
    title: '上架时间',
    key: 'publishTime',
    width: 200,
    render: row => row.publishTime || '—',
  },
  {
    title: '评级',
    key: 'rating',
    width: 130,
    render: row => {
      if (!row.rating) return '—'
      const type = RATING_TAG_TYPE[row.rating] || 'default'
      return h(NTag, { size: 'small', type, bordered: false }, () => row.rating)
    },
  },
  {
    title: '日期',
    key: 'date',
    width: 160,
    render: row => row.date || '—',
  },
])

function getRowKey(row: BoardRecord) {
  return row.recordId
}

// ====== 飞书字段解析(沿用 Drawer 版本) ======
function unwrapFeishuValue(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'value' in (value as Record<string, unknown>)
  ) {
    const inner = (value as { value: unknown }).value
    return Array.isArray(inner) ? inner[0] : inner
  }
  return value
}

function extractText(value: unknown): string {
  const raw = unwrapFeishuValue(value)
  if (raw == null) return ''
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return String(raw)
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (typeof item === 'string') return item
        if (typeof item === 'number') return String(item)
        if (item && typeof item === 'object') {
          const part = item as { text?: string; name?: string }
          return part.text || part.name || ''
        }
        return ''
      })
      .join('')
  }
  if (typeof raw === 'object') {
    const obj = raw as { text?: string; name?: string }
    return obj.text || obj.name || ''
  }
  return ''
}

function toTimestamp(value: unknown): number | null {
  const raw = unwrapFeishuValue(value)
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const numeric = Number(raw)
    if (Number.isFinite(numeric)) return numeric
    const parsed = dayjs(raw)
    return parsed.isValid() ? parsed.valueOf() : null
  }
  return null
}

function formatDateTime(value: unknown): string {
  const ts = toTimestamp(value)
  if (ts != null) return dayjs(ts).format('YYYY-MM-DD HH:mm')
  const text = extractText(value)
  if (!text) return ''
  const parsed = dayjs(text)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : text
}

function formatDateOnly(value: unknown): string {
  const ts = toTimestamp(value)
  if (ts != null) return dayjs(ts).format('YYYY-MM-DD')
  const text = extractText(value)
  if (!text) return ''
  const parsed = dayjs(text)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : text
}

interface RawFeishuRecord {
  record_id?: string
  recordId?: string
  fields?: Record<string, unknown>
}

function normalizeRecord(item: RawFeishuRecord): BoardRecord {
  const fields = item?.fields || {}
  return {
    recordId: item?.record_id || item?.recordId || `${Math.random()}`,
    dramaName: extractText(fields['剧名']),
    account: extractText(fields['账户']),
    publishTime: formatDateTime(fields['上架时间']),
    rating: extractText(fields['评级']),
    status: extractText(fields['当前状态']),
    date: formatDateOnly(fields['日期']),
  }
}

async function loadAdminUsers() {
  if (!isAdmin.value) return
  if (adminUsers.value.length > 0) return
  try {
    const list = await adminApi.listUsers()
    adminUsers.value = list
    if (!selectedUserId.value && sessionStore.currentUser) {
      selectedUserId.value = sessionStore.currentUser.id
    }
  } catch (error) {
    console.warn('[FeishuBoardPanel] 加载用户列表失败:', error)
  }
}

async function fetchData() {
  const generation = beginRequest()
  const tableId = resolvedTableId.value
  if (!tableId) {
    records.value = []
    return
  }

  const dates = dateTabs.value.filter(tab => tab.date).map(tab => tab.date as string)

  loading.value = true
  try {
    const result = await feishuApi.getDramaStatusBoard(dates, [...TARGET_STATUSES], tableId)
    if (isStaleRequest(generation)) return
    records.value = result.items.map(normalizeRecord).filter(record => record.dramaName)
  } catch (error) {
    if (isStaleRequest(generation)) return
    console.warn('[FeishuBoardPanel] 加载飞书看板数据失败:', error)
    records.value = []
  } finally {
    if (!isStaleRequest(generation)) {
      loading.value = false
    }
  }
}

// 对外暴露:Tab 切回时由父组件调用
async function refresh() {
  if (isAdmin.value) {
    await loadAdminUsers()
    if (!selectedUserId.value && adminUsers.value.length > 0) {
      const fallback =
        adminUsers.value.find(u => u.id === sessionStore.currentUser?.id) || adminUsers.value[0]
      selectedUserId.value = fallback?.id || ''
    }
  }
  await fetchData()
}

defineExpose({ refresh, cancelAllRequests })

// 管理员切用户:重新拉数据
watch(selectedUserId, () => {
  if (isAdmin.value) void fetchData()
})

// 普通用户切渠道(外部 store 变化):重新拉数据
watch(
  () => apiConfigStore.config.dramaStatusTableId,
  () => {
    if (!isAdmin.value) void fetchData()
  }
)

// 顶部全局渠道切换:管理员模式下需要重新计算 tableId 并刷新
watch(
  () => sessionStore.activeChannelId,
  () => {
    if (isAdmin.value) void fetchData()
  }
)
</script>

<style scoped>
.feishu-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  background:
    radial-gradient(circle at top left, rgba(20, 184, 166, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.86));
  box-shadow: 0 24px 70px -46px rgba(15, 23, 42, 0.55);
}

.feishu-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.72);
}

.feishu-panel__title-wrap {
  min-width: 0;
}

.feishu-panel__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.feishu-panel__subtitle {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.feishu-panel__icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: linear-gradient(135deg, #e0f2fe, #ccfbf1);
  color: #0284c7;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.feishu-panel__icon {
  font-size: 20px;
  color: currentColor;
}

.feishu-panel__hint {
  margin-left: 4px;
}

.feishu-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.feishu-panel__body {
  padding: 18px 20px 22px;
}

.feishu-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.feishu-panel__select {
  width: 220px;
}

.feishu-panel__tabs :deep(.n-tabs-tab) {
  font-variant-numeric: tabular-nums;
}

.feishu-panel__tabs {
  min-width: min(760px, 100%);
}

.feishu-panel__date-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.feishu-panel__date-tab-label {
  line-height: 1;
}

.feishu-panel__date-tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.14);
  color: #0284c7;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.feishu-panel__date-tab-count.is-active {
  background: #0ea5e9;
  color: #fff;
}

.feishu-panel__date-tab-count.is-zero {
  background: rgba(148, 163, 184, 0.18);
  color: #94a3b8;
}

.feishu-panel__date-tab-count.is-zero.is-active {
  background: rgba(14, 165, 233, 0.6);
  color: #fff;
}

.feishu-panel__summary-total {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 7px 11px;
  border: 1px solid rgba(14, 165, 233, 0.16);
  border-radius: 999px;
  background: rgba(240, 249, 255, 0.82);
  color: #475569;
  font-size: 13px;
}

.feishu-panel__summary-total strong {
  color: #0284c7;
  font-weight: 700;
}

.feishu-panel__groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.feishu-panel__group {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  padding: 14px 14px 6px;
  box-shadow: 0 12px 36px -30px rgba(15, 23, 42, 0.5);
}

.feishu-panel__group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.feishu-panel__group-count {
  color: #64748b;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.feishu-panel__group-empty {
  color: #94a3b8;
  font-size: 13px;
  padding: 8px 4px 12px;
}

.feishu-panel__table {
  width: 100%;
}

.feishu-panel__table :deep(.n-data-table-base-table-body),
.feishu-panel__table :deep(.n-data-table-base-table-header) {
  scrollbar-width: thin;
}

.feishu-panel__table :deep(.n-data-table-th),
.feishu-panel__table :deep(.n-data-table-td) {
  white-space: nowrap;
}

.feishu-panel__table :deep(.n-data-table-base-table) {
  min-width: 980px;
}

.feishu-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 48px 20px;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  border-radius: 16px;
  background: #fff;
  color: #64748b;
  text-align: center;
}

.feishu-panel__empty-icon {
  font-size: 36px;
  color: #94a3b8;
}

.feishu-panel__empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
}

.feishu-panel__empty-desc {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

@media (max-width: 640px) {
  .feishu-panel {
    border-radius: 18px;
  }

  .feishu-panel__header,
  .feishu-panel__body {
    padding: 14px;
  }

  .feishu-panel__title {
    font-size: 18px;
  }

  .feishu-panel__subtitle {
    font-size: 12px;
  }

  .feishu-panel__actions {
    width: 100%;
    justify-content: space-between;
  }

  .feishu-panel__select {
    width: min(190px, calc(100vw - 120px));
  }

  .feishu-panel__toolbar {
    align-items: stretch;
  }

  .feishu-panel__tabs {
    min-width: 0;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .feishu-panel__tabs::-webkit-scrollbar {
    display: none;
  }

  .feishu-panel__summary-total {
    align-self: flex-start;
  }

  .feishu-panel__group {
    padding: 12px 10px 4px;
  }

  .feishu-panel__date-tab {
    gap: 5px;
  }

  .feishu-panel__date-tab-label {
    white-space: nowrap;
  }

  .feishu-panel__table :deep(.n-data-table-base-table-body) {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
