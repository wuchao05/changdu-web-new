<template>
  <n-drawer v-model:show="visible" :width="520" placement="right">
    <n-drawer-content>
      <template #header>
        <div
          style="display: flex; align-items: center; justify-content: space-between; width: 100%"
        >
          <span>adx短剧热力榜</span>
          <n-button v-if="isAdmin && !unauthorized" size="small" @click="showCookieModal = true"
            >配置 Cookie</n-button
          >
        </div>
      </template>

      <!-- 401 未授权：全屏提示 -->
      <div v-if="unauthorized" class="unauthorized-tip">
        <div class="unauthorized-icon">
          <svg
            viewBox="0 0 24 24"
            width="48"
            height="48"
            fill="none"
            stroke="#f59e0b"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <p class="unauthorized-title">ADX 账号已下线</p>
        <p class="unauthorized-desc">请联系管理员更新 Cookie</p>
        <n-button
          v-if="isAdmin"
          type="warning"
          style="margin-top: 20px"
          @click="showCookieModal = true"
        >
          去配置 Cookie
        </n-button>
      </div>

      <!-- 正常内容 -->
      <template v-else>
        <n-tabs v-model:value="activeTab" type="line" @update:value="handleTabChange">
          <n-tab-pane name="day" tab="日榜" />
          <n-tab-pane name="week" tab="周榜" />
          <n-tab-pane name="month" tab="月榜" />
        </n-tabs>

        <div class="period-select-wrap">
          <n-select
            v-model:value="selectedPeriodValue"
            class="period-select-input"
            size="small"
            :options="currentPeriodOptions"
            :loading="loading"
            @update:value="handlePeriodChange"
          />
          <n-button
            size="small"
            quaternary
            circle
            class="period-refresh-btn"
            :loading="loading"
            :title="loading ? '刷新中...' : '刷新榜单'"
            @click="handleRefresh"
          >
            <template #icon>
              <Icon icon="mdi:refresh" />
            </template>
          </n-button>
        </div>

        <n-spin :show="loading">
          <div v-if="rankingList.length" class="ranking-list">
            <div
              v-for="item in rankingList"
              :key="`${item.ranking}-${item.playletId}`"
              class="ranking-item"
            >
              <span class="ranking-num" :class="getRankClass(item.ranking)">
                {{ item.ranking }}
              </span>
              <div class="ranking-info">
                <button
                  class="ranking-name"
                  :title="`点击复制：${item.playletName}`"
                  @click="copyPlayletName(item.playletName)"
                >
                  {{ item.playletName }}
                </button>
                <div class="ranking-meta">
                  <span class="meta-tag">热力值 {{ formatHotValue(item.consumeNum) }}</span>
                  <span class="meta-tag"
                    >累计热力值 {{ formatHotValue(item.totalConsumeNum) }}</span
                  >
                </div>
              </div>
            </div>
          </div>
          <n-empty v-else-if="!loading" description="暂无数据" />
        </n-spin>
      </template>
    </n-drawer-content>
  </n-drawer>

  <n-modal v-model:show="showCookieModal" preset="dialog" title="配置 ADX Cookie">
    <n-input
      v-model:value="cookieInput"
      type="textarea"
      :rows="4"
      placeholder="请输入 ADX Cookie"
    />
    <template #action>
      <n-button type="primary" :loading="savingCookie" @click="saveCookie">保存</n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { useUserAuth } from '@/composables/useUserAuth'
import { buildSessionHeaders } from '@/utils/sessionToken'

type RankingTab = 'day' | 'week' | 'month'

interface PeriodOption {
  label: string
  value: string
}

interface RawAdxRankingItem {
  ranking?: number
  playletId?: number
  playletName?: string
  consumeNum?: number
  totalConsumeNum?: number
}

interface AdxResponseData {
  list?: RawAdxRankingItem[]
}

interface AdxResponse {
  statusCode?: number
  code?: number
  msg?: string
  message?: string
  content?: RawAdxRankingItem[]
  data?: AdxResponseData
}

interface AdxRankingItem {
  ranking: number
  playletId: number
  playletName: string
  consumeNum: number
  totalConsumeNum: number
}

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', val: boolean): void }>()

const message = useMessage()
const { isAdmin } = useUserAuth()

const visible = ref(false)
watch(
  () => props.show,
  v => {
    visible.value = v
  }
)
watch(visible, v => {
  emit('update:show', v)
})

const activeTab = ref<RankingTab>('day')
const dayPeriodValue = ref('')
const weekPeriodValue = ref('')
const monthPeriodValue = ref('')
const dayPeriodOptions = ref<PeriodOption[]>([])
const weekPeriodOptions = ref<PeriodOption[]>([])
const monthPeriodOptions = ref<PeriodOption[]>([])
const loading = ref(false)
const rankingList = ref<AdxRankingItem[]>([])
const unauthorized = ref(false)

// Cookie 配置
const showCookieModal = ref(false)
const cookieInput = ref('')
const savingCookie = ref(false)

const currentPeriodOptions = computed(() => {
  if (activeTab.value === 'day') return dayPeriodOptions.value
  if (activeTab.value === 'week') return weekPeriodOptions.value
  return monthPeriodOptions.value
})

const selectedPeriodValue = computed<string>({
  get() {
    if (activeTab.value === 'day') return dayPeriodValue.value
    if (activeTab.value === 'week') return weekPeriodValue.value
    return monthPeriodValue.value
  },
  set(value: string) {
    if (activeTab.value === 'day') {
      dayPeriodValue.value = value
    } else if (activeTab.value === 'week') {
      weekPeriodValue.value = value
    } else {
      monthPeriodValue.value = value
    }
  },
})

function createDayOptions(): PeriodOption[] {
  const latestDay = dayjs().subtract(1, 'day')
  return Array.from({ length: 7 }, (_, index) => {
    const day = latestDay.subtract(index, 'day').format('YYYY-MM-DD')
    return { label: day, value: day }
  })
}

function createWeekOptions(): PeriodOption[] {
  const latestMonday = dayjs().startOf('week').add(1, 'day').subtract(1, 'week')
  return Array.from({ length: 4 }, (_, index) => {
    const monday = latestMonday.subtract(index, 'week')
    const sunday = monday.add(6, 'day')
    const weekText = `${monday.format('YYYY-MM-DD')} ~ ${sunday.format('YYYY-MM-DD')}`
    return { label: weekText, value: weekText }
  })
}

function createMonthOptions(): PeriodOption[] {
  const latestMonth = dayjs().startOf('month').subtract(1, 'month')
  return Array.from({ length: 12 }, (_, index) => {
    const month = latestMonth.subtract(index, 'month').format('YYYY-MM')
    return { label: month, value: month }
  })
}

function initPeriodOptions() {
  dayPeriodOptions.value = createDayOptions()
  weekPeriodOptions.value = createWeekOptions()
  monthPeriodOptions.value = createMonthOptions()

  if (!dayPeriodOptions.value.some(option => option.value === dayPeriodValue.value)) {
    dayPeriodValue.value = dayPeriodOptions.value[0]?.value || ''
  }
  if (!weekPeriodOptions.value.some(option => option.value === weekPeriodValue.value)) {
    weekPeriodValue.value = weekPeriodOptions.value[0]?.value || ''
  }
  if (!monthPeriodOptions.value.some(option => option.value === monthPeriodValue.value)) {
    monthPeriodValue.value = monthPeriodOptions.value[0]?.value || ''
  }
}

function getCurrentPeriodValue() {
  return selectedPeriodValue.value
}

function normalizeRankingList(data: AdxResponse): AdxRankingItem[] {
  const sourceList = Array.isArray(data.content)
    ? data.content
    : Array.isArray(data.data?.list)
      ? data.data.list
      : []

  return sourceList.map((item, index) => ({
    ranking: item.ranking ?? index + 1,
    playletId: item.playletId ?? index + 1,
    playletName: item.playletName || '-',
    consumeNum: item.consumeNum ?? 0,
    totalConsumeNum: item.totalConsumeNum ?? 0,
  }))
}

function formatHotValue(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (value >= 10000) {
    const wanValue = (value / 10000).toFixed(1).replace(/\.0$/, '')
    return `${wanValue}w`
  }
  return `${value}`
}

async function copyPlayletName(name: string) {
  try {
    await navigator.clipboard.writeText(name)
    message.success(`已复制剧名：${name}`)
  } catch (error) {
    console.error('复制剧名失败:', error)
    const textArea = document.createElement('textarea')
    textArea.value = name
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      message.success(`已复制剧名：${name}`)
    } catch (fallbackError) {
      console.error('降级复制失败:', fallbackError)
      message.error('复制失败，请手动复制')
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

// 加载已有 cookie
async function loadCookie() {
  try {
    const res = await fetch('/api/session/me', {
      headers: buildSessionHeaders(),
    })
    const data = await res.json()
    if (data?.code === 0) {
      cookieInput.value = data.data?.platforms?.adx?.cookie || ''
    }
  } catch {}
}

// 保存 cookie
async function saveCookie() {
  savingCookie.value = true
  try {
    const currentSessionRes = await fetch('/api/session/me', {
      headers: buildSessionHeaders(),
    })
    const currentSession = await currentSessionRes.json()
    const activeChannelId = currentSession?.data?.channel?.id

    if (!activeChannelId) {
      throw new Error('当前没有可用的渠道，无法保存 ADX Cookie')
    }

    const channelsRes = await fetch('/api/admin/channels', {
      headers: buildSessionHeaders(),
    })
    const channelsResult = await channelsRes.json()
    const currentChannel = (channelsResult?.data || []).find(
      (item: { id: string }) => item.id === activeChannelId
    )

    if (!currentChannel) {
      throw new Error('未找到当前渠道，无法保存 ADX Cookie')
    }

    await fetch(`/api/admin/channels/${activeChannelId}`, {
      method: 'PUT',
      headers: buildSessionHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        ...currentChannel,
        adx: {
          cookie: cookieInput.value,
        },
      }),
    })
    message.success('ADX Cookie 保存成功')
    showCookieModal.value = false
    fetchRanking()
  } catch {
    message.error('保存失败')
  } finally {
    savingCookie.value = false
  }
}

async function fetchRanking() {
  const periodValue = getCurrentPeriodValue()
  if (!periodValue) return

  loading.value = true
  rankingList.value = []
  unauthorized.value = false

  try {
    const response = await fetch('/api/adx/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: activeTab.value,
        periodValue,
        pageId: 1,
        pageSize: 50,
        searchKey: '番茄',
      }),
    })
    const data: AdxResponse = await response.json()

    if (response.status === 401 || data?.statusCode === 401 || data?.msg === 'Unauthorized') {
      unauthorized.value = true
      return
    }

    if (data?.statusCode === 200 || data?.code === 0) {
      rankingList.value = normalizeRankingList(data)
    } else {
      message.warning(data?.msg || data?.message || '获取榜单失败')
    }
  } catch (error) {
    console.error('请求 ADX 榜单失败:', error)
    message.error('请求 ADX 榜单失败')
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  if (!currentPeriodOptions.value.some(option => option.value === selectedPeriodValue.value)) {
    selectedPeriodValue.value = currentPeriodOptions.value[0]?.value || ''
  }
  fetchRanking()
}

function handlePeriodChange() {
  fetchRanking()
}

function handleRefresh() {
  fetchRanking()
}

function getRankClass(rank: number) {
  if (rank === 1) return 'rank-1'
  if (rank === 2) return 'rank-2'
  if (rank === 3) return 'rank-3'
  return ''
}

// 抽屉打开时加载数据
watch(visible, v => {
  if (v) {
    initPeriodOptions()
    loadCookie()
    fetchRanking()
  }
})

onMounted(() => {
  initPeriodOptions()
  if (props.show) {
    loadCookie()
    fetchRanking()
  }
})
</script>

<style scoped>
.period-select-wrap {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

.period-select-input {
  width: 248px;
  max-width: calc(100% - 42px);
}

.period-select-input :deep(.n-base-selection-label) {
  overflow: hidden;
}

.period-select-input :deep(.n-base-selection-label__render-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.period-refresh-btn {
  margin-left: auto;
  width: 30px;
  min-width: 30px;
  height: 30px;
  color: #64748b;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

.period-refresh-btn:hover {
  color: #334155;
  border-color: #cbd5e1;
  background: #f8fafc;
}

@media (max-width: 640px) {
  .period-select-input {
    width: calc(100% - 42px);
  }
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f9fafb;
}

.ranking-item:hover {
  background: #f0f5ff;
}

.ranking-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  width: 100%;
}

.ranking-num {
  min-width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-weight: 700;
  font-size: 14px;
  color: #6b7280;
  background: #e5e7eb;
}

.rank-1 {
  background: #fbbf24;
  color: #fff;
}

.rank-2 {
  background: #9ca3af;
  color: #fff;
}

.rank-3 {
  background: #cd7f32;
  color: #fff;
}

.ranking-name {
  width: fit-content;
  max-width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 14px;
  color: #1f2937;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-name:hover {
  color: #2563eb;
}

.ranking-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-tag {
  font-size: 12px;
  color: #6b7280;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 4px;
}

.unauthorized-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.unauthorized-icon {
  margin-bottom: 16px;
  padding: 16px;
  border-radius: 50%;
  background: #fffbeb;
}

.unauthorized-title {
  font-size: 16px;
  font-weight: 600;
  color: #b45309;
  margin: 0 0 8px;
}

.unauthorized-desc {
  font-size: 14px;
  color: #92400e;
  margin: 0;
}
</style>
