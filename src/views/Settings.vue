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

        <n-card v-if="showBuildAdvanceCard" class="shadow-sm border border-gray-200">
          <template #header>
            <div class="flex items-center space-x-3">
              <Icon icon="mdi:clock-outline" class="w-5 h-5 text-gray-600" />
              <div>
                <h3 class="text-lg font-semibold text-gray-900">智能搭建时机</h3>
                <p class="text-sm text-gray-500">
                  按当前渠道单独覆盖最早可搭建时间，未保存时沿用渠道默认规则
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
                  >当前生效规则：<strong class="text-gray-900">{{
                    effectiveBuildAdvanceText
                  }}</strong></span
                >
              </div>
              <p class="mt-2 text-xs text-gray-500">
                渠道默认：{{ channelDefaultBuildAdvanceText }}
              </p>
            </div>

            <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <div class="space-y-2">
                  <label class="text-sm font-medium text-gray-700">禁提前开始</label>
                  <n-select
                    :value="buildAdvanceDraft.forbiddenAdvanceStartHour"
                    :options="advanceHourOptions"
                    @update:value="
                      handleBuildAdvanceHourChange('forbiddenAdvanceStartHour', $event)
                    "
                  />
                </div>
                <div class="flex items-end justify-center pb-2 text-sm text-gray-400">至</div>
                <div class="space-y-2">
                  <label class="text-sm font-medium text-gray-700">禁提前结束</label>
                  <n-select
                    :value="buildAdvanceDraft.forbiddenAdvanceEndHour"
                    :options="advanceHourEndOptions"
                    @update:value="handleBuildAdvanceHourChange('forbiddenAdvanceEndHour', $event)"
                  />
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700">其他时段提前搭建</label>
                <n-input-number
                  :value="getBuildAdvanceHoursInputValue(buildAdvanceDraft.advanceBuildHours)"
                  :min="0"
                  :precision="0"
                  class="w-full"
                  @update:value="handleBuildAdvanceHoursChange"
                >
                  <template #suffix>小时</template>
                </n-input-number>
                <p class="text-xs text-gray-500">
                  开始和结束填一样表示不启用禁提前时段；设为 0
                  时，其余时段也必须等上架时间后才能搭建。
                </p>
              </div>

              <div class="flex flex-wrap gap-3">
                <n-button type="primary" :loading="savingBuildAdvance" @click="saveBuildAdvance">
                  保存
                </n-button>
                <n-button
                  :disabled="savingBuildAdvance || !buildAdvanceConfig.useCustom"
                  @click="resetBuildAdvance"
                >
                  恢复渠道默认
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
                <p class="text-sm text-gray-500">按当前渠道维护抖音号与素材序号的对应关系</p>
              </div>
            </div>
          </template>
          <div class="space-y-4 material-panel">
            <div class="material-panel__hero">
              <div class="material-panel__summary">
                <div>
                  <p class="material-panel__eyebrow">当前渠道</p>
                  <h4 class="material-panel__channel">{{ activeChannelName }}</h4>
                </div>
                <div class="material-panel__stats">
                  <span class="material-panel__stat">{{ materialMatches.length }} 条规则</span>
                  <span class="material-panel__stat material-panel__stat--success"
                    >{{ validMaterialMatchCount }} 条有效</span
                  >
                </div>
              </div>
              <div class="material-panel__actions">
                <div class="material-panel__average-box">
                  <span class="material-panel__average-label">平均分配</span>
                  <n-input-number
                    v-model:value="averageMaterialTotal"
                    :min="1"
                    :precision="0"
                    placeholder="素材总数"
                    class="material-panel__average-input"
                  />
                  <n-button
                    tertiary
                    type="primary"
                    :disabled="!materialMatchesWithAccountCount"
                    @click="applyAverageMaterialRanges"
                  >
                    自动填写
                  </n-button>
                </div>
                <n-button
                  quaternary
                  type="primary"
                  :disabled="!hasAvailableDouyinAccounts"
                  :loading="savingAllMaterialMatches"
                  @click="saveAllMaterialMatches"
                >
                  保存全部
                </n-button>
              </div>
              <p class="material-panel__note">
                先选抖音号，再按素材总数自动平均分配；已在其他启用渠道占用的抖音号不可重复选择。
              </p>
            </div>

            <div
              v-if="!hasAvailableDouyinAccounts"
              class="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700"
            >
              当前用户还没有绑定抖音号，请先到管理员后台的“抖音号配置”里维护。
            </div>

            <div v-else class="material-select-box">
              <div>
                <h4 class="text-sm font-semibold text-slate-900">选择抖音号</h4>
                <p class="mt-1 text-xs text-slate-500">
                  共 {{ availableDouyinAccounts.length }} 个可用抖音号，当前已选
                  {{ materialMatchesWithAccountCount }} 个。
                </p>
              </div>
              <n-select
                :value="selectedMaterialAccountIds"
                multiple
                filterable
                clearable
                max-tag-count="responsive"
                :options="materialAccountSelectOptions"
                placeholder="请选择当前渠道要使用的抖音号"
                @update:value="handleMaterialSelectionChange"
              />
              <p v-if="occupiedMaterialAccountCount" class="material-select-box__hint">
                有
                {{ occupiedMaterialAccountCount }}
                个抖音号已被其他已启用渠道占用，因此这里不可重复选择。
              </p>
            </div>

            <div v-if="materialMatches.length" class="space-y-3">
              <div
                v-for="(match, index) in materialMatches"
                :key="match.id"
                class="material-rule-card"
              >
                <div class="material-rule-card__index">{{ index + 1 }}</div>
                <div class="material-rule-card__content">
                  <div class="material-rule-card__top">
                    <div class="material-rule-card__account-block">
                      <p class="material-rule-card__account-name-row">
                        <span class="material-rule-card__account-name">
                          {{ getMaterialMatchAccountMeta(match).douyinAccount || '未命名抖音号' }}
                        </span>
                        <span
                          v-if="getMaterialMatchAccountMeta(match).douyinAccountId"
                          class="material-rule-card__account-id"
                        >
                          ID {{ getMaterialMatchAccountMeta(match).douyinAccountId }}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div class="material-rule-card__bottom">
                    <n-input v-model:value="match.materialRange" placeholder="素材序号，如 01-05" />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else
              class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500"
            >
              先从上方选择抖音号，再填写或自动分配素材序号。
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
import {
  getBuildAdvanceConfig,
  resetBuildAdvanceConfig,
  updateBuildAdvanceConfig,
  type BuildAdvanceConfigResponse,
} from '@/api/buildAdvance'
import { useSettingsStore } from '@/stores/settings'
import { useApiConfigStore } from '@/stores/apiConfig'
import { useSessionStore } from '@/stores/session'
import { useDouyinMaterialStore } from '@/stores/douyinMaterial'
import { formatBuildBidInputValue, parseBuildBidInputValue } from '@/utils/buildBid'
import { getAdvanceRuleDescription } from '@/shared/buildWorkflowRules'

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
const savingBuildAdvance = ref(false)
const savingAllMaterialMatches = ref(false)
const buildBidInput = ref<number | null>(null)
const averageMaterialTotal = ref<number | null>(null)
const selectedMaterialAccountIds = ref<string[]>([])
const MATERIAL_SELECT_ALL_VALUE = '__material_select_all__'
const buildAdvanceDraft = ref({
  forbiddenAdvanceStartHour: '0',
  forbiddenAdvanceEndHour: '0',
  advanceBuildHours: '0',
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

function createDefaultBuildAdvanceConfig(): BuildAdvanceConfigResponse {
  return {
    channelId: '',
    channelName: '',
    allowCustom: false,
    useCustom: false,
    channelDefaultConfig: {
      forbiddenAdvanceStartHour: '0',
      forbiddenAdvanceEndHour: '0',
      advanceBuildHours: '0',
    },
    userCustomConfig: {
      forbiddenAdvanceStartHour: '0',
      forbiddenAdvanceEndHour: '0',
      advanceBuildHours: '0',
    },
    effectiveConfig: {
      forbiddenAdvanceStartHour: '0',
      forbiddenAdvanceEndHour: '0',
      advanceBuildHours: '0',
    },
    effectiveSource: 'channel',
  }
}

const buildAdvanceConfig = ref<BuildAdvanceConfigResponse>(createDefaultBuildAdvanceConfig())

const advanceHourOptions = Array.from({ length: 25 }, (_, hour) => ({
  label: `${String(hour).padStart(2, '0')}:00`,
  value: String(hour),
}))

const advanceHourEndOptions = advanceHourOptions

function normalizeAdvanceHourValue(value: string | number | null | undefined) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return 0
  }

  if (numericValue < 0) {
    return 0
  }

  if (numericValue > 24) {
    return 24
  }

  return Math.floor(numericValue)
}

function normalizeAdvanceHoursValue(value: string | number | null | undefined) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }
  return Math.floor(numericValue)
}

function syncBuildAdvanceDraftFromConfig(data: BuildAdvanceConfigResponse) {
  const sourceConfig = data.useCustom ? data.userCustomConfig : data.channelDefaultConfig
  buildAdvanceDraft.value = {
    forbiddenAdvanceStartHour: String(
      normalizeAdvanceHourValue(sourceConfig.forbiddenAdvanceStartHour)
    ),
    forbiddenAdvanceEndHour: String(
      normalizeAdvanceHourValue(sourceConfig.forbiddenAdvanceEndHour)
    ),
    advanceBuildHours: String(normalizeAdvanceHoursValue(sourceConfig.advanceBuildHours)),
  }
}

function formatBuildAdvanceText(config: {
  forbiddenAdvanceStartHour?: string
  forbiddenAdvanceEndHour?: string
  advanceBuildHours?: string
}) {
  return getAdvanceRuleDescription(config)
}

function handleBuildAdvanceHourChange(
  field: 'forbiddenAdvanceStartHour' | 'forbiddenAdvanceEndHour',
  value: string | null
) {
  buildAdvanceDraft.value[field] = String(normalizeAdvanceHourValue(value))
}

function getBuildAdvanceHoursInputValue(value: string | number | null | undefined) {
  return normalizeAdvanceHoursValue(value)
}

function handleBuildAdvanceHoursChange(value: number | null) {
  buildAdvanceDraft.value.advanceBuildHours = String(normalizeAdvanceHoursValue(value))
}

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

const currentChannelConfigs = computed(() => {
  const runtimeConfigs = sessionStore.currentRuntimeUser?.channelConfigs
  if (runtimeConfigs && typeof runtimeConfigs === 'object') {
    return runtimeConfigs as Record<
      string,
      { enabled?: boolean; douyinMaterialMatches?: Array<{ douyinAccountRefId?: string }> }
    >
  }

  const userConfigs = sessionStore.currentUser?.channelConfigs
  if (userConfigs && typeof userConfigs === 'object') {
    return userConfigs as Record<
      string,
      { enabled?: boolean; douyinMaterialMatches?: Array<{ douyinAccountRefId?: string }> }
    >
  }

  return {}
})

const occupiedMaterialAccountIds = computed(() => {
  const currentChannelId = String(sessionStore.activeChannelId || '').trim()
  const occupiedIds = new Set<string>()

  Object.entries(currentChannelConfigs.value).forEach(([channelId, config]) => {
    if (!config?.enabled || channelId === currentChannelId) {
      return
    }

    ;(config.douyinMaterialMatches || []).forEach(match => {
      const refId = String(match?.douyinAccountRefId || '').trim()
      if (refId) {
        occupiedIds.add(refId)
      }
    })
  })

  return occupiedIds
})

const occupiedMaterialAccountCount = computed(() => occupiedMaterialAccountIds.value.size)

const selectableMaterialAccountIds = computed(() =>
  availableDouyinAccounts.value
    .map(account => String(account.id || '').trim())
    .filter(accountId => accountId && !occupiedMaterialAccountIds.value.has(accountId))
)

const materialAccountSelectOptions = computed(() => {
  const currentSelectedIds = new Set(selectedMaterialAccountIds.value)

  return [
    {
      label: allSelectableMaterialAccountsSelected.value ? '取消全选' : '全选可选抖音号',
      value: MATERIAL_SELECT_ALL_VALUE,
      disabled: !selectableMaterialAccountIds.value.length,
    },
    ...availableDouyinAccounts.value.map(account => ({
      label: account.douyinAccount || account.douyinAccountId || '未命名抖音号',
      value: account.id,
      disabled:
        occupiedMaterialAccountIds.value.has(account.id) && !currentSelectedIds.has(account.id),
    })),
  ]
})

const allSelectableMaterialAccountsSelected = computed(() => {
  const selectableIds = selectableMaterialAccountIds.value
  if (!selectableIds.length) {
    return false
  }

  const selectedIds = new Set(selectedMaterialAccountIds.value)
  return selectableIds.every(accountId => selectedIds.has(accountId))
})

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
const showBuildAdvanceCard = computed(() => buildAdvanceConfig.value.allowCustom)

const effectiveBuildBidLabel = computed(() => {
  if (!buildBidConfig.value.channelBidEnabled) {
    return '未启用'
  }
  return buildBidConfig.value.effectiveBid || '未配置'
})

const effectiveBuildAdvanceText = computed(() =>
  formatBuildAdvanceText(buildAdvanceConfig.value.effectiveConfig)
)

const channelDefaultBuildAdvanceText = computed(() =>
  formatBuildAdvanceText(buildAdvanceConfig.value.channelDefaultConfig)
)

const validMaterialMatchCount = computed(
  () => materialMatches.value.filter(match => isMaterialMatchValid(match)).length
)

const materialMatchesWithAccountCount = computed(
  () => materialMatches.value.filter(match => String(match.douyinAccountRefId || '').trim()).length
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
    selectedMaterialAccountIds.value = value
      .map(item => String(item.douyinAccountRefId || '').trim())
      .filter(Boolean)
  },
  { immediate: true, deep: true }
)

watch(
  selectedMaterialAccountIds,
  value => {
    syncMaterialMatchesFromSelectedIds(value)
  },
  { deep: true }
)

watch(
  () => sessionStore.activeChannelId,
  activeChannelId => {
    if (!activeChannelId) {
      materialMatches.value = []
      selectedMaterialAccountIds.value = []
      averageMaterialTotal.value = null
      buildBidConfig.value = createDefaultBuildBidConfig()
      buildBidInput.value = null
      buildAdvanceConfig.value = createDefaultBuildAdvanceConfig()
      syncBuildAdvanceDraftFromConfig(buildAdvanceConfig.value)
      return
    }
    buildBidConfig.value = createDefaultBuildBidConfig()
    buildBidInput.value = null
    buildAdvanceConfig.value = createDefaultBuildAdvanceConfig()
    averageMaterialTotal.value = null
    syncBuildAdvanceDraftFromConfig(buildAdvanceConfig.value)
    void douyinMaterialStore.loadFromServer(true)
    void loadBuildBidConfig()
    void loadBuildAdvanceConfig()
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

async function loadBuildAdvanceConfig() {
  if (!sessionStore.activeChannelId) {
    buildAdvanceConfig.value = createDefaultBuildAdvanceConfig()
    syncBuildAdvanceDraftFromConfig(buildAdvanceConfig.value)
    return
  }

  try {
    const data = await getBuildAdvanceConfig()
    buildAdvanceConfig.value = data
    syncBuildAdvanceDraftFromConfig(data)
  } catch {
    buildAdvanceConfig.value = createDefaultBuildAdvanceConfig()
    syncBuildAdvanceDraftFromConfig(buildAdvanceConfig.value)
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

async function saveBuildAdvance() {
  savingBuildAdvance.value = true
  try {
    const data = await updateBuildAdvanceConfig({
      forbiddenAdvanceStartHour: buildAdvanceDraft.value.forbiddenAdvanceStartHour,
      forbiddenAdvanceEndHour: buildAdvanceDraft.value.forbiddenAdvanceEndHour,
      advanceBuildHours: buildAdvanceDraft.value.advanceBuildHours,
    })
    buildAdvanceConfig.value = data
    syncBuildAdvanceDraftFromConfig(data)
    message.success('智能搭建时机已保存')
  } finally {
    savingBuildAdvance.value = false
  }
}

async function resetBuildAdvance() {
  savingBuildAdvance.value = true
  try {
    const data = await resetBuildAdvanceConfig()
    buildAdvanceConfig.value = data
    syncBuildAdvanceDraftFromConfig(data)
    message.success('已恢复渠道默认智能搭建时机')
  } finally {
    savingBuildAdvance.value = false
  }
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

function createDraftMaterialMatch(douyinAccountRefId: string) {
  return {
    id: `draft-${crypto.randomUUID()}`,
    douyinAccountRefId,
    douyinAccount: '',
    douyinAccountId: '',
    cooperationCode: '',
    materialRange: '',
    createdAt: '',
    updatedAt: '',
  }
}

function syncMaterialMatchesFromSelectedIds(accountIds: string[]) {
  const uniqueAccountIds = Array.from(
    new Set(
      accountIds
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter(item => !occupiedMaterialAccountIds.value.has(item))
    )
  )
  const currentMatchMap = new Map(
    materialMatches.value.map(match => [String(match.douyinAccountRefId || '').trim(), match])
  )

  materialMatches.value = uniqueAccountIds.map(accountId => {
    const currentMatch = currentMatchMap.get(accountId)
    return currentMatch
      ? {
          ...currentMatch,
          douyinAccountRefId: accountId,
        }
      : createDraftMaterialMatch(accountId)
  })
}

function handleMaterialSelectionChange(value: string[] | null) {
  const rawSelectedIds = (Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
  const includesSelectAll = rawSelectedIds.includes(MATERIAL_SELECT_ALL_VALUE)

  if (includesSelectAll) {
    selectedMaterialAccountIds.value = allSelectableMaterialAccountsSelected.value
      ? []
      : [...selectableMaterialAccountIds.value]
    return
  }

  selectedMaterialAccountIds.value = Array.from(
    new Set(
      rawSelectedIds
        .filter(item => item !== MATERIAL_SELECT_ALL_VALUE)
        .filter(item => !occupiedMaterialAccountIds.value.has(item))
    )
  )
}

function applyAverageMaterialRanges() {
  const totalCount = Number(averageMaterialTotal.value)
  const matches = materialMatches.value.filter(match =>
    String(match.douyinAccountRefId || '').trim()
  )

  if (!matches.length) {
    message.warning('请先选择至少 1 个抖音号')
    return
  }

  if (!Number.isFinite(totalCount) || totalCount <= 0) {
    message.warning('请先输入有效的素材总数')
    return
  }

  if (totalCount < matches.length) {
    message.warning('素材总数不能少于已选择的抖音号数量')
    return
  }

  const baseCount = Math.floor(totalCount / matches.length)
  const remainder = totalCount % matches.length
  const padLength = Math.max(2, String(totalCount).length)
  let currentIndex = 1

  matches.forEach((match, index) => {
    const count = baseCount + (index < remainder ? 1 : 0)
    const start = currentIndex
    const end = currentIndex + count - 1
    const formatNumber = (value: number) => String(value).padStart(padLength, '0')

    match.materialRange =
      count === 1 ? formatNumber(start) : `${formatNumber(start)}-${formatNumber(end)}`
    currentIndex = end + 1
  })

  message.success(`已按 ${matches.length} 个抖音号平均分配 ${totalCount} 个素材`)
}

async function saveAllMaterialMatches() {
  const occupiedConflict = materialMatches.value.find(match =>
    occupiedMaterialAccountIds.value.has(String(match.douyinAccountRefId || '').trim())
  )

  if (occupiedConflict) {
    message.warning('存在已被其他启用渠道占用的抖音号，请先取消选择后再保存')
    return
  }

  const invalidMatch = materialMatches.value.find(match => !isMaterialMatchValid(match))
  if (invalidMatch) {
    message.warning('请先为所有已选择的抖音号填写素材序号')
    return
  }

  const targetMatches = materialMatches.value.map(match => ({
    ...match,
    douyinAccountRefId: String(match.douyinAccountRefId || '').trim(),
    materialRange: String(match.materialRange || '').trim(),
  }))
  const originalMatches = douyinMaterialStore.matches.map(match => ({ ...match }))
  const targetMatchMap = new Map(targetMatches.map(match => [match.douyinAccountRefId, match]))
  const originalMatchMap = new Map(
    originalMatches.map(match => [String(match.douyinAccountRefId || '').trim(), match])
  )

  savingAllMaterialMatches.value = true
  try {
    for (const match of originalMatches) {
      const refId = String(match.douyinAccountRefId || '').trim()
      if (!targetMatchMap.has(refId)) {
        await douyinMaterialStore.deleteMatch(match.id)
      }
    }

    for (const match of targetMatches) {
      const existingMatch = originalMatchMap.get(match.douyinAccountRefId)
      if (existingMatch) {
        await douyinMaterialStore.updateMatch(
          existingMatch.id,
          match.douyinAccountRefId,
          match.materialRange
        )
        continue
      }

      await douyinMaterialStore.addMatch(match.douyinAccountRefId, match.materialRange)
    }

    await douyinMaterialStore.loadFromServer(true)
    message.success('抖音号素材配置已保存')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存抖音号素材配置失败')
    await douyinMaterialStore.loadFromServer(true)
  } finally {
    savingAllMaterialMatches.value = false
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

.material-panel__hero {
  border: 1px solid #dbe4f0;
  border-radius: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%);
}

.material-panel__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.material-panel__eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  color: #64748b;
}

.material-panel__channel {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.material-panel__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.material-panel__stat {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #dbeafe;
  background: rgba(255, 255, 255, 0.82);
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.material-panel__stat--success {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.material-panel__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}

.material-panel__average-box {
  display: grid;
  grid-template-columns: auto minmax(120px, 180px) auto;
  gap: 10px;
  align-items: center;
}

.material-panel__average-label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.material-panel__note {
  margin: 10px 0 0;
  font-size: 12px;
  color: #64748b;
}

.material-select-box {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
  padding: 16px;
}

.material-select-box__hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #b45309;
}

.material-rule-card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
}

.material-rule-card__index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
}

.material-rule-card__content {
  min-width: 0;
}

.material-rule-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.material-rule-card__account-block {
  min-width: 0;
}

.material-rule-card__account-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.material-rule-card__account-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.material-rule-card__account-id {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.material-rule-card__bottom {
  margin-top: 12px;
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

  .material-panel__summary,
  .material-panel__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .material-panel__stats {
    justify-content: flex-start;
  }

  .material-panel__average-box {
    grid-template-columns: 1fr;
  }

  .material-rule-card {
    grid-template-columns: 1fr;
  }

  .material-rule-card__top {
    flex-direction: column;
    align-items: flex-start;
  }

  .material-rule-card__account-name-row {
    align-items: flex-start;
  }
}
</style>
