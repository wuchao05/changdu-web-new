<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="transform translate-x-4 opacity-0"
    enter-to-class="transform translate-x-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="transform translate-x-0 opacity-100"
    leave-to-class="transform translate-x-4 opacity-0"
  >
    <aside v-if="visible" class="adx-ranking-panel">
      <div class="adx-panel-header">
        <div class="adx-panel-title-wrap">
          <div class="adx-panel-eyebrow">ADX 热力</div>
          <h3 class="adx-panel-title">短剧热力榜</h3>
          <p class="adx-panel-subtitle">{{ activeSourceDescription }}</p>
        </div>
        <div class="adx-panel-actions">
          <n-button
            v-if="isAdmin && !unauthorized"
            size="small"
            @click="showCredentialModal = true"
          >
            配置数据源
          </n-button>
          <button class="adx-panel-close" title="收起热力榜" @click="closePanel">
            <Icon icon="mdi:chevron-right" />
          </button>
        </div>
      </div>

      <div class="adx-panel-body">
        <div class="adx-source-switcher">
          <button
            v-for="option in dataSourceOptions"
            :key="option.value"
            type="button"
            class="adx-source-option"
            :class="{ active: activeDataSource === option.value }"
            :disabled="loading"
            @click="handleDataSourceChange(option.value)"
          >
            <Icon :icon="option.icon" class="adx-source-option__icon" />
            <span>{{ option.label }}</span>
          </button>
        </div>

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
          <p class="unauthorized-title">{{ unauthorizedTitle }}</p>
          <p class="unauthorized-desc">{{ unauthorizedDescription }}</p>
          <n-button
            v-if="isAdmin"
            type="warning"
            style="margin-top: 20px"
            @click="showCredentialModal = true"
          >
            去配置凭证
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

          <div class="ranking-scroll-area">
            <n-spin :show="loading && rankingList.length > 0">
              <div v-if="loading && !rankingList.length" class="adx-loading-state">
                <div class="adx-loading-orbit" aria-hidden="true">
                  <span class="adx-loading-orbit-dot dot-1"></span>
                  <span class="adx-loading-orbit-dot dot-2"></span>
                  <span class="adx-loading-orbit-core">
                    <Icon icon="mdi:fire" />
                  </span>
                </div>
                <div class="adx-loading-copy">
                  <p class="adx-loading-title">正在拉取{{ activeSourceLabel }}热力榜</p>
                  <p class="adx-loading-desc">同步榜期数据与热力变化，请稍候</p>
                </div>
                <div class="adx-loading-bars" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div v-else-if="rankingList.length" class="ranking-list">
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
                      :title="`搜索：${item.playletName}`"
                      @click="searchPlayletName(item.playletName)"
                    >
                      {{ item.playletName }}
                    </button>
                    <div class="ranking-actions">
                      <button
                        class="ranking-action-btn primary"
                        title="在爆剧爆剪中搜索"
                        @click="searchPlayletName(item.playletName)"
                      >
                        <Icon icon="mdi:magnify" />
                        搜索
                      </button>
                      <button
                        class="ranking-action-btn"
                        title="复制剧名"
                        @click="copyPlayletName(item.playletName)"
                      >
                        <Icon icon="mdi:content-copy" />
                        复制
                      </button>
                    </div>
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
          </div>
        </template>
      </div>
    </aside>
  </Transition>

  <n-modal v-model:show="showCredentialModal" preset="dialog" title="配置 ADX 热力榜数据源">
    <div class="credential-form">
      <label class="credential-field">
        <span class="credential-label">默认数据源</span>
        <n-select v-model:value="activeDataSource" :options="credentialSourceOptions" />
      </label>
      <div class="credential-section">
        <div class="credential-section-title">ADX 平台数据</div>
        <label class="credential-field">
          <span class="credential-label">ADX Cookie</span>
          <n-input
            v-model:value="adxCookieInput"
            type="textarea"
            :rows="4"
            placeholder="请输入 PC 端 ADX 平台 Cookie"
          />
        </label>
      </div>
      <div class="credential-section">
        <div class="credential-section-title">剧查查小程序数据</div>
        <label class="credential-field">
          <span class="credential-label">authentication</span>
          <n-input
            v-model:value="authenticationInput"
            type="textarea"
            :rows="3"
            placeholder="请输入 authentication"
          />
        </label>
        <label class="credential-field">
          <span class="credential-label">loginUserId</span>
          <n-input v-model:value="loginUserIdInput" placeholder="请输入 loginUserId" />
        </label>
      </div>
    </div>
    <template #action>
      <n-button type="primary" :loading="savingCredentials" @click="saveCredentials">保存</n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  NButton,
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
type RankingDataSource = 'adx' | 'dataeye'

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

interface AdxConfigResponse {
  source?: RankingDataSource
  adx?: {
    cookie?: string
    configured?: boolean
  }
  dataeye?: {
    authentication?: string
    loginUserId?: string
    configured?: boolean
  }
  authentication?: string
  loginUserId?: string
}

interface AdxRankingItem {
  ranking: number
  playletId: number
  playletName: string
  consumeNum: number
  totalConsumeNum: number
}

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  (e: 'update:show', val: boolean): void
  (e: 'search-drama', name: string): void
}>()

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
const activeDataSource = ref<RankingDataSource>('dataeye')
const dataSourceOptions: Array<{
  label: string
  value: RankingDataSource
  icon: string
  description: string
}> = [
  {
    label: 'ADX 平台',
    value: 'adx',
    icon: 'mdi:monitor-dashboard',
    description: '使用 PC 端 ADX 平台登录态和接口，点击“搜索”可联动查询',
  },
  {
    label: '剧查查小程序',
    value: 'dataeye',
    icon: 'mdi:cellphone-link',
    description: '使用 DataEye 剧查查小程序登录态和接口，点击“搜索”可联动查询',
  },
]
const credentialSourceOptions = dataSourceOptions.map(option => ({
  label: option.label,
  value: option.value,
}))

// 数据源凭证配置
const showCredentialModal = ref(false)
const adxCookieInput = ref('')
const authenticationInput = ref('')
const loginUserIdInput = ref('')
const savingCredentials = ref(false)

const activeSourceOption = computed(
  () =>
    dataSourceOptions.find(option => option.value === activeDataSource.value) ||
    dataSourceOptions[1]
)
const activeSourceLabel = computed(() => activeSourceOption.value.label)
const activeSourceDescription = computed(() => activeSourceOption.value.description)
const unauthorizedTitle = computed(() =>
  activeDataSource.value === 'adx' ? 'ADX 平台登录态已失效' : '剧查查小程序凭证已失效'
)
const unauthorizedDescription = computed(() =>
  activeDataSource.value === 'adx' ? '请联系管理员更新 ADX Cookie' : '请联系管理员更新访问凭证'
)

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

function searchPlayletName(name: string) {
  const keyword = name.trim()
  if (!keyword || keyword === '-') return
  emit('search-drama', keyword)
}

function closePanel() {
  visible.value = false
}

function normalizeDataSource(source?: string): RankingDataSource {
  return source === 'adx' ? 'adx' : 'dataeye'
}

// 加载已有数据源凭证
async function loadCredentials() {
  try {
    const res = await fetch('/api/adx/config', {
      headers: buildSessionHeaders(),
    })
    const data: { code?: number; data?: AdxConfigResponse } = await res.json()
    if (data?.code === 0) {
      const config = data.data || {}
      activeDataSource.value = normalizeDataSource(config.source)
      adxCookieInput.value = config.adx?.cookie || ''
      authenticationInput.value = config.dataeye?.authentication || config.authentication || ''
      loginUserIdInput.value = config.dataeye?.loginUserId || config.loginUserId || ''
    }
  } catch {}
}

// 保存数据源凭证
async function saveCredentials() {
  savingCredentials.value = true
  try {
    const response = await fetch('/api/adx/config', {
      method: 'PUT',
      headers: buildSessionHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        source: activeDataSource.value,
        adx: {
          cookie: adxCookieInput.value,
        },
        dataeye: {
          authentication: authenticationInput.value,
          loginUserId: loginUserIdInput.value,
        },
      }),
    })

    const result = await response.json()
    if (!response.ok || result?.code !== 0) {
      throw new Error(result?.message || '保存失败')
    }

    message.success('ADX 热力榜数据源配置已保存')
    showCredentialModal.value = false
    fetchRanking()
  } catch (error) {
    console.error('保存 ADX 数据源配置失败:', error)
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    savingCredentials.value = false
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
      headers: buildSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        source: activeDataSource.value,
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
    console.error(`请求${activeSourceLabel.value}热力榜失败:`, error)
    message.error(`请求${activeSourceLabel.value}热力榜失败`)
  } finally {
    loading.value = false
  }
}

function handleDataSourceChange(source: RankingDataSource) {
  if (activeDataSource.value === source) return
  activeDataSource.value = source
  unauthorized.value = false
  fetchRanking()
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

async function initializePanelData() {
  initPeriodOptions()
  await loadCredentials()
  await fetchRanking()
}

// 抽屉打开时加载数据
watch(visible, v => {
  if (v) {
    initializePanelData()
  }
})

onMounted(() => {
  initPeriodOptions()
  if (props.show) {
    initializePanelData()
  }
})
</script>

<style scoped>
.credential-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.credential-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.credential-label {
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.credential-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.credential-section-title {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.adx-ranking-panel {
  --adx-panel-sticky-top: 92px;
  position: sticky;
  top: var(--adx-panel-sticky-top);
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  height: clamp(500px, 68vh, 680px);
  width: 380px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 70px -44px rgba(15, 23, 42, 0.5);
}

.adx-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 34%),
    linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%);
}

.adx-panel-title-wrap {
  min-width: 0;
}

.adx-panel-eyebrow {
  margin-bottom: 2px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.adx-panel-title {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
}

.adx-panel-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.adx-panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.adx-panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.78);
  color: #64748b;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.adx-panel-close:hover {
  border-color: rgba(37, 99, 235, 0.22);
  background: #fff;
  color: #1d4ed8;
}

.adx-panel-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
}

.adx-source-switcher {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.adx-source-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.adx-source-option:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.35);
  background: #f8fafc;
  color: #1d4ed8;
}

.adx-source-option.active {
  border-color: rgba(37, 99, 235, 0.38);
  background: #eff6ff;
  color: #1d4ed8;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.12);
}

.adx-source-option:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.adx-source-option__icon {
  flex-shrink: 0;
  font-size: 16px;
}

.ranking-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

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

.adx-loading-state {
  position: relative;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  overflow: hidden;
  padding: 30px 22px;
  border: 1px solid rgba(147, 197, 253, 0.32);
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(239, 246, 255, 0.78));
}

.adx-loading-state::before,
.adx-loading-state::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.16), transparent);
  animation: adx-loading-shimmer 2.6s ease-in-out infinite;
}

.adx-loading-state::before {
  top: 34px;
  left: -36px;
  width: 170px;
  height: 8px;
}

.adx-loading-state::after {
  right: -48px;
  bottom: 46px;
  width: 190px;
  height: 8px;
  animation-delay: 0.7s;
}

.adx-loading-orbit {
  position: relative;
  width: 86px;
  height: 86px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow:
    inset 0 0 0 1px rgba(147, 197, 253, 0.28),
    0 18px 42px -26px rgba(37, 99, 235, 0.55);
}

.adx-loading-orbit::before {
  content: '';
  position: absolute;
  inset: 7px;
  border-radius: inherit;
  border: 2px solid rgba(59, 130, 246, 0.14);
  border-top-color: rgba(37, 99, 235, 0.78);
  border-right-color: rgba(16, 185, 129, 0.58);
  animation: adx-loading-spin 1.4s linear infinite;
}

.adx-loading-orbit-core {
  position: relative;
  z-index: 1;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: #2563eb;
  font-size: 24px;
  background: linear-gradient(135deg, #eff6ff, #dcfce7);
  animation: adx-loading-pulse 1.8s ease-in-out infinite;
}

.adx-loading-orbit-dot {
  position: absolute;
  z-index: 2;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #16a34a;
  box-shadow: 0 0 18px rgba(22, 163, 74, 0.58);
}

.adx-loading-orbit-dot.dot-1 {
  top: 12px;
  right: 18px;
  animation: adx-loading-float 1.7s ease-in-out infinite;
}

.adx-loading-orbit-dot.dot-2 {
  left: 16px;
  bottom: 16px;
  width: 7px;
  height: 7px;
  background: #2563eb;
  animation: adx-loading-float 1.7s ease-in-out infinite reverse;
}

.adx-loading-copy {
  position: relative;
  z-index: 1;
  text-align: center;
}

.adx-loading-title {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
}

.adx-loading-desc {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.adx-loading-bars {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 18px);
  align-items: end;
  gap: 7px;
  height: 34px;
}

.adx-loading-bars span {
  display: block;
  border-radius: 999px 999px 6px 6px;
  background: linear-gradient(180deg, #2563eb, #16a34a);
  animation: adx-loading-bar 1.1s ease-in-out infinite;
}

.adx-loading-bars span:nth-child(1) {
  height: 18px;
}

.adx-loading-bars span:nth-child(2) {
  height: 28px;
  animation-delay: 0.12s;
}

.adx-loading-bars span:nth-child(3) {
  height: 22px;
  animation-delay: 0.24s;
}

.adx-loading-bars span:nth-child(4) {
  height: 32px;
  animation-delay: 0.36s;
}

@keyframes adx-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes adx-loading-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

@keyframes adx-loading-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -6px, 0);
  }
}

@keyframes adx-loading-bar {
  0%,
  100% {
    transform: scaleY(0.68);
    opacity: 0.58;
  }
  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

@keyframes adx-loading-shimmer {
  0%,
  100% {
    transform: translateX(0);
    opacity: 0.34;
  }
  50% {
    transform: translateX(46px);
    opacity: 0.8;
  }
}

.ranking-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(226, 232, 240, 0.86);
  border-radius: 12px;
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

.ranking-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ranking-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.ranking-action-btn:hover {
  border-color: rgba(37, 99, 235, 0.22);
  color: #1d4ed8;
  background: #eff6ff;
}

.ranking-action-btn.primary {
  border-color: rgba(37, 99, 235, 0.18);
  background: #2563eb;
  color: #fff;
}

.ranking-action-btn.primary:hover {
  border-color: rgba(29, 78, 216, 0.24);
  background: #1d4ed8;
  color: #fff;
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

@media (max-width: 1180px) {
  .adx-ranking-panel {
    position: relative;
    top: auto;
    height: auto;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .adx-ranking-panel {
    border-radius: 18px;
  }

  .adx-panel-header {
    flex-direction: column;
  }

  .adx-panel-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
