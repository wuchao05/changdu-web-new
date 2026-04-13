<template>
  <div class="settings-page min-h-screen bg-slate-50">
    <header class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="flex items-center space-x-4">
        <n-button text @click="$router.back()" class="!text-gray-500 hover:!text-gray-700">
          <template #icon>
            <Icon icon="mdi:arrow-left" />
          </template>
          返回
        </n-button>
        <div>
          <h1 class="text-xl font-semibold text-gray-900">设置中心</h1>
          <p class="text-xs text-gray-500 mt-1">仅保留当前工作台的个人偏好和本地数据管理</p>
        </div>
      </div>
    </header>

    <main class="px-6 py-8">
      <div class="max-w-4xl mx-auto space-y-6">
        <n-card v-if="showBuildBidCard" class="shadow-sm border border-gray-200">
          <template #header>
            <div class="flex items-center space-x-3">
              <Icon icon="mdi:cog" class="w-5 h-5 text-gray-600" />
              <div>
                <h3 class="text-lg font-semibold text-gray-900">基础设置</h3>
                <p class="text-sm text-gray-500">工作台的通用参数与查询偏好</p>
              </div>
            </div>
          </template>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700">默认分页大小</label>
              <n-select
                v-model:value="localSettings.pageSize"
                :options="pageSizeOptions"
                @update:value="updatePageSize"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700">默认查询天数</label>
              <n-select
                v-model:value="localSettings.defaultDateRange"
                :options="dateRangeOptions"
                @update:value="updateDateRange"
              />
            </div>
          </div>
        </n-card>

        <n-card v-if="showBuildBidCard" class="shadow-sm border border-gray-200">
          <template #header>
            <div class="flex items-center space-x-3">
              <Icon icon="mdi:cash-multiple" class="w-5 h-5 text-gray-600" />
              <div>
                <h3 class="text-lg font-semibold text-gray-900">搭建出价</h3>
                <p class="text-sm text-gray-500">按当前渠道设置搭建出价，未填写时自动使用默认值</p>
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600"
            >
              <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <span
                  >当前渠道：<strong class="text-gray-900">{{ activeChannelName }}</strong></span
                >
                <span
                  >当前生效出价：<strong class="text-gray-900">{{
                    effectiveBuildBidLabel
                  }}</strong></span
                >
              </div>
              <p class="mt-2 text-xs text-gray-500">
                默认出价：{{ buildBidConfig.channelDefaultBid || '未配置' }}
              </p>
            </div>

            <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div
                v-if="!buildBidConfig.channelDefaultBid"
                class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                当前渠道暂未配置默认出价，请联系管理员先补充。
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700">出价</label>
                <n-input-number
                  :value="getBuildBidInputDisplayValue()"
                  :min="0"
                  :step="0.1"
                  clearable
                  class="w-full"
                  placeholder="未填写时使用默认出价"
                  @update:value="handleBuildBidInputChange"
                />
                <p class="text-xs text-gray-500">当前渠道未单独设置时，将自动使用默认出价。</p>
              </div>

              <div class="flex flex-wrap gap-3">
                <n-button type="primary" :loading="savingBuildBid" @click="saveBuildBid">
                  保存
                </n-button>
                <n-button
                  :disabled="savingBuildBid || !buildBidConfig.userBid"
                  @click="resetBuildBid"
                >
                  恢复默认
                </n-button>
              </div>
            </div>
          </div>
        </n-card>

        <n-card class="shadow-sm border border-gray-200">
          <template #header>
            <div class="flex items-center space-x-3">
              <Icon icon="mdi:refresh" class="w-5 h-5 text-gray-600" />
              <div>
                <h3 class="text-lg font-semibold text-gray-900">自动刷新</h3>
                <p class="text-sm text-gray-500">控制首页和列表页的数据刷新节奏</p>
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-base font-medium text-gray-900">启用自动刷新</h4>
                <p class="text-sm text-gray-500">定期自动刷新数据</p>
              </div>
              <n-switch
                v-model:value="localSettings.autoRefresh"
                @update:value="updateAutoRefresh"
              />
            </div>

            <div
              v-if="localSettings.autoRefresh"
              class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700">刷新间隔时间（秒）</label>
                <n-input-number
                  v-model:value="localSettings.refreshInterval"
                  :min="30"
                  :max="600"
                  :step="30"
                  class="w-full"
                  @update:value="(value: number | null) => value && updateRefreshInterval(value)"
                />
                <p class="text-xs text-gray-500">建议 60-300 秒</p>
              </div>
            </div>
          </div>
        </n-card>

        <n-card class="shadow-sm border border-gray-200">
          <template #header>
            <div class="flex items-center space-x-3">
              <Icon icon="mdi:account-group-outline" class="w-5 h-5 text-gray-600" />
              <div>
                <h3 class="text-lg font-semibold text-gray-900">抖音号素材配置</h3>
                <p class="text-sm text-gray-500">
                  当前渠道只维护素材序号，抖音号名称、ID
                  和合作码统一来自管理员后台绑定到当前用户的抖音号列表。
                </p>
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600"
            >
              <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <span
                  >当前渠道：<strong class="text-gray-900">{{ activeChannelName }}</strong></span
                >
                <span
                  >共 {{ materialMatches.length }} 条规则，{{
                    validMaterialMatchCount
                  }}
                  条有效</span
                >
              </div>
              <p class="mt-2 text-xs text-gray-500">
                这里展示的就是管理员后台给当前用户在当前渠道下配置的规则；你修改后，后台会同步看到同样内容。
              </p>
            </div>

            <div
              v-if="!hasAvailableDouyinAccounts"
              class="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700"
            >
              当前用户还没有绑定抖音号，请先到管理员后台的“抖音号配置”里维护抖音号名称、抖音号 ID
              和合作码。
            </div>

            <div v-if="materialMatches.length" class="space-y-3">
              <div
                v-for="match in materialMatches"
                :key="match.id"
                class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <n-select
                    v-model:value="match.douyinAccountRefId"
                    :options="douyinAccountOptions"
                    filterable
                    placeholder="请选择抖音号"
                  />
                  <n-input
                    v-model:value="match.materialRange"
                    placeholder="请输入素材序号，如 01-05"
                  />
                </div>
                <div class="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <div class="space-y-1">
                    <p>
                      {{
                        isMaterialMatchValid(match)
                          ? '已配置完整，可直接生效'
                          : '请先选择抖音号并填写素材序号'
                      }}
                    </p>
                    <p>
                      抖音号ID：{{
                        getMaterialMatchAccountMeta(match).douyinAccountId || '未绑定'
                      }}
                      · 合作码：{{ getMaterialMatchAccountMeta(match).cooperationCode || '未填写' }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <n-button
                      size="small"
                      tertiary
                      type="primary"
                      @click="saveMaterialMatch(match.id)"
                    >
                      保存
                    </n-button>
                    <n-button
                      size="small"
                      tertiary
                      type="error"
                      @click="removeMaterialMatch(match.id)"
                    >
                      删除
                    </n-button>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else
              class="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500"
            >
              当前渠道暂无抖音号素材规则，可以在下方为已绑定抖音号补充素材序号。
            </div>

            <div class="rounded-xl border border-dashed border-gray-300 bg-white p-4">
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-semibold text-gray-900">新增规则</h4>
                  <p class="text-xs text-gray-500">
                    从当前用户已绑定的抖音号中选择后，再填写素材序号
                  </p>
                </div>
                <n-button
                  type="primary"
                  :disabled="!hasAvailableDouyinAccounts"
                  @click="addMaterialMatch"
                >
                  新增规则
                </n-button>
              </div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <n-select
                  v-model:value="newMaterialMatch.douyinAccountRefId"
                  :options="douyinAccountOptions"
                  filterable
                  placeholder="请选择抖音号"
                  :disabled="!hasAvailableDouyinAccounts"
                />
                <n-input
                  v-model:value="newMaterialMatch.materialRange"
                  placeholder="请输入素材序号，如 01-05"
                  :disabled="!hasAvailableDouyinAccounts"
                />
              </div>
              <p class="mt-3 text-xs text-gray-500">
                抖音号ID：{{ getSelectedNewMaterialAccountMeta().douyinAccountId || '未选择' }} ·
                合作码：
                {{ getSelectedNewMaterialAccountMeta().cooperationCode || '未填写' }}
              </p>
            </div>
          </div>
        </n-card>

        <n-card class="shadow-sm border border-gray-200">
          <template #header>
            <div class="flex items-center space-x-3">
              <Icon icon="mdi:database" class="w-5 h-5 text-gray-600" />
              <div>
                <h3 class="text-lg font-semibold text-gray-900">数据管理</h3>
                <p class="text-sm text-gray-500">清理缓存和恢复默认设置</p>
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <div
              class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div class="flex items-start space-x-3">
                <Icon icon="mdi:delete-sweep" class="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 class="text-base font-medium text-gray-900">清除缓存数据</h4>
                  <p class="text-sm text-gray-600">清除本地缓存数据</p>
                </div>
              </div>
              <n-button type="warning" size="medium" @click="clearCache">
                <template #icon>
                  <Icon icon="mdi:delete-sweep" class="w-4 h-4" />
                </template>
                清除缓存
              </n-button>
            </div>

            <div
              class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div class="flex items-start space-x-3">
                <Icon icon="mdi:restore" class="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 class="text-base font-medium text-gray-900">重置所有设置</h4>
                  <p class="text-sm text-gray-600">恢复默认设置</p>
                </div>
              </div>
              <n-button type="error" size="medium" @click="resetAllSettings">
                <template #icon>
                  <Icon icon="mdi:restore" class="w-4 h-4" />
                </template>
                重置设置
              </n-button>
            </div>
          </div>
        </n-card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  useMessage,
  useDialog,
  NButton,
  NCard,
  NInput,
  NSelect,
  NSwitch,
  NInputNumber,
} from 'naive-ui'
import { getBuildBidConfig, updateBuildBidConfig, type BuildBidConfig } from '@/api/buildBid'
import { useSettingsStore } from '@/stores/settings'
import { useApiConfigStore } from '@/stores/apiConfig'
import { useSessionStore } from '@/stores/session'
import { useDouyinMaterialStore } from '@/stores/douyinMaterial'
import { formatBuildBidInputValue, parseBuildBidInputValue } from '@/utils/buildBid'

defineOptions({
  name: 'SettingsPage',
})

const message = useMessage()
const dialog = useDialog()

const settingsStore = useSettingsStore()
const apiConfigStore = useApiConfigStore()
const sessionStore = useSessionStore()
const douyinMaterialStore = useDouyinMaterialStore()

const localSettings = ref({
  pageSize: 10,
  defaultDateRange: 'today' as 'today' | '3days' | '7days' | '30days' | 'all',
  autoRefresh: false,
  refreshInterval: 60,
  autoUploadEnabled: false,
  autoUploadInterval: 300,
})

const pageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 },
  { label: '100 条/页', value: 100 },
]

const dateRangeOptions = [
  { label: '今日', value: 'today' },
  { label: '近3日', value: '3days' },
  { label: '近7日', value: '7days' },
  { label: '近30日', value: '30days' },
  { label: '至今', value: 'all' },
]

const materialMatches = ref(douyinMaterialStore.matches)
const savingBuildBid = ref(false)
const buildBidInput = ref<number | null>(null)
const newMaterialMatch = ref({
  douyinAccountRefId: '',
  materialRange: '',
})

function createDefaultBuildBidConfig(): BuildBidConfig {
  return {
    channelId: '',
    channelName: '',
    channelBidEnabled: false,
    channelDefaultBid: '',
    userBid: '',
    effectiveBid: '',
    effectiveSource: 'disabled',
  }
}

const buildBidConfig = ref<BuildBidConfig>(createDefaultBuildBidConfig())

const availableDouyinAccounts = computed(() => {
  const runtimeAccounts = Array.isArray(sessionStore.currentRuntimeUser?.douyinAccounts)
    ? sessionStore.currentRuntimeUser?.douyinAccounts
    : []
  const currentAccounts = Array.isArray(sessionStore.currentUser?.douyinAccounts)
    ? sessionStore.currentUser?.douyinAccounts
    : []

  return runtimeAccounts.length > 0 ? runtimeAccounts : currentAccounts
})

const hasAvailableDouyinAccounts = computed(() => availableDouyinAccounts.value.length > 0)

const douyinAccountOptions = computed(() =>
  availableDouyinAccounts.value.map(account => ({
    label: account.douyinAccount || account.douyinAccountId || '未命名抖音号',
    value: account.id,
  }))
)

const activeChannelName = computed(() => {
  const activeChannelId = sessionStore.activeChannelId
  if (activeChannelId) {
    const matchedChannel = sessionStore.availableChannels.find(
      channel => channel.id === activeChannelId
    )
    if (matchedChannel?.name) {
      return matchedChannel.name
    }
  }

  return sessionStore.currentChannel?.name || '未选择渠道'
})

const showBuildBidCard = computed(() => buildBidConfig.value.channelBidEnabled)

const effectiveBuildBidLabel = computed(() => {
  if (!buildBidConfig.value.channelBidEnabled) {
    return '未启用'
  }
  return buildBidConfig.value.effectiveBid || '未配置'
})

const validMaterialMatchCount = computed(
  () => materialMatches.value.filter(match => isMaterialMatchValid(match)).length
)

function initLocalState() {
  const settings = settingsStore.settings
  localSettings.value = {
    pageSize: settings.pageSize,
    defaultDateRange: settings.defaultDateRange,
    autoRefresh: settings.autoRefresh,
    refreshInterval: settings.refreshInterval,
    autoUploadEnabled: settings.autoUploadEnabled,
    autoUploadInterval: settings.autoUploadInterval,
  }
}

watch(
  () => settingsStore.settings,
  () => initLocalState(),
  { immediate: true }
)

watch(
  () => douyinMaterialStore.matches,
  value => {
    materialMatches.value = value.map(item => ({ ...item }))
  },
  { immediate: true, deep: true }
)

watch(
  () => sessionStore.activeChannelId,
  activeChannelId => {
    if (!activeChannelId) {
      materialMatches.value = []
      buildBidConfig.value = createDefaultBuildBidConfig()
      buildBidInput.value = null
      return
    }
    buildBidConfig.value = createDefaultBuildBidConfig()
    buildBidInput.value = null
    void douyinMaterialStore.loadFromServer(true)
    void loadBuildBidConfig()
  },
  { immediate: true }
)

async function loadBuildBidConfig() {
  if (!sessionStore.activeChannelId) {
    buildBidConfig.value = createDefaultBuildBidConfig()
    buildBidInput.value = null
    return
  }

  try {
    const data = await getBuildBidConfig()
    buildBidConfig.value = data
    buildBidInput.value = parseBuildBidInputValue(data.userBid)
  } catch {
    buildBidConfig.value = createDefaultBuildBidConfig()
    buildBidInput.value = null
  }
}

function getBuildBidInputDisplayValue() {
  if (buildBidInput.value !== null) {
    return buildBidInput.value
  }

  return parseBuildBidInputValue(buildBidConfig.value.channelDefaultBid)
}

function handleBuildBidInputChange(value: number | null) {
  buildBidInput.value = value
}

async function persistBuildBid(bid: string) {
  savingBuildBid.value = true
  try {
    const data = await updateBuildBidConfig({ bid })
    buildBidConfig.value = data
    buildBidInput.value = parseBuildBidInputValue(data.userBid)
    message.success(bid ? '出价已保存' : '已恢复默认出价')
  } finally {
    savingBuildBid.value = false
  }
}

async function saveBuildBid() {
  const nextBid = formatBuildBidInputValue(buildBidInput.value)
  if (!buildBidConfig.value.userBid && nextBid === buildBidConfig.value.channelDefaultBid) {
    await persistBuildBid('')
    return
  }

  await persistBuildBid(nextBid)
}

async function resetBuildBid() {
  buildBidInput.value = null
  await persistBuildBid('')
}

function updatePageSize(value: number) {
  settingsStore.updateSettings({ pageSize: value })
  message.success('分页大小已更新')
}

function updateDateRange(value: 'today' | '3days' | '7days' | '30days' | 'all') {
  settingsStore.updateSettings({ defaultDateRange: value })
  if (value === 'today') {
    message.success('默认查询天数已更新为“今日”，所有页面将筛选今日数据')
  } else {
    message.success('默认查询天数已更新')
  }
}

function updateAutoRefresh(value: boolean) {
  settingsStore.updateSettings({ autoRefresh: value })
  message.success(`自动刷新已${value ? '开启' : '关闭'}`)
}

function updateRefreshInterval(value: number) {
  settingsStore.updateSettings({ refreshInterval: value })
  message.success('刷新间隔已更新')
}

function clearCache() {
  localStorage.removeItem('studio_runtime_channel_config')
  localStorage.removeItem('appSettings')
  message.success('缓存数据已清除')
}

function isMaterialMatchValid(match: { douyinAccountRefId?: string; materialRange?: string }) {
  return Boolean(
    String(match.douyinAccountRefId || '').trim() && String(match.materialRange || '').trim()
  )
}

function getMaterialMatchAccountMeta(match: {
  douyinAccountRefId?: string
  douyinAccount?: string
  douyinAccountId?: string
  cooperationCode?: string
}) {
  const matchedAccount = availableDouyinAccounts.value.find(
    account => account.id === String(match.douyinAccountRefId || '').trim()
  )

  return {
    douyinAccount: matchedAccount?.douyinAccount || String(match.douyinAccount || '').trim(),
    douyinAccountId: matchedAccount?.douyinAccountId || String(match.douyinAccountId || '').trim(),
    cooperationCode: matchedAccount?.cooperationCode || String(match.cooperationCode || '').trim(),
  }
}

function getSelectedNewMaterialAccountMeta() {
  return getMaterialMatchAccountMeta({
    douyinAccountRefId: newMaterialMatch.value.douyinAccountRefId,
  })
}

async function addMaterialMatch() {
  const payload = {
    douyinAccountRefId: String(newMaterialMatch.value.douyinAccountRefId || '').trim(),
    materialRange: String(newMaterialMatch.value.materialRange || '').trim(),
  }

  if (!isMaterialMatchValid(payload)) {
    message.warning('请先选择抖音号并填写素材序号')
    return
  }

  try {
    await douyinMaterialStore.addMatch(payload.douyinAccountRefId, payload.materialRange)
    newMaterialMatch.value = {
      douyinAccountRefId: '',
      materialRange: '',
    }
    message.success('规则已新增')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '新增规则失败')
  }
}

async function saveMaterialMatch(matchId: string) {
  const match = materialMatches.value.find(item => item.id === matchId)
  if (!match) {
    return
  }

  if (!isMaterialMatchValid(match)) {
    message.warning('请先选择抖音号并填写素材序号')
    return
  }

  try {
    await douyinMaterialStore.updateMatch(
      match.id,
      String(match.douyinAccountRefId || '').trim(),
      String(match.materialRange || '').trim()
    )
    message.success('规则已保存')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存规则失败')
    await douyinMaterialStore.loadFromServer(true)
  }
}

async function removeMaterialMatch(matchId: string) {
  try {
    await douyinMaterialStore.deleteMatch(matchId)
    message.success('规则已删除')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除规则失败')
  }
}

async function resetAllSettings() {
  try {
    await new Promise<void>((resolve, reject) => {
      dialog.error({
        title: '确认重置',
        content: '确定要重置所有设置吗？此操作不可撤销，将清除所有本地偏好配置。',
        positiveText: '确定重置',
        negativeText: '取消',
        onPositiveClick: () => resolve(),
        onNegativeClick: () => reject(),
      })
    })

    settingsStore.resetSettings()
    apiConfigStore.resetConfig()
    localStorage.removeItem('studio_runtime_channel_config')
    localStorage.removeItem('appSettings')
    initLocalState()

    message.success('所有设置已重置为默认值')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
}

:deep(.n-card .n-card-header) {
  padding: 16px 20px 12px;
  border-bottom: 1px solid #f0f0f0;
}

:deep(.n-card .n-card__content) {
  padding: 16px 20px;
}

:deep(.n-input-number) {
  width: 100%;
}

@media (max-width: 768px) {
  .settings-page {
    padding: 0 16px;
  }
}
</style>
