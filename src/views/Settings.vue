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
        <n-card class="shadow-sm border border-gray-200">
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
                  @update:value="value => value && updateRefreshInterval(value)"
                />
                <p class="text-xs text-gray-500">建议 60-300 秒</p>
              </div>
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
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  useMessage,
  useDialog,
  NButton,
  NCard,
  NSelect,
  NSwitch,
  NInputNumber,
} from 'naive-ui'
import { useSettingsStore } from '@/stores/settings'
import { useApiConfigStore } from '@/stores/apiConfig'

defineOptions({
  name: 'SettingsPage',
})

const message = useMessage()
const dialog = useDialog()

const settingsStore = useSettingsStore()
const apiConfigStore = useApiConfigStore()

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
