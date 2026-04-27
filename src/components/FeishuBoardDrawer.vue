<template>
  <div v-if="shouldShow">
    <n-tooltip placement="left" :delay="300">
      <template #trigger>
        <n-button
          class="feishu-board-fab"
          circle
          type="primary"
          :loading="loading && drawerVisible"
          @click="openDrawer"
        >
          <template #icon>
            <Icon icon="mdi:view-dashboard-outline" />
          </template>
        </n-button>
      </template>
      飞书状态看板
    </n-tooltip>

    <n-drawer v-model:show="drawerVisible" placement="right" :width="drawerWidth">
      <n-drawer-content closable>
        <template #header>
          <div class="board-header">
            <div class="board-header__title">
              <Icon icon="mdi:view-dashboard-outline" class="board-header__icon" />
              <span>飞书状态看板</span>
              <n-tag size="small" :bordered="false" type="info" class="board-header__hint">
                只读
              </n-tag>
            </div>
            <div class="board-header__actions">
              <template v-if="isAdmin">
                <n-select
                  v-model:value="selectedUserId"
                  :options="userOptions"
                  size="small"
                  class="board-header__select"
                  filterable
                  placeholder="选择用户"
                />
                <n-select
                  v-if="channelOptions.length > 1"
                  v-model:value="selectedChannelId"
                  :options="channelOptions"
                  size="small"
                  class="board-header__select board-header__select--channel"
                  placeholder="选择渠道"
                />
              </template>
              <n-button
                size="small"
                tertiary
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
        </template>

        <div class="board-body">
          <n-tabs
            v-model:value="selectedDateKey"
            type="segment"
            size="medium"
            animated
            class="board-tabs"
          >
            <n-tab-pane
              v-for="tab in dateTabs"
              :key="tab.key"
              :name="tab.key"
              display-directive="show"
            >
              <template #tab>
                <span class="board-date-tab">
                  <span class="board-date-tab__label">{{ tab.label }}</span>
                  <span
                    class="board-date-tab__count"
                    :class="{
                      'board-date-tab__count--active': selectedDateKey === tab.key,
                      'board-date-tab__count--zero': dateCounts[tab.key] === 0,
                    }"
                  >
                    {{ dateCounts[tab.key] ?? 0 }}
                  </span>
                </span>
              </template>
            </n-tab-pane>
          </n-tabs>

          <div v-if="!resolvedTableId" class="board-empty">
            <Icon icon="mdi:link-variant-off" class="board-empty__icon" />
            <p class="board-empty__title">未配置飞书状态表</p>
            <p class="board-empty__desc">
              {{
                isAdmin
                  ? '所选用户的当前渠道尚未配置剧集状态表 ID'
                  : '当前渠道尚未配置剧集状态表 ID，请联系管理员'
              }}
            </p>
          </div>

          <template v-else>
            <div class="board-summary">
              <span class="board-summary__total">
                共 <strong>{{ visibleRecords.length }}</strong> 条记录
              </span>
            </div>

            <n-spin :show="loading">
              <div class="board-groups">
                <div v-for="group in groupedRecords" :key="group.status" class="board-group">
                  <div class="board-group__head">
                    <n-tag
                      :type="STATUS_TAG_TYPE[group.status] || 'default'"
                      size="small"
                      :bordered="false"
                      round
                    >
                      {{ group.status }}
                    </n-tag>
                    <span class="board-group__count">{{ group.records.length }}</span>
                  </div>
                  <n-data-table
                    v-if="group.records.length"
                    size="small"
                    :columns="tableColumns"
                    :data="group.records"
                    :bordered="false"
                    :single-line="false"
                    striped
                    :row-key="getRowKey"
                  />
                  <div v-else class="board-group__empty">该状态暂无记录</div>
                </div>

                <div v-if="!loading && groupedRecords.length === 0" class="board-empty">
                  <Icon icon="mdi:tray-remove" class="board-empty__icon" />
                  <p class="board-empty__title">没有匹配的剧目</p>
                  <p class="board-empty__desc">该日期下没有处于跟进中状态的剧目</p>
                </div>
              </div>
            </n-spin>
          </template>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  NButton,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NTooltip,
  type DataTableColumns,
} from 'naive-ui'
import { useRoute } from 'vue-router'
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

const route = useRoute()
const sessionStore = useSessionStore()
const apiConfigStore = useApiConfigStore()

const drawerVisible = ref(false)
const loading = ref(false)
const records = ref<BoardRecord[]>([])
const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)

// 管理员选择器
const adminUsers = ref<adminApi.UserProfile[]>([])
const selectedUserId = ref('')
const selectedChannelId = ref('')

const isAdmin = computed(() => sessionStore.isAdmin)

const shouldShow = computed(() => sessionStore.isAuthenticated && route.name !== 'login')

const drawerWidth = computed(() => {
  if (viewportWidth.value <= 768) {
    return Math.max(viewportWidth.value - 16, 320)
  }
  if (viewportWidth.value <= 1280) {
    return Math.round(viewportWidth.value * 0.85)
  }
  return Math.round(viewportWidth.value * 0.7)
})

// 用户下拉
const userOptions = computed(() =>
  adminUsers.value.map(user => ({
    label: `${user.nickname || user.account}${user.userType === 'admin' ? ' · 管理员' : ''}`,
    value: user.id,
  }))
)

const selectedUser = computed(() => adminUsers.value.find(user => user.id === selectedUserId.value))

// 渠道下拉（仅 admin 用）
const channelOptions = computed(() => {
  const user = selectedUser.value
  if (!user) return []
  const channelIds = Array.isArray(user.channelIds) ? user.channelIds : []
  const labelMap = new Map<string, string>()
  if (Array.isArray(user.channelNames)) {
    user.channelNames.forEach((name, index) => {
      const id = channelIds[index]
      if (id) labelMap.set(id, name)
    })
  }
  return channelIds.map(id => ({
    label: labelMap.get(id) || id,
    value: id,
  }))
})

// 解析当前要查询的 tableId
const resolvedTableId = computed(() => {
  if (isAdmin.value) {
    const user = selectedUser.value
    if (!user) return ''
    const channelId = selectedChannelId.value || user.defaultChannelId || user.channelIds?.[0] || ''
    if (!channelId) return ''
    const binding = user.channelConfigs?.[channelId]
    return binding?.feishu?.dramaStatusTableId || user.feishu?.dramaStatusTableId || ''
  }
  return apiConfigStore.config.dramaStatusTableId || ''
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
      label: `${prefix} ${day.format('YYYY-MM-DD')}`,
      date: day.format('YYYY-MM-DD'),
    })
  }
  return tabs
})

const selectedDateKey = ref<string>('overview')

// 各日期 Tab 对应的记录数
const dateCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = { overview: records.value.length }
  for (const tab of dateTabs.value) {
    if (tab.date) {
      counts[tab.key] = records.value.filter(record => record.date === tab.date).length
    }
  }
  return counts
})

// 当前显示的记录（按选中日期过滤）
const visibleRecords = computed(() => {
  if (selectedDateKey.value === 'overview') {
    return records.value
  }
  return records.value.filter(record => record.date === selectedDateKey.value)
})

// 按状态分组
const groupedRecords = computed(() => {
  const map = new Map<TargetStatus, BoardRecord[]>()
  TARGET_STATUSES.forEach(status => map.set(status, []))
  visibleRecords.value.forEach(record => {
    const bucket = map.get(record.status as TargetStatus)
    if (bucket) bucket.push(record)
  })
  // 仅返回有数据的分组，避免一堆空分组占地方
  return TARGET_STATUSES.filter(status => (map.get(status) || []).length > 0).map(status => ({
    status,
    records: (map.get(status) || []).slice().sort((a, b) => {
      // 同状态内按上架时间倒序
      return (b.publishTime || '').localeCompare(a.publishTime || '')
    }),
  }))
})

const tableColumns = computed<DataTableColumns<BoardRecord>>(() => [
  {
    title: '剧名',
    key: 'dramaName',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: '账号',
    key: 'account',
    width: 160,
    ellipsis: { tooltip: true },
    render: row => row.account || '—',
  },
  {
    title: '上架时间',
    key: 'publishTime',
    width: 170,
    render: row => row.publishTime || '—',
  },
  {
    title: '评级',
    key: 'rating',
    width: 90,
    render: row => {
      if (!row.rating) return '—'
      const type = RATING_TAG_TYPE[row.rating] || 'default'
      return h(NTag, { size: 'small', type, bordered: false }, () => row.rating)
    },
  },
  {
    title: '日期',
    key: 'date',
    width: 120,
    render: row => row.date || '—',
  },
])

function getRowKey(row: BoardRecord) {
  return row.recordId
}

function syncViewportWidth() {
  if (typeof window === 'undefined') return
  viewportWidth.value = window.innerWidth
}

// 解析飞书字段：兼容富文本数组、{type, value} 包装、单选/多选、纯字符串/数字
// 飞书常见结构：
//   - 文本类:    [{ text: '...', type: 'text' }]
//   - 单选/选项: { type: 3, value: ['黄标'] }
//   - 数字类:    { type: 5, value: [1777305900000] }
//   - 直接值:    string / number
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
    console.warn('[FeishuBoardDrawer] 加载用户列表失败:', error)
  }
}

async function fetchData() {
  const tableId = resolvedTableId.value
  if (!tableId) {
    records.value = []
    return
  }

  const dates = dateTabs.value.filter(tab => tab.date).map(tab => tab.date as string)

  loading.value = true
  try {
    const result = await feishuApi.getDramaStatusBoard(dates, [...TARGET_STATUSES], tableId)
    records.value = result.items.map(normalizeRecord).filter(record => record.dramaName)
  } catch (error) {
    console.warn('[FeishuBoardDrawer] 加载飞书状态看板数据失败:', error)
    records.value = []
  } finally {
    loading.value = false
  }
}

function refresh() {
  void fetchData()
}

function openDrawer() {
  drawerVisible.value = true
}

// 抽屉打开时加载
watch(drawerVisible, async visible => {
  if (!visible) return
  if (isAdmin.value) {
    await loadAdminUsers()
    if (!selectedUserId.value && adminUsers.value.length > 0) {
      const fallback =
        adminUsers.value.find(u => u.id === sessionStore.currentUser?.id) || adminUsers.value[0]
      selectedUserId.value = fallback?.id || ''
    }
  }
  void fetchData()
})

// 管理员切用户：默认渠道
watch(selectedUserId, userId => {
  if (!userId) {
    selectedChannelId.value = ''
    return
  }
  const user = adminUsers.value.find(item => item.id === userId)
  if (!user) {
    selectedChannelId.value = ''
    return
  }
  const fallback = user.defaultChannelId || user.channelIds?.[0] || ''
  selectedChannelId.value = fallback
  if (drawerVisible.value) void fetchData()
})

// 管理员切渠道：重新拉数据
watch(selectedChannelId, () => {
  if (drawerVisible.value && isAdmin.value) {
    void fetchData()
  }
})

// 普通用户切渠道（外部 store 变化）：重新拉数据
watch(
  () => apiConfigStore.config.dramaStatusTableId,
  () => {
    if (drawerVisible.value && !isAdmin.value) {
      void fetchData()
    }
  }
)

watch(shouldShow, visible => {
  if (!visible) {
    drawerVisible.value = false
    records.value = []
  }
})

onMounted(() => {
  if (typeof window === 'undefined') return
  syncViewportWidth()
  window.addEventListener('resize', syncViewportWidth)
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncViewportWidth)
  }
})
</script>

<style scoped>
.feishu-board-fab {
  position: fixed;
  right: 24px;
  bottom: 168px;
  z-index: 1200;
  box-shadow: 0 14px 36px rgba(174, 121, 67, 0.28);
}

.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  flex-wrap: wrap;
}

.board-header__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #4d351e;
}

.board-header__icon {
  font-size: 20px;
  color: #ae7943;
}

.board-header__hint {
  margin-left: 4px;
}

.board-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.board-header__select {
  width: 200px;
}

.board-header__select--channel {
  width: 160px;
}

.board-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.board-tabs :deep(.n-tabs-tab) {
  font-variant-numeric: tabular-nums;
}

.board-date-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.board-date-tab__label {
  line-height: 1;
}

.board-date-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(174, 121, 67, 0.14);
  color: #8b6b49;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.board-date-tab__count--active {
  background: #ae7943;
  color: #fff;
}

.board-date-tab__count--zero {
  background: rgba(148, 120, 90, 0.12);
  color: #b39c83;
}

.board-date-tab__count--zero.board-date-tab__count--active {
  background: rgba(174, 121, 67, 0.55);
  color: #fff;
}

.board-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  color: #6b4d2f;
  font-size: 13px;
}

.board-summary__total strong {
  color: #ae7943;
  font-weight: 700;
}

.board-groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.board-group {
  background: rgba(255, 252, 247, 0.7);
  border: 1px solid rgba(174, 121, 67, 0.12);
  border-radius: 12px;
  padding: 12px 12px 4px;
}

.board-group__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.board-group__count {
  color: #94785a;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.board-group__empty {
  color: #b39c83;
  font-size: 13px;
  padding: 8px 4px 12px;
}

.board-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 48px 20px;
  border: 1px dashed rgba(174, 121, 67, 0.3);
  border-radius: 16px;
  background: rgba(255, 252, 247, 0.6);
  color: #8b6b49;
  text-align: center;
}

.board-empty__icon {
  font-size: 36px;
  color: #c9a47b;
}

.board-empty__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #6b4d2f;
}

.board-empty__desc {
  margin: 0;
  font-size: 13px;
  color: #94785a;
}

@media (max-width: 640px) {
  .feishu-board-fab {
    right: 16px;
    bottom: 152px;
  }

  .board-header__select,
  .board-header__select--channel {
    width: 140px;
  }
}
</style>
