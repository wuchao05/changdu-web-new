<template>
  <div class="min-h-full bg-gradient-to-br from-slate-50 to-blue-50">
    <header
      class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 relative">
          <div class="flex items-center space-x-4 min-w-0 flex-1">
            <div
              class="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl"
            >
              <Icon icon="mdi:chart-line" class="w-6 h-6 text-white" />
            </div>
            <div
              v-if="isMobile && mobileUserLabels.length > 0"
              class="min-w-0 flex items-center"
            >
              <button
                v-for="label in mobileUserLabels"
                :key="`mobile-${label}`"
                type="button"
                class="user-label-badge user-label-badge--mobile"
              >
                <span class="user-label-badge__text">{{ label }}</span>
              </button>
            </div>
            <div class="min-w-0" v-if="!isMobile">
              <div class="flex items-center gap-2">
                <h1
                  class="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent"
                >
                  {{ dynamicTitle }}
                </h1>
                <button
                  v-for="label in desktopUserLabels"
                  :key="label"
                  type="button"
                  class="user-label-badge"
                >
                  <span class="user-label-badge__text">{{ label }}</span>
                </button>
              </div>
              <p class="text-xs text-gray-500 hidden sm:block">{{ dashboardSubtitle }}</p>
            </div>

            <div v-if="hasChannelTabs" class="hidden md:flex items-center min-w-0 flex-1">
              <div class="channel-tabs-shell compact">
                <span class="channel-tabs-prefix">渠道</span>
                <button
                  v-for="channel in channelTabs"
                  :key="channel.id"
                  type="button"
                  class="channel-tab-button"
                  :class="{ active: activeChannelTabId === channel.id }"
                  @click="handleChannelChange(channel.id)"
                >
                  <span class="channel-tab-dot"></span>
                  <span class="channel-tab-label">{{ channel.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="flex items-center" :class="isMobile ? 'space-x-2' : 'space-x-3'">
            <n-tooltip :disabled="!autoBuildDisabledReason" placement="bottom" trigger="hover">
              <template #trigger>
                <span class="inline-flex">
                  <n-button
                    type="warning"
                    :size="isMobile ? 'small' : 'medium'"
                    :disabled="Boolean(autoBuildDisabledReason)"
                    @click="handleAutoBuildClick"
                    class="auto-build-button"
                  >
                    <template #icon>
                      <Icon icon="mdi:hammer-wrench" :class="isMobile ? 'w-3 h-3' : 'w-4 h-4'" />
                    </template>
                    <span class="max-sm:hidden">提交搭建</span>
                  </n-button>
                </span>
              </template>
              {{ autoBuildDisabledReason }}
            </n-tooltip>

            <n-button
              v-if="canAccessSyncAccount"
              type="info"
              :size="isMobile ? 'small' : 'medium'"
              :disabled="!hasAccountTableId"
              @click="showSyncAccountModal = true"
              class="sync-account-button"
            >
              <template #icon>
                <Icon icon="mdi:account-sync-outline" :class="isMobile ? 'w-3 h-3' : 'w-4 h-4'" />
              </template>
              <span class="max-sm:hidden">同步账户</span>
            </n-button>

            <n-button
              text
              :disabled="!hasActiveChannel"
              @click="router.push('/clip')"
              class="!text-gray-600 hover:!text-purple-600 transition-colors"
            >
              <template #icon>
                <Icon icon="mdi:fire" :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" />
              </template>
              <span class="ml-1 max-sm:hidden">爆剧爆剪</span>
            </n-button>

            <n-button
              text
              @click="router.push('/settings')"
              class="!text-gray-600 hover:!text-gray-900 transition-colors"
            >
              <template #icon>
                <Icon icon="mdi:cog" :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" />
              </template>
              <span class="ml-1 max-sm:hidden">设置</span>
            </n-button>

            <n-dropdown
              trigger="click"
              :options="accountMenuOptions"
              @select="handleAccountMenuSelect"
            >
              <button type="button" class="account-entry-button">
                <span class="account-entry-avatar">
                  <Icon icon="mdi:account-circle" class="h-5 w-5" />
                </span>
                <span class="account-entry-content max-sm:hidden">
                  <span class="account-entry-row">
                    <span class="account-entry-name">{{ accountDisplayName }}</span>
                  </span>
                  <span class="account-entry-hint">账号操作</span>
                </span>
                <Icon icon="mdi:chevron-down" class="h-4 w-4 text-slate-400 max-sm:hidden" />
              </button>
            </n-dropdown>
          </div>
        </div>
      </div>

      <div
        v-if="hasChannelTabs"
        class="border-t border-gray-100/80 bg-white/70 backdrop-blur-md md:hidden"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div class="channel-tabs-shell">
            <span class="channel-tabs-prefix">渠道</span>
            <button
              v-for="channel in channelTabs"
              :key="channel.id"
              type="button"
              class="channel-tab-button"
              :class="{ active: activeChannelTabId === channel.id }"
              @click="handleChannelChange(channel.id)"
            >
              <span class="channel-tab-dot"></span>
              <span class="channel-tab-label">{{ channel.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div v-if="!hasActiveChannel" class="space-y-6">
        <div
          class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"
        >
          <div
            class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
          >
            <Icon icon="mdi:shape-plus-outline" class="h-8 w-8" />
          </div>
          <h2 class="mt-5 text-2xl font-bold text-slate-900">
            {{ isAdmin ? '还没有可用渠道' : '当前还没有分配可用渠道' }}
          </h2>
          <p class="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            {{
              isAdmin
                ? '请先进入管理员后台创建渠道，并为渠道绑定用户配置。创建完成后，再返回首页查看该渠道下的数据、爆剧爆剪和搭建能力。'
                : '请联系管理员先为你创建并分配渠道。渠道配置完成后，首页数据和业务操作才会开放。'
            }}
          </p>
          <div class="mt-6 flex justify-center gap-3">
            <n-button v-if="isAdmin" type="primary" @click="router.push('/admin')">
              前往管理员后台
            </n-button>
            <n-button tertiary @click="router.push('/settings')">查看个人设置</n-button>
          </div>
        </div>
      </div>

      <div v-else class="space-y-6">
        <n-card v-if="canAccessOverview" :bordered="false" class="shadow-sm">
          <template #header>
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div class="flex items-center gap-3">
                <Icon icon="mdi:chart-box-outline" class="w-5 h-5 text-blue-600" />
                <div>
                  <h3 class="text-lg font-semibold text-slate-900">数据概览</h3>
                  <div class="mt-1 flex items-center gap-2 flex-wrap">
                    <p class="text-sm text-slate-500">实时数据，一目了然</p>
                    <div class="refresh-status-pill" :class="{ active: autoRefreshEnabled }">
                      <span class="refresh-status-dot"></span>
                      <span>{{ autoRefreshLabel }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div v-if="overviewUpdatedAt" class="text-right">
                  <p class="text-xs text-slate-400">更新时间</p>
                  <p class="text-sm font-medium text-slate-600">{{ overviewUpdatedAt }}</p>
                </div>
                <button
                  type="button"
                  class="refresh-icon-button"
                  :disabled="overviewLoading"
                  @click="autoRefresh.manualRefresh()"
                  title="手动刷新"
                >
                  <Icon
                    icon="mdi:refresh"
                    class="h-5 w-5 text-emerald-600 transition-opacity duration-300"
                    :class="{ 'opacity-60': overviewLoading }"
                  />
                </button>
              </div>
            </div>
          </template>
          <n-alert v-if="overviewError" type="error" :show-icon="true" class="mb-4">
            {{ overviewError }}
          </n-alert>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div v-for="card in overviewCards" :key="card.label" class="overview-card group">
              <div class="overview-card-inner" :class="card.cardClass">
                <div class="flex items-center justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex items-center space-x-2 mb-2">
                      <div
                        class="w-3 h-3 rounded-full"
                        :class="
                          overviewLoading
                            ? 'overview-skeleton overview-skeleton--dot'
                            : `${card.dotClass} animate-pulse`
                        "
                      ></div>
                      <p
                        class="text-sm font-medium"
                        :class="[
                          card.labelClass,
                          overviewLoading ? 'overview-skeleton overview-skeleton--label' : '',
                        ]"
                      >
                        {{ overviewLoading ? '' : card.label }}
                      </p>
                    </div>
                    <p
                      class="text-2xl lg:text-3xl font-bold"
                      :class="[
                        card.labelClass,
                        overviewLoading ? 'overview-skeleton overview-skeleton--value' : '',
                      ]"
                    >
                      {{ overviewLoading ? '' : card.value }}
                    </p>
                    <div class="mt-2 flex items-center gap-2 text-xs">
                      <p
                        :class="[
                          card.metaClass,
                          overviewLoading ? 'overview-skeleton overview-skeleton--meta' : '',
                        ]"
                      >
                        {{ overviewLoading ? '' : card.meta }}
                      </p>
                      <div
                        v-if="!overviewLoading && card.diffValue !== null && card.diffValue !== 0"
                        class="flex items-center gap-1"
                        :class="card.diffValue > 0 ? 'text-red-500' : 'text-green-500'"
                      >
                        <Icon
                          :icon="card.diffValue > 0 ? 'mdi:trending-up' : 'mdi:trending-down'"
                          class="h-3 w-3"
                        />
                        <span>
                          {{
                            card.label === '今日新用户'
                              ? formatSignedPlainNumber(card.diffValue)
                              : formatDiffCurrency(card.diffValue)
                          }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    class="overview-card-icon"
                    :class="[card.iconClass, { 'overview-card-icon--loading': overviewLoading }]"
                  >
                    <div
                      v-if="overviewLoading"
                      class="overview-skeleton overview-skeleton--icon"
                    ></div>
                    <Icon v-else :icon="card.icon" class="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </n-card>

        <div class="space-y-6">
          <n-card :bordered="false" class="shadow-sm">
            <template #header>
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex items-center gap-3">
                  <Icon icon="mdi:receipt-text-outline" class="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 class="text-lg font-semibold text-slate-900">订单统计</h3>
                    <p class="text-sm text-slate-500">查看当前渠道的订单明细和支付情况</p>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <DateRangePicker
                    v-model="orderDateRange"
                    select-class-name="w-40"
                    @update:model-value="handleOrderDateChange"
                  />
                  <n-select
                    v-model:value="payStatus"
                    class="w-28"
                    :options="payStatusOptions"
                    @update:value="handlePayStatusChange"
                  />
                  <n-button type="primary" ghost :loading="ordersLoading" @click="fetchOrdersData">
                    查询
                  </n-button>
                </div>
              </div>
            </template>
            <n-alert v-if="ordersError" type="error" :show-icon="true" class="mb-4">
              {{ ordersError }}
            </n-alert>
            <n-alert
              v-if="ordersData?.order_fetch_limit_hit"
              type="warning"
              :show-icon="true"
              class="mb-4"
            >
              常读平台限制，最多只能拉到最近 1w 条订单数据，当前统计结果可能不准确
            </n-alert>
            <div v-if="isIndependentOrderStatsMode" class="mb-4">
              <div class="independent-order-summary">
                <div class="independent-order-summary__card">
                  <p
                    class="independent-order-summary__label"
                    :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--meta': ordersLoading }"
                  >
                    {{ ordersLoading ? '' : '当前时间范围总充值' }}
                  </p>
                  <p
                    class="independent-order-summary__value"
                    :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--amount': ordersLoading }"
                  >
                    {{ ordersLoading ? '' : formatCurrency(independentOrderStatsSummary.totalAmount) }}
                  </p>
                  <p
                    class="independent-order-summary__meta"
                    :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--meta': ordersLoading }"
                  >
                    {{
                      ordersLoading
                        ? ''
                        : `${formatNumberValue(independentOrderStatsSummary.paidOrderCount)} 单支付成功`
                    }}
                  </p>
                </div>
                <div class="independent-order-summary__card">
                  <p
                    class="independent-order-summary__label"
                    :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--meta': ordersLoading }"
                  >
                    {{ ordersLoading ? '' : '当前时间范围总订单' }}
                  </p>
                  <p
                    class="independent-order-summary__value"
                    :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--amount': ordersLoading }"
                  >
                    {{ ordersLoading ? '' : formatNumberValue(independentOrderStatsSummary.totalOrders) }}
                  </p>
                  <p
                    class="independent-order-summary__meta"
                    :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--meta': ordersLoading }"
                  >
                    {{
                      ordersLoading
                        ? ''
                        : independentOrderStatsSummary.accountSummaryText
                    }}
                  </p>
                </div>
              </div>
              <!-- <p v-if="!ordersLoading" class="independent-order-summary__hint"> -->
              <!--   仅展示推广链来源包含当前渠道抖音号名称的订单，无法查看其他人的订单数据。 -->
              <!-- </p> -->
            </div>
            <div v-if="orderUserCardItems.length > 0" class="mb-4">
              <div class="order-user-tabs">
                <button
                  v-for="tab in orderUserCardItems"
                  :key="tab.key"
                  type="button"
                  class="order-user-tab"
                  :class="{
                    active: !ordersLoading && activePromotionUserName === tab.key,
                    'order-user-tab--loading': ordersLoading,
                  }"
                  :disabled="ordersLoading"
                  @click="handlePromotionUserTabChange(tab.key)"
                >
                  <div class="order-user-tab__head">
                    <span
                      class="order-user-tab__label"
                      :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--label': ordersLoading }"
                    >
                      {{ ordersLoading ? '' : tab.label }}
                    </span>
                    <span
                      class="order-user-tab__count"
                      :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--count': ordersLoading }"
                    >
                      {{ ordersLoading ? '' : `${tab.total} 单` }}
                    </span>
                  </div>
                  <p
                    class="order-user-tab__amount"
                    :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--amount': ordersLoading }"
                  >
                    {{ ordersLoading ? '' : formatCurrency(tab.totalAmount) }}
                  </p>
                  <p
                    class="order-user-tab__meta"
                    :class="{ 'order-user-tab__skeleton order-user-tab__skeleton--meta': ordersLoading }"
                  >
                    {{ ordersLoading ? '' : tab.meta }}
                  </p>
                </button>
              </div>
            </div>
            <n-data-table
              :columns="orderColumns"
              :data="orderRows"
              :loading="ordersLoading"
              :bordered="false"
              :single-line="false"
              striped
              size="small"
              :pagination="ordersPagination"
              :scroll-x="1100"
            />
          </n-card>

          <n-card v-if="canAccessReport" :bordered="false" class="shadow-sm">
            <template #header>
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex items-center gap-3">
                  <Icon icon="mdi:table-eye" class="w-5 h-5 text-violet-600" />
                  <div>
                    <h3 class="text-lg font-semibold text-slate-900">数据报表</h3>
                    <p class="text-sm text-slate-500">查看当前渠道的充值日报</p>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <DateRangePicker
                    v-model="reportDateRange"
                    select-class-name="w-40"
                    @update:model-value="handleReportDateChange"
                  />
                  <n-button type="primary" ghost :loading="reportLoading" @click="fetchReportData">
                    查询
                  </n-button>
                </div>
              </div>
            </template>
            <n-alert v-if="reportError" type="error" :show-icon="true" class="mb-4">
              {{ reportError }}
            </n-alert>
            <n-data-table
              :columns="reportColumns"
              :data="reportRows"
              :loading="reportLoading"
              :bordered="false"
              :single-line="false"
              striped
              size="small"
              :pagination="reportPagination"
              :scroll-x="1100"
            />
          </n-card>
        </div>
      </div>
    </main>

    <BuildWorkflowSchedulerModal
      :show="showAutoBuildModal"
      @update:show="showAutoBuildModal = $event"
    />
    <SyncAccountModal v-model:visible="showSyncAccountModal" />
    <n-modal
      :show="showChangePasswordModal"
      preset="card"
      title="修改密码"
      class="change-password-modal"
      :style="{ width: isMobile ? 'calc(100vw - 2rem)' : '460px' }"
      :mask-closable="false"
      @update:show="handleChangePasswordModalVisible"
    >
      <n-form
        ref="changePasswordFormRef"
        :model="changePasswordForm"
        :rules="changePasswordRules"
        label-placement="top"
      >
        <n-form-item label="当前密码" path="currentPassword">
          <n-input
            v-model:value="changePasswordForm.currentPassword"
            type="password"
            show-password-on="click"
            placeholder="请输入当前密码"
          />
        </n-form-item>
        <n-form-item label="新密码" path="newPassword">
          <n-input
            v-model:value="changePasswordForm.newPassword"
            type="password"
            show-password-on="click"
            placeholder="请输入新密码"
          />
        </n-form-item>
        <n-form-item label="确认新密码" path="confirmPassword">
          <n-input
            v-model:value="changePasswordForm.confirmPassword"
            type="password"
            show-password-on="click"
            placeholder="请再次输入新密码"
            @keyup.enter="handleChangePassword"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="closeChangePasswordModal">取消</n-button>
          <n-button type="primary" :loading="savingPassword" @click="handleChangePassword">
            保存密码
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import {
  useMessage,
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDropdown,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NTooltip,
  type DropdownOption,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import BuildWorkflowSchedulerModal from '@/components/BuildWorkflowSchedulerModal.vue'
import SyncAccountModal from '@/components/SyncAccountModal.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import * as adminApi from '@/api/admin'
import { useApiConfigStore } from '@/stores/apiConfig'
import { useDouyinMaterialStore } from '@/stores/douyinMaterial'
import { useUserAuth } from '@/composables/useUserAuth'
import { useDynamicTitle } from '@/composables/useDynamicTitle'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { getDataOverviewV1, getMonthlyRechargeAnalyze, getOrders, getReport } from '@/api'
import type {
  ReportData,
  ReportRow,
  OrderItem,
  OrderData,
  PromotionUserSummary,
  OrderParams,
  ReportParams,
  DataOverviewV1Response,
} from '@/api/types'

defineOptions({
  name: 'StudioDashboardPage',
})

const router = useRouter()
const message = useMessage()
const apiConfigStore = useApiConfigStore()
const douyinMaterialStore = useDouyinMaterialStore()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()
const { isAdmin, userLabels } = useUserAuth()
const { dynamicTitle } = useDynamicTitle()

const showAutoBuildModal = ref(false)
const showSyncAccountModal = ref(false)
const showChangePasswordModal = ref(false)
const isMobile = ref(false)
const overviewLoading = ref(false)
const overviewError = ref('')
const reportLoading = ref(false)
const reportError = ref('')
const ordersLoading = ref(false)
const ordersError = ref('')
const overviewToday = ref<DataOverviewV1Response['data'] | null>(null)
const overviewAll = ref<DataOverviewV1Response['data'] | null>(null)
const overviewUpdatedAt = ref('')
const reportData = ref<ReportData | null>(null)
const ordersData = ref<OrderData | null>(null)
const monthRechargeAmount = ref(0)
const reportCurrentPage = ref(1)
const ordersCurrentPage = ref(1)
const payStatus = ref(-1)
const activePromotionUserName = ref('')
const savingPassword = ref(false)
const changePasswordFormRef = ref<FormInst | null>(null)

type DateRangeValue = [string, string] | null
const reportDateRange = ref<DateRangeValue>(null)
const orderDateRange = ref<DateRangeValue>(null)
const changePasswordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const hasMaterialRules = computed(() => douyinMaterialStore.matches.length > 0)
const autoBuildDisabledReason = computed(() => {
  if (!hasActiveChannel.value) {
    return '请先配置可用渠道'
  }

  if (!hasMaterialRules.value) {
    return '请先为当前渠道配置抖音号匹配素材'
  }

  return ''
})
const canAccessSyncAccount = computed(
  () =>
    hasActiveChannel.value && Boolean(sessionStore.currentRuntimeUser?.permissions?.syncAccount)
)
const canAccessOverview = computed(
  () =>
    hasActiveChannel.value &&
    Boolean(sessionStore.currentRuntimeUser?.permissions?.webMenus?.overview)
)
const canAccessReport = computed(
  () =>
    hasActiveChannel.value && Boolean(sessionStore.currentRuntimeUser?.permissions?.webMenus?.report)
)
const hasAccountTableId = computed(() => Boolean(apiConfigStore.config.accountTableId))
const dashboardSubtitle = computed(() => '数据驱动，精准运营')
const hasActiveChannel = computed(() =>
  isAdmin.value ? Boolean(sessionStore.activeChannelId) : Boolean(sessionStore.currentChannel?.id)
)
const channelTabs = computed(() => {
  if (sessionStore.availableChannels.length > 0) {
    return sessionStore.availableChannels
  }
  return sessionStore.currentChannel ? [sessionStore.currentChannel] : []
})
const hasChannelTabs = computed(() => channelTabs.value.length > 0)
const activeChannelTabId = computed(
  () => sessionStore.activeChannelId || sessionStore.currentChannel?.id || ''
)
const autoRefreshEnabled = computed(() => settingsStore.settings.autoRefresh)
const autoRefreshIntervalSeconds = computed(() => settingsStore.settings.refreshInterval)
const autoRefreshLabel = computed(() =>
  autoRefreshEnabled.value
    ? `自动刷新已开启，每 ${autoRefreshIntervalSeconds.value} 秒更新一次`
    : '自动刷新未开启，可在设置中心开启'
)
const desktopUserLabels = computed(() => userLabels.value.filter(Boolean))
const mobileUserLabels = computed(() =>
  userLabels.value.filter(label => Boolean(label) && label !== '管理员')
)
const accountDisplayName = computed(
  () =>
    sessionStore.currentRuntimeUser?.nickname ||
    sessionStore.currentUser?.nickname ||
    sessionStore.currentUser?.account ||
    '当前账号'
)
const accountMenuOptions = computed<DropdownOption[]>(() => {
  const options: DropdownOption[] = []

  if (sessionStore.isAdmin) {
    options.push({
      key: 'admin',
      label: '管理员后台',
      icon: () => h(Icon, { icon: 'mdi:shield-crown-outline', class: 'h-4 w-4' }),
    })
    options.push({
      key: 'scheduler-overview',
      label: '轮询任务总览',
      icon: () => h(Icon, { icon: 'mdi:chart-timeline-variant', class: 'h-4 w-4' }),
    })
    options.push({
      key: 'view-logs',
      label: '查看日志',
      icon: () => h(Icon, { icon: 'mdi:console', class: 'h-4 w-4' }),
    })
  }

  options.push(
    {
      key: 'change-password',
      label: '修改密码',
      icon: () => h(Icon, { icon: 'mdi:lock-reset', class: 'h-4 w-4' }),
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: () => h(Icon, { icon: 'mdi:logout-variant', class: 'h-4 w-4' }),
    }
  )

  return options
})
const changePasswordRules: FormRules = {
  currentPassword: {
    required: true,
    message: '请输入当前密码',
    trigger: ['blur', 'input'],
  },
  newPassword: [
    {
      required: true,
      message: '请输入新密码',
      trigger: ['blur', 'input'],
    },
    {
      validator: (_rule, value: string) => {
        if (!String(value || '').trim()) {
          return new Error('请输入新密码')
        }
        if (String(value || '').trim().length < 6) {
          return new Error('新密码至少需要 6 位')
        }
        if (String(value || '').trim() === String(changePasswordForm.currentPassword || '').trim()) {
          return new Error('新密码不能与当前密码相同')
        }
        return true
      },
      trigger: ['blur', 'input'],
    },
  ],
  confirmPassword: [
    {
      required: true,
      message: '请再次输入新密码',
      trigger: ['blur', 'input'],
    },
    {
      validator: (_rule, value: string) => {
        if (String(value || '').trim() !== String(changePasswordForm.newPassword || '').trim()) {
          return new Error('两次输入的新密码不一致')
        }
        return true
      },
      trigger: ['blur', 'input'],
    },
  ],
}
const configuredOrderUsernames = computed(() => {
  const usernames = sessionStore.currentRuntimeUser?.orderUserStats?.usernames
  return Array.isArray(usernames) ? usernames.filter(Boolean) : []
})
const independentOrderDouyinAccounts = computed(() => {
  const matches = sessionStore.currentRuntimeUser?.douyinMaterialMatches
  if (!Array.isArray(matches)) {
    return []
  }

  return matches
    .map(match => String(match?.douyinAccount || '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
})
const isIndependentOrderStatsMode = computed(
  () =>
    Boolean(ordersData.value?.independent_order_stats_enabled) ||
    Boolean(sessionStore.currentRuntimeUser?.independentOrderStats?.enabled)
)
const orderUserSortMode = computed(() =>
  sessionStore.currentRuntimeUser?.orderUserStats?.sortMode === 'amount_desc'
    ? 'amount_desc'
    : 'manual'
)

const reportRows = computed<ReportRow[]>(() => {
  if (!reportData.value) return []
  const candidates = [
    reportData.value.data,
    (reportData.value as ReportData & { daily_data?: ReportRow[] }).daily_data,
    reportData.value.report_data,
    reportData.value.rows,
  ]
  return candidates.find(item => Array.isArray(item)) || []
})

const orderSummaryUsernames = computed(() =>
  Array.isArray(ordersData.value?.promotion_user_summaries)
    ? (ordersData.value?.promotion_user_summaries || []).map(item => item.username)
    : []
)

const allOrderRows = computed<OrderItem[]>(() => ordersData.value?.data || [])

const orderRows = computed<OrderItem[]>(() => {
  if (isIndependentOrderStatsMode.value) {
    return allOrderRows.value
  }

  if (!activePromotionUserName.value) {
    return allOrderRows.value
  }

  return allOrderRows.value.filter(
    order =>
      matchOrderPromotionUser(order.promotion_name, orderSummaryUsernames.value) ===
      activePromotionUserName.value
  )
})

const orderUserTabs = computed(() => {
  if (isIndependentOrderStatsMode.value) {
    return []
  }

  const summaries = Array.isArray(ordersData.value?.promotion_user_summaries)
    ? ordersData.value?.promotion_user_summaries || []
    : []

  if (summaries.length === 0) {
    return []
  }

  const sortedSummaries = [...summaries]
  if (orderUserSortMode.value === 'amount_desc') {
    sortedSummaries.sort((left, right) => {
      const amountDiff = Number(right.total_amount || 0) - Number(left.total_amount || 0)
      if (amountDiff !== 0) {
        return amountDiff
      }
      return Number(right.paid_order_count || 0) - Number(left.paid_order_count || 0)
    })
  }

  return [
    {
      key: '',
      label: '全部',
      total:
        typeof ordersData.value?.all_total === 'number'
          ? ordersData.value.all_total
          : summaries.reduce((sum, item) => sum + Number(item.total || 0), 0),
      totalAmount:
        typeof ordersData.value?.all_total_amount === 'number'
          ? ordersData.value.all_total_amount
          : calculateOrderRechargeAmount(ordersData.value?.data || []),
      meta: '当前时间段全部订单汇总',
    },
    ...sortedSummaries.map((summary: PromotionUserSummary) => ({
      key: summary.username,
      label: summary.username,
      total: Number(summary.total || 0),
      totalAmount: Number(summary.total_amount || 0),
      meta: `支付成功 ${formatNumberValue(summary.paid_order_count || 0)} 单`,
    })),
  ]
})

const orderUserCardItems = computed(() => {
  if (isIndependentOrderStatsMode.value) {
    return []
  }

  if (orderUserTabs.value.length > 0) {
    return orderUserTabs.value
  }

  if (!ordersLoading.value || configuredOrderUsernames.value.length === 0) {
    return []
  }

  return [
    {
      key: '__loading_all__',
      label: '全部',
      total: 0,
      totalAmount: 0,
      meta: '当前时间段全部订单汇总',
    },
    ...configuredOrderUsernames.value.map(username => ({
      key: `__loading_${username}`,
      label: username,
      total: 0,
      totalAmount: 0,
      meta: '加载中',
    })),
  ]
})

const independentOrderStatsSummary = computed(() => {
  const paidOrderCount = allOrderRows.value.filter(order => order.pay_status === 0).length
  const accountCount = independentOrderDouyinAccounts.value.length
  const accountSummaryText =
    accountCount > 0
      ? `已按 ${accountCount} 个抖音号规则过滤`
      : '当前渠道未配置抖音号名称'

  return {
    totalOrders: Number(ordersData.value?.total || 0),
    totalAmount: Number(ordersData.value?.total_amount || 0),
    paidOrderCount,
    accountSummaryText,
  }
})

const payStatusOptions = [
  { label: '全部支付', value: -1 },
  { label: '支付成功', value: 0 },
  { label: '未支付', value: 1 },
]

const reportPagination = reactive({
  page: 1,
  pageSize: 8,
  showSizePicker: false,
  onChange: (page: number) => {
    reportCurrentPage.value = page
  },
})

const ordersPagination = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: false,
  onChange: (page: number) => {
    ordersCurrentPage.value = page
  },
})

const overviewCards = computed(() => [
  {
    label: '今日充值',
    value: formatOverviewAmount(overviewToday.value?.income_amount || 0),
    meta: '实时更新',
    diffValue: overviewToday.value?.income_amount_diff || 0,
    icon: 'mdi:cash-fast',
    dotClass: 'bg-emerald-500',
    cardClass: 'bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200',
    iconClass: 'bg-emerald-500',
    labelClass: 'text-emerald-700',
    metaClass: 'text-emerald-500',
  },
  {
    label: '今日新用户',
    value: formatPlainNumber(overviewToday.value?.user_num || 0),
    meta: '实时更新',
    diffValue: overviewToday.value?.user_num_diff || 0,
    icon: 'mdi:account-plus-outline',
    dotClass: 'bg-orange-500',
    cardClass: 'bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200',
    iconClass: 'bg-orange-500',
    labelClass: 'text-orange-700',
    metaClass: 'text-orange-500',
  },
  {
    label: '本月充值',
    value: formatOverviewAmount(monthRechargeAmount.value),
    meta: '当月累计充值金额',
    diffValue: null,
    icon: 'mdi:calendar-month-outline',
    dotClass: 'bg-blue-500',
    cardClass: 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200',
    iconClass: 'bg-blue-500',
    labelClass: 'text-blue-700',
    metaClass: 'text-blue-500',
  },
  {
    label: '累计充值',
    value: formatOverviewAmount(overviewAll.value?.income_amount || 0),
    meta: '历史累计充值金额',
    diffValue: null,
    icon: 'mdi:rocket-launch-outline',
    dotClass: 'bg-purple-500',
    cardClass: 'bg-gradient-to-br from-purple-50 to-violet-100 border-purple-200',
    iconClass: 'bg-purple-500',
    labelClass: 'text-purple-700',
    metaClass: 'text-purple-500',
  },
])

const reportColumns: DataTableColumns<ReportRow> = [
  {
    title: '日期',
    key: 'date',
    width: 110,
    render: row => formatReportDate(row.date),
  },
  {
    title: '全用户充值金额',
    key: 'total_amount',
    width: 140,
    render: row =>
      h('span', { class: 'font-semibold text-blue-600' }, formatCurrency(row.total_amount)),
  },
  {
    title: '全用户充值人数',
    key: 'paid_user',
    width: 120,
    render: row => formatNumberValue(row.paid_user),
  },
  {
    title: '全用户充值订单',
    key: 'paid_order',
    width: 130,
    render: row => formatNumberValue(row.paid_order),
  },
  {
    title: '全用户完成率',
    key: 'paid_order_rate',
    width: 120,
    render: row => formatReportPercent(row.paid_order_rate),
  },
  {
    title: '新用户数',
    key: 'new_user_cnt',
    width: 100,
    render: row => formatNumberValue(row.new_user_cnt),
  },
  {
    title: '新用户充值金额',
    key: 'new_user_amount',
    width: 150,
    render: row =>
      h('span', { class: 'font-semibold text-emerald-600' }, formatCurrency(row.new_user_amount)),
  },
  {
    title: '新用户充值率',
    key: 'paid_new_user_rate',
    width: 120,
    render: row => formatReportPercent(row.paid_new_user_rate),
  },
]

const orderColumns: DataTableColumns<OrderItem> = [
  {
    title: '订单创建时间',
    key: 'order_create_time',
    width: 170,
  },
  {
    title: '订单支付时间',
    key: 'order_paid_time',
    width: 170,
    render: row => row.order_paid_time || '-',
  },
  {
    title: '推广链来源',
    key: 'promotion_name',
    minWidth: 320,
    ellipsis: { tooltip: true },
  },
  {
    title: '支付金额',
    key: 'pay_amount',
    width: 110,
    render: row =>
      h('span', { class: 'font-semibold text-slate-900' }, formatCurrency(row.pay_amount || 0)),
  },
  {
    title: '支付状态',
    key: 'pay_status',
    width: 100,
    render: row =>
      h(
        'span',
        {
          class:
            row.pay_status === 0
              ? 'inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700'
              : 'inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600',
        },
        row.pay_status === 0 ? '支付成功' : '未支付'
      ),
  },
  {
    title: '用户 ID',
    key: 'device_id',
    width: 96,
    render: row => String(row.device_id || '').slice(0, 4) || '-',
  },
]

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

function getDefaultDateRange(): DateRangeValue {
  const preset = settingsStore.settings.defaultDateRange
  const now = new Date()
  const end = formatDate(now)
  const startDate = new Date(now)

  switch (preset) {
    case 'today':
      return [end, end]
    case '3days':
      startDate.setDate(startDate.getDate() - 2)
      return [formatDate(startDate), end]
    case '7days':
      startDate.setDate(startDate.getDate() - 6)
      return [formatDate(startDate), end]
    case '30days':
      startDate.setDate(startDate.getDate() - 29)
      return [formatDate(startDate), end]
    case 'all':
      return ['2025-09-01', end]
    default:
      return [end, end]
  }
}

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function toCompactDate(date: string) {
  return date.replace(/-/g, '')
}

function dateStringToTimestamp(date: string, endOfDay = false) {
  return Math.floor(new Date(`${date} ${endOfDay ? '23:59:59' : '00:00:00'}`).getTime() / 1000)
}

function formatCurrency(amountInCent: number) {
  return `¥${(amountInCent / 100).toFixed(1)}`
}

function formatOverviewAmount(amountInCent: number) {
  return (amountInCent / 100).toFixed(1)
}

function formatDiffCurrency(amountInCent: number) {
  const prefix = amountInCent > 0 ? '+' : ''
  return `${prefix}${formatCurrency(amountInCent)}`
}

function formatNumberValue(value: number) {
  return Number(value || 0).toLocaleString()
}

function formatPlainNumber(value: number) {
  return String(Number(value || 0))
}

function formatSignedPlainNumber(value: number) {
  return `${value > 0 ? '+' : ''}${formatPlainNumber(value)}`
}

function formatReportPercent(value: number) {
  return `${(Number(value || 0) / 100).toFixed(2)}%`
}

function calculateOrderRechargeAmount(orders: OrderItem[]) {
  return orders.reduce((sum, order) => {
    if (order.pay_status === 0 && order.pay_amount) {
      return sum + order.pay_amount
    }
    return sum
  }, 0)
}

function matchOrderPromotionUser(promotionName: string, usernames: string[]) {
  const normalizedPromotionName = String(promotionName || '').trim()
  if (!normalizedPromotionName || !Array.isArray(usernames) || usernames.length === 0) {
    return ''
  }

  const matchedUsernames = usernames.filter(username => normalizedPromotionName.includes(username))
  if (matchedUsernames.length === 0) {
    return ''
  }

  return [...matchedUsernames].sort((left, right) => right.length - left.length)[0]
}

function getCurrentMonthDateRange() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    begin: formatDate(firstDay),
    end: formatDate(now),
  }
}

function formatReportDate(value: string | number) {
  if (typeof value === 'number') {
    const timestamp = value > 1e11 ? value : value * 1000
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return String(value)
    return formatDate(date)
  }

  const normalizedValue = String(value || '').trim()
  if (/^\d{8}$/.test(normalizedValue)) {
    return `${normalizedValue.slice(0, 4)}-${normalizedValue.slice(4, 6)}-${normalizedValue.slice(6, 8)}`
  }

  if (/^\d{10,13}$/.test(normalizedValue)) {
    const numericValue = Number(normalizedValue)
    const timestamp = normalizedValue.length === 13 ? numericValue : numericValue * 1000
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return normalizedValue
    return formatDate(date)
  }

  return normalizedValue
}

async function triggerDashboardRefresh() {
  if (!hasActiveChannel.value) return
  await loadDashboardData()
}

const autoRefresh = useAutoRefresh(() => {
  triggerDashboardRefresh().catch(error => {
    console.error('自动刷新首页数据失败:', error)
  })
})

async function fetchOverviewData() {
  if (!hasActiveChannel.value || !canAccessOverview.value) {
    overviewToday.value = null
    overviewAll.value = null
    monthRechargeAmount.value = 0
    overviewUpdatedAt.value = ''
    overviewError.value = ''
    return
  }

  overviewLoading.value = true
  overviewError.value = ''
  try {
    const { begin, end } = getCurrentMonthDateRange()
    const [todayRes, allRes, monthlyRes] = await Promise.all([
      getDataOverviewV1({ is_today: true, app_type: 7 }),
      getDataOverviewV1({ is_today: false, app_type: 7 }),
      getMonthlyRechargeAnalyze({
        begin,
        end,
        analyze_type: 1,
        app_type: 7,
      }),
    ])
    overviewToday.value = todayRes.data
    overviewAll.value = allRes.data
    monthRechargeAmount.value = monthlyRes?.total || 0
    overviewUpdatedAt.value = new Date().toLocaleString('zh-CN')
  } catch (error) {
    console.error('获取数据概览失败:', error)
    overviewError.value = error instanceof Error ? error.message : '获取数据概览失败'
  } finally {
    overviewLoading.value = false
  }
}

async function fetchReportData() {
  if (!hasActiveChannel.value || !canAccessReport.value || !reportDateRange.value) {
    reportData.value = null
    reportError.value = ''
    reportCurrentPage.value = 1
    reportPagination.page = 1
    return
  }

  reportLoading.value = true
  reportError.value = ''
  try {
    const [begin, end] = reportDateRange.value
    const params: ReportParams = {
      begin: toCompactDate(begin),
      end: toCompactDate(end),
      page_index: 0,
      page_size: 10,
    }
    reportData.value = await getReport(params)
    reportCurrentPage.value = 1
    reportPagination.page = 1
  } catch (error) {
    console.error('获取数据报表失败:', error)
    reportError.value = error instanceof Error ? error.message : '获取数据报表失败'
  } finally {
    reportLoading.value = false
  }
}

async function fetchOrdersData() {
  if (!hasActiveChannel.value || !orderDateRange.value) return

  ordersLoading.value = true
  ordersError.value = ''
  try {
    const [begin, end] = orderDateRange.value
    const previousActivePromotionUserName = activePromotionUserName.value
    const params: OrderParams = {
      begin_time: dateStringToTimestamp(begin, false),
      end_time: dateStringToTimestamp(end, true),
      page_index: 0,
      page_size: 100,
      ...(payStatus.value >= 0 ? { pay_status: payStatus.value } : {}),
    }
    const response = await getOrders(params)
    ordersData.value = response
    if (response.independent_order_stats_enabled) {
      activePromotionUserName.value = ''
      ordersCurrentPage.value = 1
      ordersPagination.page = 1
      return
    }
    const nextSummaryUsernames = Array.isArray(response.promotion_user_summaries)
      ? response.promotion_user_summaries.map(item => item.username)
      : []
    activePromotionUserName.value = nextSummaryUsernames.includes(previousActivePromotionUserName)
      ? previousActivePromotionUserName
      : ''
    ordersCurrentPage.value = 1
    ordersPagination.page = 1
  } catch (error) {
    console.error('获取订单统计失败:', error)
    ordersError.value = error instanceof Error ? error.message : '获取订单统计失败'
  } finally {
    ordersLoading.value = false
  }
}

async function loadDashboardData() {
  if (!hasActiveChannel.value) return
  await Promise.all([fetchOverviewData(), fetchReportData(), fetchOrdersData()])
}

function handleAutoBuildClick() {
  if (!hasActiveChannel.value) {
    message.warning('请先配置可用渠道')
    return
  }

  if (!hasMaterialRules.value) {
    message.warning('请先在管理员后台为当前渠道绑定用户并配置抖音号匹配素材')
    return
  }

  showAutoBuildModal.value = true
}

function resetChangePasswordForm() {
  changePasswordForm.currentPassword = ''
  changePasswordForm.newPassword = ''
  changePasswordForm.confirmPassword = ''
  changePasswordFormRef.value?.restoreValidation()
}

function openChangePasswordModal() {
  showChangePasswordModal.value = true
}

function closeChangePasswordModal() {
  showChangePasswordModal.value = false
  resetChangePasswordForm()
}

function handleChangePasswordModalVisible(value: boolean) {
  showChangePasswordModal.value = value
  if (!value) {
    resetChangePasswordForm()
  }
}

async function handleLogout() {
  await sessionStore.logout()
  await router.replace('/login')
}

async function handleAccountMenuSelect(key: string) {
  if (key === 'admin') {
    await router.push('/admin')
    return
  }

  if (key === 'change-password') {
    openChangePasswordModal()
    return
  }

  if (key === 'scheduler-overview') {
    await router.push('/admin/schedulers')
    return
  }

  if (key === 'view-logs') {
    await router.push('/admin/logs')
    return
  }

  if (key === 'logout') {
    await handleLogout()
  }
}

async function handleChangePassword() {
  try {
    await changePasswordFormRef.value?.validate()
    savingPassword.value = true
    await adminApi.changePassword(
      changePasswordForm.currentPassword.trim(),
      changePasswordForm.newPassword.trim()
    )
    message.success('密码修改成功')
    closeChangePasswordModal()
  } catch (error) {
    if (error instanceof Error) {
      message.error(error.message)
    }
  } finally {
    savingPassword.value = false
  }
}

async function handleChannelChange(value: string) {
  if (!value || value === sessionStore.selectedChannelId) {
    return
  }

  sessionStore.updateSelectedChannel(value)
  await apiConfigStore.loadFromStorage()
  await refreshDashboardContext()
  await douyinMaterialStore.loadFromServer(true)
  await loadDashboardData()
}

async function refreshDashboardContext() {
  await sessionStore.loadSession()
  await apiConfigStore.loadFromStorage()
}

function handleReportDateChange() {
  reportCurrentPage.value = 1
  reportPagination.page = 1
  fetchReportData()
}

function handleOrderDateChange() {
  ordersCurrentPage.value = 1
  ordersPagination.page = 1
  fetchOrdersData()
}

function handlePayStatusChange() {
  ordersCurrentPage.value = 1
  ordersPagination.page = 1
  fetchOrdersData()
}

function handlePromotionUserTabChange(username: string) {
  if (activePromotionUserName.value === username) {
    return
  }

  activePromotionUserName.value = username
  ordersCurrentPage.value = 1
  ordersPagination.page = 1
}

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  reportDateRange.value = getDefaultDateRange()
  orderDateRange.value = getDefaultDateRange()
  await refreshDashboardContext()
  if (hasActiveChannel.value) {
    douyinMaterialStore.loadFromServer(true).catch(error => {
      console.error('加载抖音号匹配素材失败:', error)
    })
    await loadDashboardData()
    autoRefresh.startAutoRefresh()
  }
})

watch(
  hasActiveChannel,
  active => {
    if (active) {
      douyinMaterialStore.loadFromServer(true).catch(error => {
        console.error('加载抖音号匹配素材失败:', error)
      })
      loadDashboardData().catch(error => {
        console.error('加载首页数据失败:', error)
      })
      autoRefresh.startAutoRefresh()
    } else {
      autoRefresh.stopAutoRefresh()
    }
  },
  { immediate: false }
)

watch(reportCurrentPage, page => {
  reportPagination.page = page
})

watch(ordersCurrentPage, page => {
  ordersPagination.page = page
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  autoRefresh.stopAutoRefresh()
})
</script>

<style scoped>
.channel-tabs-shell {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: 0.35rem;
  padding: 0.28rem;
  border-radius: 9999px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.84);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 10px 24px -20px rgba(15, 23, 42, 0.22);
  overflow-x: auto;
}

.account-entry-button {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.75rem;
  padding: 0.35rem 0.7rem 0.35rem 0.4rem;
  border-radius: 9999px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.92));
  color: rgb(51 65 85);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 12px 24px -22px rgba(15, 23, 42, 0.28);
  transition: all 0.2s ease;
}

.account-entry-button:hover {
  border-color: rgba(148, 163, 184, 0.78);
  color: rgb(15 23 42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.98),
    0 16px 30px -24px rgba(15, 23, 42, 0.32);
}

.account-entry-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.16), rgba(14, 165, 233, 0.2));
  color: rgb(37 99 235);
  flex-shrink: 0;
}

.account-entry-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.12rem;
  min-width: 0;
}

.account-entry-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.account-entry-name {
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1;
}

.account-entry-hint {
  font-size: 0.72rem;
  color: rgb(148 163 184);
  line-height: 1;
}

:deep(.change-password-modal) {
  max-width: calc(100vw - 2rem);
}

:deep(.change-password-modal .n-card) {
  border-radius: 1.1rem;
  box-shadow: 0 28px 60px -36px rgba(15, 23, 42, 0.35);
}

.channel-tabs-shell.compact {
  gap: 0.3rem;
  padding: 0.24rem 0.28rem 0.24rem 0.24rem;
  margin-left: 0.75rem;
  background: rgba(248, 250, 252, 0.94);
}

.channel-tabs-prefix {
  flex-shrink: 0;
  padding: 0 0.55rem 0 0.5rem;
  color: rgb(148 163 184);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.channel-tab-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: fit-content;
  min-height: 2.15rem;
  padding: 0.5rem 0.78rem;
  border-radius: 9999px;
  color: rgb(100 116 139);
  font-size: 0.87rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.channel-tab-button:hover {
  color: rgb(15 23 42);
  background: rgba(241, 245, 249, 0.92);
}

.channel-tab-button.active {
  color: rgb(30 64 175);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(219, 234, 254, 0.98));
  border: 1px solid rgba(147, 197, 253, 0.95);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 8px 18px -16px rgba(37, 99, 235, 0.45);
}

.channel-tabs-shell.compact .channel-tab-button {
  min-height: 2rem;
  padding: 0.44rem 0.72rem;
}

.channel-tab-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0.28;
}

.channel-tab-button.active .channel-tab-dot {
  opacity: 0.8;
}

:deep(.n-dropdown-menu) {
  padding: 0.4rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.96);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 42px -28px rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(16px);
}

:deep(.n-dropdown-option) {
  border-radius: 0.8rem;
}

:deep(.n-dropdown-option-body) {
  min-width: 9rem;
  padding: 0.68rem 0.78rem;
  font-weight: 600;
}

:deep(.n-dropdown-option-body__prefix) {
  margin-right: 0.55rem;
  color: rgb(100 116 139);
}

:deep(.n-dropdown-option-body:hover) {
  background: rgba(241, 245, 249, 0.92);
}

.overview-card {
  cursor: pointer;
  transition: transform 0.3s ease;
}

.overview-card:hover {
  transform: scale(1.02);
}

.overview-card-inner {
  border-width: 1px;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 8px 24px -18px rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
}

.overview-card:hover .overview-card-inner {
  box-shadow: 0 18px 38px -24px rgba(15, 23, 42, 0.35);
}

.overview-card-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 28px -18px rgba(15, 23, 42, 0.35);
  transition: transform 0.3s ease;
}

.overview-card:hover .overview-card-icon {
  transform: scale(1.08);
}

.overview-card-icon--loading {
  background: rgba(255, 255, 255, 0.55) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.32);
}

.overview-skeleton {
  position: relative;
  color: transparent !important;
  overflow: hidden;
}

.overview-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    rgba(226, 232, 240, 0.55) 0%,
    rgba(255, 255, 255, 0.9) 48%,
    rgba(226, 232, 240, 0.55) 100%
  );
  background-size: 220% 100%;
  animation: order-tab-skeleton 1.45s ease-in-out infinite;
}

.overview-skeleton--dot {
  min-width: 0.75rem;
  min-height: 0.75rem;
  border-radius: 9999px;
}

.overview-skeleton--label {
  width: 4.5rem;
  min-height: 1rem;
  border-radius: 0.5rem;
}

.overview-skeleton--value {
  width: 6.4rem;
  min-height: 2rem;
  border-radius: 0.75rem;
}

.overview-skeleton--meta {
  width: 5rem;
  min-height: 0.9rem;
  border-radius: 0.5rem;
}

.overview-skeleton--icon {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 0.45rem;
}

.user-label-badge {
  max-width: 11rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(to right, rgb(59 130 246), rgb(147 51 234));
  border-radius: 9999px;
  border: none;
  line-height: 1;
}

.user-label-badge--mobile {
  max-width: 8.5rem;
}

.user-label-badge__text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-label-badge--clickable {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.user-label-badge--clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px -16px rgba(37, 99, 235, 0.8);
}

.refresh-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 9999px;
  padding: 0.22rem 0.7rem;
  background: rgba(226, 232, 240, 0.7);
  color: rgb(100 116 139);
  font-size: 0.75rem;
  line-height: 1rem;
}

.refresh-status-pill.active {
  background: rgba(220, 252, 231, 0.8);
  color: rgb(22 101 52);
}

.refresh-status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0.45;
}

.refresh-status-pill.active .refresh-status-dot {
  opacity: 1;
  animation: refresh-breath 1.6s ease-in-out infinite;
}

.refresh-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: rgba(236, 253, 245, 0.95);
  box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.12);
  transition: all 0.2s ease;
}

.refresh-icon-button:hover {
  background: rgba(220, 252, 231, 1);
  transform: scale(1.04);
}

.refresh-icon-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.independent-order-summary {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.9rem;
}

.independent-order-summary__card {
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: 1rem;
  padding: 0.95rem 1rem;
  background:
    radial-gradient(circle at top right, rgba(253, 224, 71, 0.2), transparent 46%),
    linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(255, 247, 237, 0.98));
  box-shadow: 0 14px 34px -24px rgba(194, 65, 12, 0.26);
}

.independent-order-summary__label {
  font-size: 0.82rem;
  color: rgb(120 113 108);
}

.independent-order-summary__value {
  margin-top: 0.45rem;
  font-size: 1.8rem;
  line-height: 1;
  font-weight: 700;
  color: rgb(146 64 14);
}

.independent-order-summary__meta {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: rgb(120 113 108);
}

.independent-order-summary__hint {
  margin-top: 0.7rem;
  font-size: 0.8rem;
  color: rgb(120 113 108);
}

.order-user-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.order-user-tab {
  min-width: 180px;
  flex: 1 1 180px;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(253, 224, 71, 0.28), transparent 46%),
    linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(255, 247, 237, 0.98));
  box-shadow: 0 14px 34px -24px rgba(194, 65, 12, 0.35);
  text-align: left;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.order-user-tab:hover {
  transform: translateY(-2px);
  border-color: rgba(249, 115, 22, 0.28);
  box-shadow: 0 18px 36px -24px rgba(194, 65, 12, 0.42);
}

.order-user-tab.active {
  border-color: rgba(14, 116, 144, 0.28);
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.24), transparent 42%),
    linear-gradient(135deg, rgba(14, 165, 233, 0.98), rgba(3, 105, 161, 0.95));
  box-shadow: 0 24px 48px -30px rgba(3, 105, 161, 0.68);
}

.order-user-tab--loading {
  cursor: progress;
}

.order-user-tab--loading:hover {
  transform: none;
}

.order-user-tab__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.order-user-tab__label {
  font-size: 0.95rem;
  font-weight: 700;
  color: rgb(154 52 18);
}

.order-user-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.55rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.72);
  color: rgb(194 65 12);
  font-size: 0.75rem;
  font-weight: 600;
}

.order-user-tab__amount {
  margin-top: 0.6rem;
  font-size: 1.2rem;
  font-weight: 800;
  color: rgb(15 23 42);
}

.order-user-tab__meta {
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: rgb(148 63 18);
}

.order-user-tab.active .order-user-tab__label,
.order-user-tab.active .order-user-tab__amount,
.order-user-tab.active .order-user-tab__meta {
  color: white;
}

.order-user-tab.active .order-user-tab__count {
  background: rgba(255, 255, 255, 0.18);
  color: white;
}

.order-user-tab__skeleton {
  position: relative;
  color: transparent !important;
  overflow: hidden;
}

.order-user-tab__skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    rgba(226, 232, 240, 0.55) 0%,
    rgba(255, 255, 255, 0.9) 48%,
    rgba(226, 232, 240, 0.55) 100%
  );
  background-size: 220% 100%;
  animation: order-tab-skeleton 1.45s ease-in-out infinite;
}

.order-user-tab__skeleton--label {
  width: 3.8rem;
  min-height: 1.1rem;
  border-radius: 0.5rem;
}

.order-user-tab__skeleton--count {
  width: 3.4rem;
  min-height: 1.35rem;
  border-radius: 9999px;
}

.order-user-tab__skeleton--amount {
  width: 5.2rem;
  min-height: 1.5rem;
  border-radius: 0.65rem;
}

.order-user-tab__skeleton--meta {
  width: 7.2rem;
  min-height: 1rem;
  border-radius: 0.5rem;
}

@keyframes refresh-breath {
  0%,
  100% {
    transform: scale(0.85);
    opacity: 0.45;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

@keyframes order-tab-skeleton {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: -100% 50%;
  }
}

@media (min-width: 768px) {
  .independent-order-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
