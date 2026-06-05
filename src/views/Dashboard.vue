<template>
  <div class="min-h-full bg-gradient-to-br from-slate-50 to-blue-50">
    <header
      class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 relative">
          <div class="flex items-center space-x-4 min-w-0 flex-1">
            <div
              class="brand-revenue-menu"
              :class="{
                'brand-revenue-menu--disabled': !showBrandRevenue || !isAdmin,
                'brand-revenue-menu--open': brandRevenuePopoverOpen,
              }"
              @pointerdown.stop
            >
              <div
                role="button"
                tabindex="0"
                class="brand-revenue-trigger"
                @click="toggleBrandRevenuePopover"
                @keydown.enter.prevent="toggleBrandRevenuePopover"
                @keydown.space.prevent="toggleBrandRevenuePopover"
              >
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
              </div>
              <div
                v-if="showBrandRevenue && isAdmin"
                class="brand-revenue-popover"
                @pointerdown.stop
              >
                <div class="brand-revenue-popover__header">
                  <h3 class="brand-revenue-popover__hero">永动印钞机</h3>
                  <button
                    type="button"
                    class="brand-revenue-popover__refresh"
                    :class="{ 'brand-revenue-popover__refresh--loading': thirdPartyRevenueLoading }"
                    :disabled="thirdPartyRevenueLoading"
                    title="刷新数据"
                    @click.stop="refreshThirdPartyRevenue"
                  >
                    <Icon icon="mdi:refresh" class="brand-revenue-popover__refresh-icon" />
                  </button>
                </div>
                <div class="brand-revenue-toolbar" @click.stop>
                  <div class="brand-revenue-field brand-revenue-field--token">
                    <span class="brand-revenue-field__label">Token</span>
                    <n-input
                      v-model:value="jcybAdReportTokenInput"
                      type="password"
                      show-password-on="click"
                      size="small"
                      clearable
                      placeholder="请输入 token"
                      @blur="saveJcybAdReportToken"
                      @keyup.enter="saveJcybAdReportToken"
                    />
                  </div>
                  <div class="brand-revenue-field">
                    <span class="brand-revenue-field__label">小程序</span>
                    <n-select
                      v-model:value="selectedJcybAppIds"
                      class="brand-revenue-app-select"
                      multiple
                      filterable
                      clearable
                      size="small"
                      :max-tag-count="1"
                      :options="jcybAppSelectOptions"
                      :loading="jcybAppsLoading"
                      :to="false"
                      placeholder="请选择小程序"
                      @update:value="handleJcybAppChange"
                    >
                      <template #header>
                        <div class="brand-revenue-app-select-header" @mousedown.prevent>
                          <div class="brand-revenue-app-select-tools">
                            <button
                              type="button"
                              class="brand-revenue-app-select-command"
                              :disabled="
                                jcybAppOptions.length === 0 ||
                                selectedJcybAppIds.length === jcybAppOptions.length
                              "
                              @click.stop="selectAllJcybApps"
                            >
                              全选
                            </button>
                            <button
                              type="button"
                              class="brand-revenue-app-select-command"
                              :disabled="selectedJcybAppIds.length === 0"
                              @click.stop="clearSelectedJcybApps"
                            >
                              清空
                            </button>
                          </div>
                        </div>
                      </template>
                    </n-select>
                  </div>
                </div>
                <div v-if="thirdPartyRevenueLoading" class="brand-revenue-table-shell">
                  <table class="brand-revenue-table brand-revenue-skeleton-table">
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>实际消耗</th>
                        <th>付费ROI</th>
                        <th>实际收入</th>
                        <th>分成</th>
                        <th>时速</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="rowIndex in 4" :key="`revenue-skeleton-${rowIndex}`">
                        <td><span class="brand-revenue-skeleton-line short"></span></td>
                        <td><span class="brand-revenue-skeleton-line"></span></td>
                        <td><span class="brand-revenue-skeleton-line"></span></td>
                        <td><span class="brand-revenue-skeleton-line"></span></td>
                        <td><span class="brand-revenue-skeleton-line compact"></span></td>
                        <td><span class="brand-revenue-skeleton-line compact"></span></td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td><span class="brand-revenue-skeleton-line short strong"></span></td>
                        <td><span class="brand-revenue-skeleton-line strong"></span></td>
                        <td><span class="brand-revenue-skeleton-line strong"></span></td>
                        <td><span class="brand-revenue-skeleton-line strong"></span></td>
                        <td><span class="brand-revenue-skeleton-line compact strong"></span></td>
                        <td><span class="brand-revenue-skeleton-line compact strong"></span></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div
                  v-else-if="thirdPartyRevenueError"
                  class="brand-revenue-state brand-revenue-state--error"
                >
                  {{ thirdPartyRevenueError }}
                </div>
                <div v-else class="brand-revenue-table-shell">
                  <table class="brand-revenue-table">
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>实际消耗</th>
                        <th>付费ROI</th>
                        <th>实际收入</th>
                        <th>分成</th>
                        <th>时速</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in thirdPartyRevenueRows" :key="row.date">
                        <td>{{ formatThirdPartyRevenueDate(row.date) }}</td>
                        <td>{{ formatYuanAmount(row.realCost) }}</td>
                        <td>{{ formatRatioValue(row.payRoi) }}</td>
                        <td>{{ formatNullableYuanAmount(row.actualIncome) }}</td>
                        <td>{{ formatNullableYuanAmount(row.revenueShare) }}</td>
                        <td>{{ formatSpeedValue(row.costSpeed) }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>总计</td>
                        <td>{{ formatYuanAmount(thirdPartyRevenueTotal) }}</td>
                        <td>{{ formatRatioValue(thirdPartyRevenuePayRoiAverage) }}</td>
                        <td>{{ formatNullableYuanAmount(thirdPartyActualIncomeTotal) }}</td>
                        <td>{{ formatNullableYuanAmount(thirdPartyRevenueShareTotal) }}</td>
                        <td>{{ formatSpeedValue(thirdPartyCostSpeedTotal) }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
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
            <n-tooltip
              v-if="canAccessBuildSubmit"
              :disabled="!autoBuildDisabledReason"
              placement="bottom"
              trigger="hover"
            >
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

    <main class="dashboard-main max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
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

      <div v-else-if="!hasHomeTabs" class="space-y-6">
        <div
          class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"
        >
          <div
            class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
          >
            <Icon icon="mdi:lock-outline" class="h-8 w-8" />
          </div>
          <h2 class="mt-5 text-2xl font-bold text-slate-900">当前渠道暂无可展示页面</h2>
          <p class="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            请联系管理员开通页面权限。
          </p>
        </div>
      </div>

      <div v-else class="home-shell">
        <!-- 顶部 Tab 切换器:数据看板 / 爆剧爆剪 / 飞书表格 -->
        <div v-if="shouldShowHomeTabBar" class="home-tab-bar" role="tablist">
          <button
            v-for="tab in homeTabs"
            :key="tab.key"
            ref="homeTabRefs"
            type="button"
            role="tab"
            :aria-selected="activeHomeTab === tab.key"
            class="home-tab-button"
            :class="{ active: activeHomeTab === tab.key }"
            @click="handleHomeTabChange(tab.key)"
          >
            <Icon :icon="tab.icon" class="home-tab-button__icon" />
            <span class="home-tab-button__label">{{ tab.label }}</span>
          </button>
          <span
            class="home-tab-indicator"
            :style="{
              transform: `translateX(${homeTabIndicator.left}px)`,
              width: `${homeTabIndicator.width}px`,
            }"
          ></span>
        </div>

        <!-- 数据看板 Pane -->
        <div
          v-if="canAccessDataDashboard"
          v-show="activeHomeTab === 'dashboard'"
          class="home-tab-pane space-y-6"
        >
          <n-card v-if="canAccessOverview" :bordered="false" class="shadow-sm">
            <template #header>
              <div class="flex items-center justify-between gap-4 flex-wrap">
                <div class="flex items-center gap-3">
                  <Icon icon="mdi:chart-box-outline" class="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 class="text-lg font-semibold text-slate-900">数据概览</h3>
                    <p class="mt-1 text-sm text-slate-500">实时数据，一目了然</p>
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
                    @click="triggerDashboardRefresh"
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
            <n-card v-if="canAccessOrderStats" :bordered="false" class="shadow-sm">
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
                    <n-button
                      type="primary"
                      ghost
                      :loading="ordersLoading"
                      @click="fetchOrdersData"
                    >
                      查询
                    </n-button>
                  </div>
                </div>
              </template>
              <n-alert v-if="ordersError" type="error" :show-icon="true" class="mb-4">
                {{ ordersError }}
              </n-alert>
              <div v-if="orderUserCardItems.length > 0" class="mb-4">
                <div class="order-user-tabs">
                  <div
                    v-for="tab in orderUserCardItems"
                    :key="tab.key"
                    class="order-user-tab"
                    :class="{
                      active: !ordersLoading && isOrderUserCardActive(tab),
                      'order-user-tab--all': tab.key === '' || tab.key === '__loading_all__',
                      'order-user-tab--loading': ordersLoading,
                    }"
                    @click="!ordersLoading && handleOrderUserCardChange(tab)"
                  >
                    <div class="order-user-tab__body">
                      <div class="order-user-tab__head">
                        <span
                          class="order-user-tab__label"
                          :class="{
                            'order-user-tab__skeleton order-user-tab__skeleton--label':
                              ordersLoading,
                          }"
                        >
                          {{ ordersLoading ? '' : tab.label }}
                        </span>
                        <span
                          class="order-user-tab__count"
                          :class="{
                            'order-user-tab__skeleton order-user-tab__skeleton--count':
                              ordersLoading,
                          }"
                        >
                          {{ ordersLoading ? '' : `${tab.total} 单` }}
                        </span>
                      </div>
                      <p
                        class="order-user-tab__amount"
                        :class="{
                          'order-user-tab__skeleton order-user-tab__skeleton--amount':
                            ordersLoading,
                        }"
                      >
                        {{ ordersLoading ? '' : formatCurrency(tab.totalAmount) }}
                      </p>
                      <p
                        class="order-user-tab__meta"
                        :class="{
                          'order-user-tab__skeleton order-user-tab__skeleton--meta': ordersLoading,
                        }"
                      >
                        {{ ordersLoading ? '' : tab.meta }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="shouldShowOrderBranch" class="mb-4">
                <div class="order-branch-panel">
                  <div class="order-branch-panel__tree">
                    <div class="order-branch-panel__trunk"></div>
                    <div class="order-branch-panel__grid">
                      <button
                        v-for="branchUser in orderBranchCardItems"
                        :key="branchUser.key"
                        type="button"
                        class="order-branch-card"
                        :class="{ active: activeBranchUserId === branchUser.key }"
                        @click="handleBranchUserChange(branchUser.key)"
                      >
                        <p class="order-branch-card__label">{{ branchUser.label }}</p>
                        <p class="order-branch-card__amount-label">总充值金额</p>
                        <p class="order-branch-card__amount">
                          {{ formatCurrency(branchUser.totalAmount) }}
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="shouldShowOwnOrderSummary" class="own-order-summary mb-4">
                <div class="own-order-summary__header">
                  <div>
                    <p class="own-order-summary__eyebrow">我的订单统计</p>
                    <h4 class="own-order-summary__title">当前时间范围汇总</h4>
                  </div>
                  <span class="own-order-summary__badge">{{ currentOrderChannelBadge }}</span>
                </div>
                <div class="own-order-summary__grid">
                  <div
                    v-for="card in ownOrderSummaryCards"
                    :key="card.key"
                    class="own-order-summary-card"
                  >
                    <div class="own-order-summary-card__icon" :class="card.iconClass">
                      <Icon :icon="card.icon" class="h-5 w-5" />
                    </div>
                    <div class="min-w-0">
                      <p class="own-order-summary-card__label">{{ card.label }}</p>
                      <p class="own-order-summary-card__value">{{ card.value }}</p>
                      <p class="own-order-summary-card__meta">{{ card.meta }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <n-data-table
                class="orders-table"
                :columns="orderColumns"
                :data="pagedOrderRows"
                :loading="ordersLoading"
                :bordered="false"
                :single-line="false"
                striped
                size="small"
                :scroll-x="1100"
              />
              <div class="orders-table-footer">
                <span class="orders-pagination-prefix">
                  共{{ formatNumberValue(orderRows.length) }}个订单
                </span>
                <n-pagination
                  :page="ordersCurrentPage"
                  :page-size="ordersPagination.pageSize"
                  :item-count="orderRows.length"
                  @update:page="handleOrdersPageChange"
                />
              </div>
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
                    <n-button
                      type="primary"
                      ghost
                      :loading="reportLoading"
                      @click="fetchReportData"
                    >
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
        <!-- /数据看板 Pane -->

        <!-- 爆剧爆剪 Pane(常驻 DOM,首次激活后保持状态;只在首次进入时刷新一次) -->
        <div
          v-if="canAccessDramaClip && clipPaneActivated"
          v-show="activeHomeTab === 'clip'"
          class="home-tab-pane home-tab-pane--clip"
        >
          <NewDramaPreview ref="clipPanelRef" embedded />
        </div>

        <!-- 飞书表格 Pane -->
        <div v-if="canAccessFeishuBoard" v-show="activeHomeTab === 'feishu'" class="home-tab-pane">
          <FeishuBoardPanel ref="feishuPanelRef" />
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
import { computed, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  NPagination,
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
import NewDramaPreview from '@/components/NewDramaPreview.vue'
import FeishuBoardPanel from '@/components/FeishuBoardPanel.vue'
import * as adminApi from '@/api/admin'
import { useApiConfigStore } from '@/stores/apiConfig'
import { useDouyinMaterialStore } from '@/stores/douyinMaterial'
import { useUserAuth } from '@/composables/useUserAuth'
import { useDynamicTitle } from '@/composables/useDynamicTitle'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import {
  getDataOverviewV1,
  getJcybAdInfo,
  getJcybApps,
  getMonthlyRechargeAnalyze,
  getOrders,
  getReport,
} from '@/api'
import type {
  ReportData,
  ReportRow,
  OrderItem,
  OrderData,
  PromotionUserSummary,
  OrderParams,
  ReportParams,
  DataOverviewV1Response,
  JcybAdInfoRow,
  JcybAppOption,
} from '@/api/types'

defineOptions({
  name: 'StudioDashboardPage',
})

const router = useRouter()
const route = useRoute()
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
const activeBranchUserId = ref('')
const savingPassword = ref(false)
const changePasswordFormRef = ref<FormInst | null>(null)

type DateRangeValue = [string, string] | null
type DashboardRequestScope = 'overview' | 'report' | 'orders' | 'material'
type RuntimeWebMenus = adminApi.UserChannelBindingConfig['permissions']['webMenus']
type OrderUserCardScope = 'all' | 'summary' | 'branch' | 'loading'
interface DashboardRequestContext {
  scope: DashboardRequestScope
  controller: AbortController
  generation: number
  signal: AbortSignal
}
interface OrderUserCardItem {
  key: string
  label: string
  total: number
  totalAmount: number
  meta: string
  scope: OrderUserCardScope
  aliases?: string[]
}
interface ThirdPartyRevenueRow {
  date: string
  realCost: number
  payRoi: number | null
  costSpeed: string
  actualIncome: number | null
  revenueShare: number | null
}

const DEFAULT_RUNTIME_WEB_MENUS: RuntimeWebMenus = {
  dashboard: true,
  overview: true,
  report: true,
  orderStats: true,
  dramaClip: true,
  feishuBoard: true,
  actionButtons: true,
  buildSubmit: true,
  syncAccount: false,
}

const dashboardRequestControllers = new Map<DashboardRequestScope, AbortController>()
let dashboardRequestGeneration = 0
let channelSwitchController: AbortController | null = null
let channelSwitchSerial = 0
const BRAND_REVENUE_ROUTE_FLAG = 'yy_vault'
const BRAND_REVENUE_ROUTE_FLAG_VALUE = '1'
const THIRD_PARTY_REVENUE_START_DATE = '2026-05-22'
const THIRD_PARTY_LOW_SHARE_DATES = new Set(['2026-05-22', '2026-05-23', '2026-05-24'])
const THIRD_PARTY_LOW_SHARE_RATE = 0.025
const THIRD_PARTY_DEFAULT_SHARE_RATE = 0.05
const JCYB_AD_REPORT_TOKEN_STORAGE_KEY = 'jcybAdReportToken'
const JCYB_TEAM_ID = 500015
const JCYB_AD_INFO_DIMENSION = 'app,agent,ad_account_name,ad_account_id'
const JCYB_AD_INFO_ORDER = 'real_cost desc'
const reportDateRange = ref<DateRangeValue>(null)
const orderDateRange = ref<DateRangeValue>(null)
const thirdPartyRevenueRows = ref<ThirdPartyRevenueRow[]>([])
const thirdPartyRevenueLoading = ref(false)
const thirdPartyRevenueError = ref('')
const thirdPartyRevenueLoadedKey = ref('')
const thirdPartyRevenueRequestedKey = ref('')
const brandRevenuePopoverOpen = ref(false)
const jcybAdReportTokenInput = ref('')
const jcybAppsLoading = ref(false)
const jcybAppOptions = ref<JcybAppOption[]>([])
const selectedJcybAppIds = ref<string[]>([])
const changePasswordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const hasMaterialRules = computed(() => {
  const tableGroups = (apiConfigStore.config.feishuTableGroups || []).filter(
    group => group.enabled !== false
  )
  if (tableGroups.some(group => (group.douyinMaterialMatches || []).length > 0)) {
    return true
  }

  return douyinMaterialStore.matches.length > 0
})
const autoBuildDisabledReason = computed(() => {
  if (!hasActiveChannel.value) {
    return '请先配置可用渠道'
  }

  if (!hasMaterialRules.value) {
    return '请先为当前渠道配置抖音号匹配素材'
  }

  return ''
})
const runtimeWebMenus = computed<RuntimeWebMenus>(() => {
  const permissions = sessionStore.currentRuntimeUser?.permissions
  const webMenus: Partial<RuntimeWebMenus> = permissions?.webMenus || {}

  return {
    ...DEFAULT_RUNTIME_WEB_MENUS,
    ...webMenus,
    syncAccount:
      typeof webMenus.syncAccount === 'boolean'
        ? webMenus.syncAccount
        : Boolean((permissions as { syncAccount?: boolean } | undefined)?.syncAccount),
  }
})
const canAccessSyncAccount = computed(
  () =>
    hasActiveChannel.value &&
    Boolean(runtimeWebMenus.value.actionButtons) &&
    Boolean(runtimeWebMenus.value.syncAccount)
)
const canAccessBuildSubmit = computed(
  () =>
    hasActiveChannel.value &&
    Boolean(runtimeWebMenus.value.actionButtons) &&
    Boolean(runtimeWebMenus.value.buildSubmit)
)
const canAccessDataDashboard = computed(() => {
  const webMenus = runtimeWebMenus.value
  return (
    hasActiveChannel.value &&
    Boolean(webMenus?.dashboard) &&
    (Boolean(webMenus?.overview) || Boolean(webMenus?.report) || Boolean(webMenus?.orderStats))
  )
})
const canAccessOverview = computed(
  () => canAccessDataDashboard.value && Boolean(runtimeWebMenus.value.overview)
)
const canAccessReport = computed(
  () => canAccessDataDashboard.value && Boolean(runtimeWebMenus.value.report)
)
const canAccessOrderStats = computed(
  () => canAccessDataDashboard.value && Boolean(runtimeWebMenus.value.orderStats)
)
const canAccessDramaClip = computed(
  () => hasActiveChannel.value && Boolean(runtimeWebMenus.value.dramaClip)
)
const canAccessFeishuBoard = computed(
  () => hasActiveChannel.value && Boolean(runtimeWebMenus.value.feishuBoard)
)
const hasAccountTableId = computed(() => {
  const tableGroups = (apiConfigStore.config.feishuTableGroups || []).filter(
    group => group.enabled !== false
  )
  return (
    Boolean(apiConfigStore.config.accountTableId) ||
    tableGroups.some(group => Boolean(group.feishu?.accountTableId))
  )
})
const dashboardSubtitle = computed(() => '数据驱动，精准运营')
const showBrandRevenue = computed(
  () => isAdmin.value && route.query[BRAND_REVENUE_ROUTE_FLAG] === BRAND_REVENUE_ROUTE_FLAG_VALUE
)
const jcybAppSelectOptions = computed(() => {
  return jcybAppOptions.value.map(app => ({
    label: app.app_name || `小程序 ${app.id}`,
    value: String(app.id),
  }))
})
const thirdPartyRevenueTotal = computed(() =>
  thirdPartyRevenueRows.value.reduce((sum, row) => sum + row.realCost, 0)
)
const thirdPartyRevenuePayRoiAverage = computed(() => {
  const rows = thirdPartyRevenueRows.value.filter(row => row.payRoi !== null && row.realCost > 0)
  const totalCost = rows.reduce((sum, row) => sum + row.realCost, 0)

  if (totalCost <= 0) {
    return null
  }

  const totalPayAmount = rows.reduce((sum, row) => sum + row.realCost * (row.payRoi || 0), 0)
  return totalPayAmount / totalCost
})
const thirdPartyActualIncomeTotal = computed(() =>
  sumNullableNumbers(thirdPartyRevenueRows.value.map(row => row.actualIncome))
)
const thirdPartyRevenueShareTotal = computed(() =>
  sumNullableNumbers(thirdPartyRevenueRows.value.map(row => row.revenueShare))
)
const thirdPartyCostSpeedTotal = computed(() =>
  sumNullableNumbers(thirdPartyRevenueRows.value.map(row => normalizeJcybNumber(row.costSpeed)))
)
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

// ====== 首页 Tab 切换:数据看板 / 爆剧爆剪 / 飞书表格 ======
type HomeTabKey = 'dashboard' | 'clip' | 'feishu'

const VALID_HOME_TABS: HomeTabKey[] = ['dashboard', 'clip', 'feishu']

function resolveInitialTab(): HomeTabKey {
  const raw = String(route.query.tab || '').trim()
  if (raw === 'clip' || raw === 'feishu' || raw === 'dashboard') {
    return raw
  }
  return 'dashboard'
}

const activeHomeTab = ref<HomeTabKey>(resolveInitialTab())
const clipPaneActivated = ref(activeHomeTab.value === 'clip')
const clipPanelRef = ref<{ cancelAllRequests: () => void } | null>(null)
const feishuPanelRef = ref<{
  refresh: () => void | Promise<void>
  cancelAllRequests: () => void
} | null>(null)
const homeTabRefs = ref<HTMLButtonElement[]>([])
const homeTabIndicator = reactive({ left: 0, width: 0 })

const homeTabs = computed(() => {
  const list: Array<{
    key: HomeTabKey
    label: string
    icon: string
  }> = []

  if (canAccessDataDashboard.value) {
    list.push({
      key: 'dashboard',
      label: '数据看板',
      icon: 'mdi:chart-line',
    })
  }

  if (canAccessDramaClip.value) {
    list.push({
      key: 'clip',
      label: '爆剧爆剪',
      icon: 'mdi:fire',
    })
  }

  if (canAccessFeishuBoard.value) {
    list.push({
      key: 'feishu',
      label: '飞书表格',
      icon: 'mdi:view-dashboard-outline',
    })
  }

  return list
})

const hasHomeTabs = computed(() => homeTabs.value.length > 0)
const shouldShowHomeTabBar = computed(() => homeTabs.value.length > 1)

function isHomeTabAllowed(tab: HomeTabKey) {
  return homeTabs.value.some(item => item.key === tab)
}

function getFirstAllowedHomeTab() {
  return homeTabs.value[0]?.key || ''
}

function ensureActiveHomeTab() {
  if (!hasActiveChannel.value || !hasHomeTabs.value) return

  if (isHomeTabAllowed(activeHomeTab.value)) {
    return
  }

  const next = getFirstAllowedHomeTab()
  if (!next) return

  cancelHomeTabRequests(activeHomeTab.value)
  activeHomeTab.value = next
  if (next === 'clip') {
    clipPaneActivated.value = true
  }
  syncHomeTabToUrl(next)
}

function updateHomeTabIndicator() {
  const idx = homeTabs.value.findIndex(tab => tab.key === activeHomeTab.value)
  const el = homeTabRefs.value[idx]
  if (!el) {
    homeTabIndicator.width = 0
    return
  }
  homeTabIndicator.left = el.offsetLeft
  homeTabIndicator.width = el.offsetWidth
}

function syncHomeTabToUrl(tab: HomeTabKey) {
  const desired = tab === 'dashboard' ? undefined : tab
  const current = String(route.query.tab || '') || undefined
  if (current === desired) return
  const nextQuery = { ...route.query }
  if (desired) {
    nextQuery.tab = desired
  } else {
    delete nextQuery.tab
  }
  router.replace({ query: nextQuery }).catch(() => {
    /* 忽略导航重复错误 */
  })
}

async function handleHomeTabChange(tab: HomeTabKey) {
  if (activeHomeTab.value === tab) return
  if (!isHomeTabAllowed(tab)) {
    return
  }
  cancelHomeTabRequests(activeHomeTab.value)
  activeHomeTab.value = tab
  if (tab === 'clip') {
    clipPaneActivated.value = true
  }
  syncHomeTabToUrl(tab)
  await nextTick()
  updateHomeTabIndicator()

  // 切到数据看板 / 飞书表格时主动刷新数据
  if (tab === 'dashboard' && hasActiveChannel.value) {
    loadDashboardData().catch(error => {
      console.error('刷新首页数据失败:', error)
    })
  } else if (tab === 'feishu') {
    feishuPanelRef.value?.refresh()
  }
}

function cancelHomeTabRequests(tab: HomeTabKey) {
  if (tab === 'dashboard') {
    cancelDashboardRequests()
    return
  }
  if (tab === 'clip') {
    clipPanelRef.value?.cancelAllRequests()
    return
  }
  if (tab === 'feishu') {
    feishuPanelRef.value?.cancelAllRequests()
  }
}
const currentOrderChannelBadge = computed(() => {
  const activeChannel = channelTabs.value.find(channel => channel.id === activeChannelTabId.value)
  const channelName = String(activeChannel?.name || sessionStore.currentChannel?.name || '').trim()
  if (!channelName) {
    return '当前渠道'
  }

  return channelName.endsWith('渠道') ? channelName : `${channelName}渠道`
})
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
        if (
          String(value || '').trim() === String(changePasswordForm.currentPassword || '').trim()
        ) {
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

const orderSummaryTargets = computed(() =>
  Array.isArray(ordersData.value?.promotion_user_summaries)
    ? (ordersData.value?.promotion_user_summaries || []).map(item => ({
        username: item.username,
        aliases:
          Array.isArray(item.aliases) && item.aliases.length > 0 ? item.aliases : [item.username],
      }))
    : []
)
const orderStatsChildUserIds = computed(() =>
  Array.isArray(sessionStore.currentRuntimeUser?.orderUserStats?.childUserIds)
    ? sessionStore.currentRuntimeUser.orderUserStats.childUserIds
        .map(item => String(item || '').trim())
        .filter(Boolean)
    : []
)
const orderStatsParentUserName = computed(() =>
  String(
    sessionStore.currentRuntimeUser?.nickname ||
      sessionStore.currentRuntimeUser?.account ||
      sessionStore.currentRuntimeUser?.id ||
      ''
  ).trim()
)

const allOrderRows = computed<OrderItem[]>(() => ordersData.value?.data || [])

function getOrderSummaryTarget(username: string) {
  return orderSummaryTargets.value.find(target => target.username === username) || null
}

function isPromotionNameMatchedByAlias(promotionName: string, alias: string) {
  const normalizedName = String(promotionName || '').trim()
  const normalizedAlias = String(alias || '').trim()
  if (!normalizedName || !normalizedAlias) {
    return false
  }

  return normalizedName.includes(normalizedAlias)
}

function isOrderMatchedBySummaryTarget(order: OrderItem, username: string) {
  const target = getOrderSummaryTarget(username)
  if (!target) {
    return false
  }

  const promotionName = String(order.promotion_name || '').trim()
  return target.aliases.some(alias => isPromotionNameMatchedByAlias(promotionName, alias))
}

const rootPromotionOrders = computed(() => {
  if (!activePromotionUserName.value) {
    return allOrderRows.value
  }

  return allOrderRows.value.filter(order =>
    isOrderMatchedBySummaryTarget(order, activePromotionUserName.value)
  )
})

function matchOrdersByAliases(orders: OrderItem[], aliases: string[]) {
  const normalizedAliases = Array.isArray(aliases) ? aliases : []
  if (normalizedAliases.length === 0) {
    return []
  }

  return orders.filter(order => {
    const promotionName = String(order.promotion_name || '').trim()
    return normalizedAliases.some(alias => isPromotionNameMatchedByAlias(promotionName, alias))
  })
}

const orderBranchCardItems = computed(() => {
  const summaries = Array.isArray(ordersData.value?.promotion_user_branch_summaries)
    ? ordersData.value.promotion_user_branch_summaries
    : []

  const branchCards = summaries.map((summary: PromotionUserSummary) => ({
    key: summary.username,
    label: summary.username,
    total: Number(summary.total || 0),
    totalAmount: Number(summary.total_amount || 0),
    paidOrderCount: Number(summary.paid_order_count || 0),
    aliases: Array.isArray(summary.aliases) ? summary.aliases : [],
  }))

  if (orderUserSortMode.value === 'amount_desc') {
    return [...branchCards].sort((left, right) => {
      const amountDiff = right.totalAmount - left.totalAmount
      if (amountDiff !== 0) {
        return amountDiff
      }
      return right.paidOrderCount - left.paidOrderCount
    })
  }

  return branchCards
})

const shouldFlattenOrderBranch = computed(() => {
  const summaries = Array.isArray(ordersData.value?.promotion_user_summaries)
    ? ordersData.value.promotion_user_summaries
    : []
  return (
    summaries.length === 1 &&
    orderStatsChildUserIds.value.length > 0 &&
    orderBranchCardItems.value.length > 0
  )
})

const activeBranchCard = computed(
  () => orderBranchCardItems.value.find(item => item.key === activeBranchUserId.value) || null
)

const shouldShowOrderBranch = computed(
  () =>
    !shouldFlattenOrderBranch.value &&
    orderStatsChildUserIds.value.length > 0 &&
    activePromotionUserName.value === orderStatsParentUserName.value &&
    orderBranchCardItems.value.length > 0
)

const orderRows = computed<OrderItem[]>(() => {
  if (shouldFlattenOrderBranch.value) {
    return activeBranchCard.value
      ? matchOrdersByAliases(allOrderRows.value, activeBranchCard.value.aliases || [])
      : allOrderRows.value
  }

  if (shouldShowOrderBranch.value && activeBranchCard.value) {
    return matchOrdersByAliases(rootPromotionOrders.value, activeBranchCard.value?.aliases || [])
  }

  if (!activePromotionUserName.value) {
    return allOrderRows.value
  }

  return rootPromotionOrders.value
})

const shouldShowOwnOrderSummary = computed(
  () => canAccessOrderStats.value && ordersData.value?.order_visibility_scope === 'own'
)
const ownOrderDateRangeText = computed(() => {
  if (!orderDateRange.value) {
    return '当前筛选时间范围'
  }

  const [begin, end] = orderDateRange.value
  return `${begin} 至 ${end}`
})
const ownOrderTotalAmount = computed(() =>
  typeof ordersData.value?.total_amount === 'number'
    ? ordersData.value.total_amount
    : calculateOrderRechargeAmount(orderRows.value)
)
const ownOrderTotalCount = computed(() =>
  typeof ordersData.value?.total === 'number' ? ordersData.value.total : orderRows.value.length
)
const ownOrderSummaryCards = computed(() => [
  {
    key: 'amount',
    label: '总充值金额',
    value: formatCurrency(ownOrderTotalAmount.value),
    meta: ownOrderDateRangeText.value,
    icon: 'mdi:cash-multiple',
    iconClass: 'own-order-summary-card__icon--amount',
  },
  {
    key: 'orders',
    label: '总订单数',
    value: `${formatNumberValue(ownOrderTotalCount.value)}单`,
    meta: '这段时间我的全部订单',
    icon: 'mdi:receipt-text-check-outline',
    iconClass: 'own-order-summary-card__icon--orders',
  },
])

const pagedOrderRows = computed<OrderItem[]>(() => {
  const pageSize = Number(ordersPagination.pageSize || 10)
  const startIndex = Math.max(ordersCurrentPage.value - 1, 0) * pageSize
  return orderRows.value.slice(startIndex, startIndex + pageSize)
})

const orderUserTabs = computed<OrderUserCardItem[]>(() => {
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

  if (shouldFlattenOrderBranch.value) {
    return [
      {
        key: '',
        label: '全部',
        total:
          typeof ordersData.value?.all_total === 'number'
            ? ordersData.value.all_total
            : (ordersData.value?.data || []).length,
        totalAmount:
          typeof ordersData.value?.all_total_amount === 'number'
            ? ordersData.value.all_total_amount
            : calculateOrderRechargeAmount(ordersData.value?.data || []),
        meta: '当前时间段全部订单汇总',
        scope: 'all' as const,
      },
      ...orderBranchCardItems.value.map(branchUser => ({
        key: branchUser.key,
        label: branchUser.label,
        total: branchUser.total,
        totalAmount: branchUser.totalAmount,
        meta: `支付成功 ${formatNumberValue(branchUser.paidOrderCount || 0)} 单`,
        scope: 'branch' as const,
        aliases: branchUser.aliases,
      })),
    ]
  }

  const summaryCards = sortedSummaries.map((summary: PromotionUserSummary) => ({
    key: summary.username,
    label: summary.username,
    total: Number(summary.total || 0),
    totalAmount: Number(summary.total_amount || 0),
    meta: `支付成功 ${formatNumberValue(summary.paid_order_count || 0)} 单`,
    scope: 'summary' as const,
  }))

  if (summaries.length === 1) {
    return summaryCards
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
      scope: 'all' as const,
    },
    ...summaryCards,
  ]
})

const orderUserCardItems = computed<OrderUserCardItem[]>(() => {
  if (orderUserTabs.value.length > 0) {
    return orderUserTabs.value
  }

  if (!ordersLoading.value || configuredOrderUsernames.value.length === 0) {
    return []
  }

  const loadingUserCards = configuredOrderUsernames.value.map(username => ({
    key: `__loading_${username}`,
    label: username,
    total: 0,
    totalAmount: 0,
    meta: '加载中',
    scope: 'loading' as const,
  }))

  if (configuredOrderUsernames.value.length === 1 && orderStatsChildUserIds.value.length === 0) {
    return loadingUserCards
  }

  return [
    {
      key: '__loading_all__',
      label: '全部',
      total: 0,
      totalAmount: 0,
      meta: '当前时间段全部订单汇总',
      scope: 'loading' as const,
    },
    ...loadingUserCards,
  ]
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
    case 'yesterday':
      startDate.setDate(startDate.getDate() - 1)
      return [formatDate(startDate), formatDate(startDate)]
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

function formatYuanAmount(amount: number) {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function formatNullableYuanAmount(amount: number | null) {
  return amount === null ? '-' : formatYuanAmount(amount)
}

function formatThirdPartyRevenueDate(date: string) {
  const [, month, day] = date.split('-')
  return `${Number(month || 0)}月${Number(day || 0)}日`
}

function formatRatioValue(value: number | null) {
  return value === null ? '-' : `${Number(value || 0).toFixed(2)}%`
}

function formatSpeedValue(value: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const amount = normalizeJcybNumber(value)
  return amount === null ? String(value) : amount.toFixed(2)
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

function getCurrentMonthDateRange() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    begin: formatDate(firstDay),
    end: formatDate(now),
  }
}

function getDateRangeList(begin: string, end: string) {
  const beginDate = new Date(`${begin} 00:00:00`)
  const endDate = new Date(`${end} 00:00:00`)
  if (Number.isNaN(beginDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < beginDate) {
    return []
  }

  const dates: string[] = []
  const cursor = new Date(beginDate)
  while (cursor <= endDate) {
    dates.push(formatDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function normalizeJcybNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalizedValue = String(value).replace(/[,%¥,\s]/g, '')
  if (!normalizedValue) {
    return null
  }

  const amount = Number(normalizedValue)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null
}

function roundMoneyAmount(value: number) {
  return Math.round(value * 100) / 100
}

function sumNullableNumbers(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => value !== null)
  return validValues.length > 0
    ? roundMoneyAmount(validValues.reduce((sum, value) => sum + value, 0))
    : null
}

function getThirdPartyShareRate(date: string) {
  return THIRD_PARTY_LOW_SHARE_DATES.has(date)
    ? THIRD_PARTY_LOW_SHARE_RATE
    : THIRD_PARTY_DEFAULT_SHARE_RATE
}

function getJcybAdReportToken() {
  return jcybAdReportTokenInput.value.trim()
}

function buildJcybRevenueRequestKey(today: string) {
  return [today, getJcybAdReportToken(), selectedJcybAppIds.value.join(',')].join('::')
}

function normalizeJcybAdInfoRow(date: string, row?: JcybAdInfoRow): ThirdPartyRevenueRow {
  const realCost = normalizeJcybNumber(row?.real_cost) ?? 0
  const payRoi = normalizeJcybNumber(row?.pay_amount_ratio_by_event_time_roi)
  const actualIncome =
    payRoi === null ? null : roundMoneyAmount(realCost * (payRoi / 100) - realCost)
  const revenueShare =
    actualIncome === null ? null : roundMoneyAmount(actualIncome * getThirdPartyShareRate(date))

  return {
    date,
    realCost,
    payRoi,
    costSpeed: String(row?.cost_speed || ''),
    actualIncome,
    revenueShare,
  }
}

async function fetchThirdPartyRevenueByDate(date: string): Promise<ThirdPartyRevenueRow> {
  const token = getJcybAdReportToken()
  const result = await getJcybAdInfo(
    {
      team_id: JCYB_TEAM_ID,
      app_id: selectedJcybAppIds.value.join(','),
      dimension: JCYB_AD_INFO_DIMENSION,
      end_date: date,
      page: 1,
      page_size: 20,
      start_date: date,
      time_type: 2,
      order: JCYB_AD_INFO_ORDER,
    },
    token
  )
  if (result.code !== 0) {
    throw new Error(result.message || `请求 ${date} 报表失败`)
  }

  return normalizeJcybAdInfoRow(date, result.data?.all_list)
}

async function loadJcybApps() {
  const token = getJcybAdReportToken()
  if (!token) {
    jcybAppOptions.value = []
    selectedJcybAppIds.value = []
    return
  }

  jcybAppsLoading.value = true
  try {
    const result = await getJcybApps(
      {
        team_id: JCYB_TEAM_ID,
        page: 1,
        page_size: 1000,
      },
      token
    )
    if (result.code !== 0) {
      throw new Error(result.message || '获取小程序列表失败')
    }

    const apps = Array.isArray(result.data?.list) ? result.data.list : []
    jcybAppOptions.value = apps
    selectedJcybAppIds.value = apps.map(app => String(app.id))
  } catch (error) {
    console.error('获取小程序列表失败:', error)
    jcybAppOptions.value = []
    selectedJcybAppIds.value = []
    message.warning(error instanceof Error ? error.message : '获取小程序列表失败')
  } finally {
    jcybAppsLoading.value = false
  }
}

async function loadThirdPartyRevenue(forceRefresh = false) {
  if (!isAdmin.value) {
    return
  }

  const token = getJcybAdReportToken()
  if (!token) {
    thirdPartyRevenueRows.value = []
    thirdPartyRevenueError.value = '请先配置系统鉴权 token'
    return
  }

  if (selectedJcybAppIds.value.length === 0) {
    thirdPartyRevenueRows.value = []
    thirdPartyRevenueError.value = '请至少选择一个小程序'
    return
  }

  const today = formatDate(new Date())
  const requestKey = buildJcybRevenueRequestKey(today)
  if (thirdPartyRevenueLoading.value) {
    return
  }

  if (
    !forceRefresh &&
    (thirdPartyRevenueLoadedKey.value === requestKey ||
      thirdPartyRevenueRequestedKey.value === requestKey)
  ) {
    return
  }

  thirdPartyRevenueRequestedKey.value = requestKey
  if (forceRefresh) {
    thirdPartyRevenueError.value = ''
  }

  const dates = getDateRangeList(THIRD_PARTY_REVENUE_START_DATE, today)
  if (dates.length === 0) {
    thirdPartyRevenueRows.value = []
    thirdPartyRevenueLoadedKey.value = requestKey
    return
  }

  thirdPartyRevenueLoading.value = true
  thirdPartyRevenueError.value = ''
  try {
    thirdPartyRevenueRows.value = await Promise.all(dates.map(fetchThirdPartyRevenueByDate))
    thirdPartyRevenueLoadedKey.value = requestKey
  } catch (error) {
    console.error('获取报表失败:', error)
    thirdPartyRevenueError.value = error instanceof Error ? error.message : '获取报表失败'
  } finally {
    thirdPartyRevenueLoading.value = false
  }
}

async function saveJcybAdReportToken() {
  const token = getJcybAdReportToken()
  if (token) {
    localStorage.setItem(JCYB_AD_REPORT_TOKEN_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(JCYB_AD_REPORT_TOKEN_STORAGE_KEY)
  }

  thirdPartyRevenueLoadedKey.value = ''
  thirdPartyRevenueRequestedKey.value = ''
  await loadJcybApps()
  await loadThirdPartyRevenue(true)
}

function refreshThirdPartyRevenue() {
  if (!isAdmin.value || thirdPartyRevenueLoading.value) {
    return
  }

  thirdPartyRevenueLoadedKey.value = ''
  thirdPartyRevenueRequestedKey.value = ''
  loadThirdPartyRevenue(true)
}

function handleJcybAppChange() {
  thirdPartyRevenueLoadedKey.value = ''
  thirdPartyRevenueRequestedKey.value = ''
  void loadThirdPartyRevenue(true)
}

function selectAllJcybApps() {
  const appIds = jcybAppOptions.value.map(app => String(app.id))
  if (appIds.length === 0 || selectedJcybAppIds.value.length === appIds.length) {
    return
  }

  selectedJcybAppIds.value = appIds
  handleJcybAppChange()
}

function clearSelectedJcybApps() {
  if (selectedJcybAppIds.value.length === 0) {
    return
  }

  selectedJcybAppIds.value = []
  handleJcybAppChange()
}

async function openBrandRevenuePopover() {
  if (!showBrandRevenue.value || !isAdmin.value) {
    return
  }

  brandRevenuePopoverOpen.value = true
  if (!getJcybAdReportToken()) {
    jcybAdReportTokenInput.value = localStorage.getItem(JCYB_AD_REPORT_TOKEN_STORAGE_KEY) || ''
  }

  if (jcybAppOptions.value.length === 0 && !jcybAppsLoading.value) {
    await loadJcybApps()
  }

  await loadThirdPartyRevenue()
}

function closeBrandRevenuePopover() {
  brandRevenuePopoverOpen.value = false
}

function toggleBrandRevenuePopover() {
  if (brandRevenuePopoverOpen.value) {
    closeBrandRevenuePopover()
    return
  }

  void openBrandRevenuePopover()
}

function handleBrandRevenueGlobalPointerDown() {
  closeBrandRevenuePopover()
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

function isRequestCanceled(error: unknown) {
  const requestError = error as { name?: string; code?: string; message?: string }
  return (
    requestError?.name === 'AbortError' ||
    requestError?.name === 'CanceledError' ||
    requestError?.code === 'ERR_CANCELED' ||
    requestError?.message === 'canceled'
  )
}

function beginDashboardRequest(scope: DashboardRequestScope): DashboardRequestContext {
  dashboardRequestControllers.get(scope)?.abort()
  const controller = new AbortController()
  dashboardRequestControllers.set(scope, controller)
  return {
    scope,
    controller,
    signal: controller.signal,
    generation: dashboardRequestGeneration,
  }
}

function finishDashboardRequest(context: DashboardRequestContext) {
  if (dashboardRequestControllers.get(context.scope) === context.controller) {
    dashboardRequestControllers.delete(context.scope)
  }
}

function isActiveDashboardRequest(context: DashboardRequestContext) {
  return (
    !context.signal.aborted &&
    context.generation === dashboardRequestGeneration &&
    dashboardRequestControllers.get(context.scope) === context.controller
  )
}

function cancelDashboardRequests() {
  dashboardRequestGeneration += 1
  dashboardRequestControllers.forEach(controller => controller.abort())
  dashboardRequestControllers.clear()
  overviewLoading.value = false
  reportLoading.value = false
  ordersLoading.value = false
}

function resetOrderStatsForChannelSwitch() {
  orderDateRange.value = getDefaultDateRange()
  ordersData.value = null
  ordersError.value = ''
  ordersCurrentPage.value = 1
  ordersPagination.page = 1
  activePromotionUserName.value = ''
  activeBranchUserId.value = ''
}

async function triggerDashboardRefresh() {
  if (!hasActiveChannel.value) return
  await loadDashboardData()
}

async function fetchOverviewData() {
  if (!hasActiveChannel.value || !canAccessOverview.value) {
    overviewToday.value = null
    overviewAll.value = null
    monthRechargeAmount.value = 0
    overviewUpdatedAt.value = ''
    overviewError.value = ''
    return
  }

  const requestContext = beginDashboardRequest('overview')
  overviewLoading.value = true
  overviewError.value = ''
  try {
    const { begin, end } = getCurrentMonthDateRange()
    const [todayRes, allRes, monthlyRes] = await Promise.all([
      getDataOverviewV1({ is_today: true, app_type: 7 }, { signal: requestContext.signal }),
      getDataOverviewV1({ is_today: false, app_type: 7 }, { signal: requestContext.signal }),
      getMonthlyRechargeAnalyze(
        {
          begin,
          end,
          analyze_type: 1,
          app_type: 7,
        },
        { signal: requestContext.signal }
      ),
    ])
    if (!isActiveDashboardRequest(requestContext)) return

    overviewToday.value = todayRes.data
    overviewAll.value = allRes.data
    monthRechargeAmount.value = monthlyRes?.total || 0
    overviewUpdatedAt.value = new Date().toLocaleString('zh-CN')
  } catch (error) {
    if (isRequestCanceled(error) || !isActiveDashboardRequest(requestContext)) return

    console.error('获取数据概览失败:', error)
    overviewError.value = error instanceof Error ? error.message : '获取数据概览失败'
  } finally {
    if (isActiveDashboardRequest(requestContext)) {
      overviewLoading.value = false
    }
    finishDashboardRequest(requestContext)
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

  const requestContext = beginDashboardRequest('report')
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
    const nextReportData = await getReport(params, { signal: requestContext.signal })
    if (!isActiveDashboardRequest(requestContext)) return

    reportData.value = nextReportData
    reportCurrentPage.value = 1
    reportPagination.page = 1
  } catch (error) {
    if (isRequestCanceled(error) || !isActiveDashboardRequest(requestContext)) return

    console.error('获取数据报表失败:', error)
    reportError.value = error instanceof Error ? error.message : '获取数据报表失败'
  } finally {
    if (isActiveDashboardRequest(requestContext)) {
      reportLoading.value = false
    }
    finishDashboardRequest(requestContext)
  }
}

async function fetchOrdersData() {
  if (!hasActiveChannel.value || !canAccessOrderStats.value || !orderDateRange.value) {
    ordersData.value = null
    ordersError.value = ''
    ordersCurrentPage.value = 1
    ordersPagination.page = 1
    return
  }

  const requestContext = beginDashboardRequest('orders')
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
    const response = await getOrders(params, { signal: requestContext.signal })
    if (!isActiveDashboardRequest(requestContext)) return

    ordersData.value = response
    const nextSummaryUsernames = Array.isArray(response.promotion_user_summaries)
      ? response.promotion_user_summaries.map(item => item.username)
      : []
    activePromotionUserName.value = nextSummaryUsernames.includes(previousActivePromotionUserName)
      ? previousActivePromotionUserName
      : nextSummaryUsernames.length === 1
        ? nextSummaryUsernames[0]
        : ''
    ordersCurrentPage.value = 1
    ordersPagination.page = 1
  } catch (error) {
    if (isRequestCanceled(error) || !isActiveDashboardRequest(requestContext)) return

    console.error('获取订单统计失败:', error)
    ordersError.value = error instanceof Error ? error.message : '获取订单统计失败'
  } finally {
    if (isActiveDashboardRequest(requestContext)) {
      ordersLoading.value = false
    }
    finishDashboardRequest(requestContext)
  }
}

async function loadChannelMaterialConfig() {
  if (!hasActiveChannel.value) return

  const requestContext = beginDashboardRequest('material')
  try {
    await douyinMaterialStore.loadFromServer(true, requestContext.signal)
  } catch (error) {
    if (isRequestCanceled(error) || !isActiveDashboardRequest(requestContext)) return

    console.error('加载抖音号匹配素材失败:', error)
  } finally {
    finishDashboardRequest(requestContext)
  }
}

async function loadDashboardData() {
  if (!hasActiveChannel.value || !canAccessDataDashboard.value) return

  const tasks: Array<Promise<void>> = []
  if (canAccessOverview.value) tasks.push(fetchOverviewData())
  if (canAccessReport.value) tasks.push(fetchReportData())
  if (canAccessOrderStats.value) tasks.push(fetchOrdersData())
  await Promise.all(tasks)
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

  channelSwitchController?.abort()
  channelSwitchController = new AbortController()
  const currentSwitchSerial = ++channelSwitchSerial
  const { signal } = channelSwitchController

  cancelDashboardRequests()
  clipPanelRef.value?.cancelAllRequests()
  feishuPanelRef.value?.cancelAllRequests()
  resetOrderStatsForChannelSwitch()
  sessionStore.updateSelectedChannel(value)

  try {
    await refreshDashboardContext(signal)
    if (signal.aborted || currentSwitchSerial !== channelSwitchSerial) return

    ensureActiveHomeTab()

    await loadChannelMaterialConfig()
    if (signal.aborted || currentSwitchSerial !== channelSwitchSerial) return

    await loadDashboardData()
  } catch (error) {
    if (!isRequestCanceled(error)) {
      console.error('切换渠道失败:', error)
      message.error(error instanceof Error ? error.message : '切换渠道失败')
    }
  } finally {
    if (channelSwitchController?.signal === signal) {
      channelSwitchController = null
    }
  }
}

async function refreshDashboardContext(signal?: AbortSignal) {
  await sessionStore.loadSession(signal)
  if (signal?.aborted) return
  await apiConfigStore.loadFromStorage(signal)
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

function isOrderUserCardActive(tab: OrderUserCardItem) {
  if (tab.scope === 'all') {
    return !activePromotionUserName.value && !activeBranchUserId.value
  }

  if (tab.scope === 'branch') {
    return activeBranchUserId.value === tab.key
  }

  return activePromotionUserName.value === tab.key
}

function handleOrderUserCardChange(tab: OrderUserCardItem) {
  if (tab.scope === 'branch') {
    handleBranchUserChange(tab.key)
    if (activePromotionUserName.value) {
      activePromotionUserName.value = ''
    }
    return
  }

  if (tab.scope === 'all') {
    if (activeBranchUserId.value) {
      activeBranchUserId.value = ''
      ordersCurrentPage.value = 1
      ordersPagination.page = 1
    }
  }

  handlePromotionUserTabChange(tab.key)
}

function handlePromotionUserTabChange(username: string) {
  if (activePromotionUserName.value === username) {
    return
  }

  activePromotionUserName.value = username
  if (username !== orderStatsParentUserName.value) {
    activeBranchUserId.value = ''
  }
  ordersCurrentPage.value = 1
  ordersPagination.page = 1
}

function handleBranchUserChange(userId: string) {
  if (activeBranchUserId.value === userId) {
    return
  }

  activeBranchUserId.value = userId
  ordersCurrentPage.value = 1
  ordersPagination.page = 1
}

function handleWindowResize() {
  checkMobile()
  updateHomeTabIndicator()
}

onMounted(async () => {
  checkMobile()
  jcybAdReportTokenInput.value = localStorage.getItem(JCYB_AD_REPORT_TOKEN_STORAGE_KEY) || ''
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('pointerdown', handleBrandRevenueGlobalPointerDown)
  reportDateRange.value = getDefaultDateRange()
  orderDateRange.value = getDefaultDateRange()
  await refreshDashboardContext()
  ensureActiveHomeTab()
  adminApi.reportPageVisit('首页').catch((error: unknown) => {
    console.warn('记录首页访问日志失败:', error)
  })
  if (hasActiveChannel.value) {
    loadChannelMaterialConfig().catch(error => {
      console.error('加载抖音号匹配素材失败:', error)
    })
    await loadDashboardData()
  }

  // 初始化 Tab 指示器位置(等待 DOM 就绪)
  await nextTick()
  updateHomeTabIndicator()

  // 若初始 tab 不是 dashboard,需要做对应操作
  if (activeHomeTab.value === 'feishu') {
    // 等下一 tick 让 FeishuBoardPanel 完成挂载
    nextTick(() => feishuPanelRef.value?.refresh())
  }
})

// 切到无渠道状态时,Tab 内容会被 v-if 隐藏,无需特别处理
watch(activeHomeTab, async () => {
  await nextTick()
  updateHomeTabIndicator()
})

// hasActiveChannel 变化(显示/隐藏 Tab Bar)后需要重算指示器
watch(hasActiveChannel, async () => {
  await nextTick()
  updateHomeTabIndicator()
})

// 浏览器前进/后退同步 URL tab 参数
watch(
  () => route.query.tab,
  newVal => {
    const next: HomeTabKey = VALID_HOME_TABS.includes(String(newVal) as HomeTabKey)
      ? (String(newVal) as HomeTabKey)
      : 'dashboard'
    if (!isHomeTabAllowed(next)) {
      ensureActiveHomeTab()
      return
    }
    if (next !== activeHomeTab.value) {
      cancelHomeTabRequests(activeHomeTab.value)
      activeHomeTab.value = next
      if (next === 'clip') clipPaneActivated.value = true
    }
  }
)

watch(
  hasActiveChannel,
  active => {
    if (active) {
      ensureActiveHomeTab()
      loadChannelMaterialConfig().catch(error => {
        console.error('加载抖音号匹配素材失败:', error)
      })
      loadDashboardData().catch(error => {
        console.error('加载首页数据失败:', error)
      })
    } else {
      cancelDashboardRequests()
    }
  },
  { immediate: false }
)

watch(homeTabs, async () => {
  ensureActiveHomeTab()
  await nextTick()
  updateHomeTabIndicator()
})

watch(reportCurrentPage, page => {
  reportPagination.page = page
})

watch(ordersCurrentPage, page => {
  ordersPagination.page = page
})

function handleOrdersPageChange(page: number) {
  ordersCurrentPage.value = page
}

watch(
  [activePromotionUserName, orderBranchCardItems, shouldFlattenOrderBranch],
  ([activeUsername, branchCards, shouldFlatten]) => {
    if (shouldFlatten) {
      if (activePromotionUserName.value) {
        activePromotionUserName.value = ''
      }

      const hasActiveBranchUser = branchCards.some(item => item.key === activeBranchUserId.value)
      if (hasActiveBranchUser) {
        return
      }

      if (activeBranchUserId.value) {
        activeBranchUserId.value = ''
        ordersCurrentPage.value = 1
        ordersPagination.page = 1
      }
      return
    }

    if (activeUsername !== orderStatsParentUserName.value || branchCards.length === 0) {
      if (activeBranchUserId.value) {
        activeBranchUserId.value = ''
      }
      return
    }

    const hasActiveBranchUser = branchCards.some(item => item.key === activeBranchUserId.value)
    if (hasActiveBranchUser) {
      return
    }

    activeBranchUserId.value = branchCards[0].key
    ordersCurrentPage.value = 1
    ordersPagination.page = 1
  },
  { immediate: true }
)

onUnmounted(() => {
  channelSwitchController?.abort()
  cancelDashboardRequests()
  window.removeEventListener('pointerdown', handleBrandRevenueGlobalPointerDown)
  window.removeEventListener('resize', handleWindowResize)
})
</script>

<style scoped>
.brand-revenue-menu {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.brand-revenue-trigger {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  min-height: 3.5rem;
  padding-right: 0.4rem;
  border-radius: 1rem;
  outline: none;
  cursor: pointer;
}

.brand-revenue-trigger:focus-visible {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}

.brand-revenue-popover {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: -0.25rem;
  display: flex;
  flex-direction: column;
  width: min(28rem, calc(100vw - 2rem));
  max-height: min(34rem, calc(100dvh - 5.25rem));
  padding: 0.85rem;
  border-radius: 1.15rem;
  border: 1px solid rgba(191, 219, 254, 0.86);
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 42%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  box-shadow:
    0 28px 70px -34px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-0.35rem) scale(0.98);
  transform-origin: top left;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0.18s ease;
  z-index: 80;
}

.brand-revenue-menu--disabled .brand-revenue-popover {
  opacity: 0;
  visibility: hidden;
  transform: translateY(-0.35rem) scale(0.98);
}

.brand-revenue-menu--open:not(.brand-revenue-menu--disabled) .brand-revenue-popover {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
}

.brand-revenue-popover__header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.brand-revenue-popover__hero {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  background: linear-gradient(120deg, #f97316 0%, #f59e0b 35%, #ef4444 70%, #db2777 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 6px 18px rgba(249, 115, 22, 0.18);
}

.brand-revenue-popover__refresh {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
  border-radius: 9999px;
  border: 1px solid rgba(249, 115, 22, 0.32);
  background: rgba(255, 255, 255, 0.92);
  color: rgb(234 88 12);
  cursor: pointer;
  box-shadow: 0 6px 14px -8px rgba(249, 115, 22, 0.45);
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.brand-revenue-popover__refresh:hover {
  transform: translateY(-50%) rotate(60deg);
  background: rgba(255, 247, 237, 0.96);
  border-color: rgba(234, 88, 12, 0.55);
  color: rgb(194 65 12);
}

.brand-revenue-popover__refresh:disabled {
  cursor: progress;
  opacity: 0.85;
}

.brand-revenue-popover__refresh-icon {
  width: 1rem;
  height: 1rem;
}

.brand-revenue-popover__refresh--loading .brand-revenue-popover__refresh-icon {
  animation: brand-revenue-spin 0.9s linear infinite;
}

.brand-revenue-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 0.62rem;
  margin-bottom: 0.75rem;
}

.brand-revenue-field {
  min-width: 0;
}

.brand-revenue-field__label {
  display: block;
  margin-bottom: 0.28rem;
  color: rgb(71 85 105);
  font-size: 0.74rem;
  font-weight: 800;
}

:deep(.brand-revenue-app-select .n-base-selection) {
  min-height: 1.75rem;
}

:deep(.brand-revenue-app-select .n-base-selection-tags) {
  flex-wrap: nowrap;
  overflow: hidden;
  min-width: 0;
}

:deep(.brand-revenue-app-select .n-base-selection-tag-wrapper) {
  flex: 0 1 auto;
  min-width: 0;
  max-width: calc(100% - 5rem);
}

:deep(.brand-revenue-app-select .n-base-selection-tag-wrapper + .n-base-selection-tag-wrapper) {
  flex: 0 0 auto;
  max-width: none;
}

:deep(.brand-revenue-app-select .n-base-selection-tag-wrapper .n-tag) {
  max-width: 100%;
}

:deep(.brand-revenue-app-select .n-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-revenue-app-select-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  min-height: 2.25rem;
  padding: 0.38rem 0.55rem;
  border-bottom: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(248, 250, 252, 0.96);
}

.brand-revenue-app-select-tools {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.25rem;
}

.brand-revenue-app-select-command {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.55rem;
  padding: 0 0.45rem;
  border: 0;
  border-radius: 0.38rem;
  background: transparent;
  color: rgb(37 99 235);
  font-size: 0.76rem;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.brand-revenue-app-select-command:hover:not(:disabled) {
  background: rgba(219, 234, 254, 0.86);
  color: rgb(29 78 216);
}

.brand-revenue-app-select-command:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.brand-revenue-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 8rem;
  border-radius: 0.9rem;
  background: rgba(239, 246, 255, 0.72);
  color: rgb(71 85 105);
  font-size: 0.86rem;
  font-weight: 600;
}

.brand-revenue-state--error {
  background: rgba(254, 242, 242, 0.82);
  color: rgb(185 28 28);
}

.brand-revenue-spinner {
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  border: 2px solid rgba(59, 130, 246, 0.24);
  border-top-color: rgb(37 99 235);
  animation: brand-revenue-spin 0.8s linear infinite;
}

.brand-revenue-table-shell {
  min-height: 0;
  max-height: min(26rem, calc(100dvh - 10rem));
  overflow: auto;
  overscroll-behavior: contain;
  border-radius: 0.9rem;
  border: 1px solid rgba(226, 232, 240, 0.96);
  background: rgba(255, 255, 255, 0.86);
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.55) transparent;
}

.brand-revenue-table-shell::-webkit-scrollbar {
  width: 0.42rem;
  height: 0.42rem;
}

.brand-revenue-table-shell::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background: rgba(148, 163, 184, 0.5);
}

.brand-revenue-table {
  width: 100%;
  min-width: 38rem;
  border-collapse: separate;
  border-spacing: 0;
  color: rgb(30 41 59);
  font-size: 0.86rem;
}

.brand-revenue-table th,
.brand-revenue-table td {
  padding: 0.56rem 0.72rem;
  text-align: left;
  border-bottom: 1px solid rgba(226, 232, 240, 0.82);
}

.brand-revenue-table th {
  position: sticky;
  top: 0;
  z-index: 4;
  background: #eff6ff;
  box-shadow:
    0 1px 0 rgba(226, 232, 240, 0.96),
    0 8px 18px rgba(15, 23, 42, 0.08);
  color: rgb(71 85 105);
  font-size: 0.74rem;
  font-weight: 800;
}

.brand-revenue-table th:nth-child(n + 2),
.brand-revenue-table td:nth-child(n + 2) {
  text-align: right;
}

.brand-revenue-table th:first-child,
.brand-revenue-table td:first-child {
  position: sticky;
  left: 0;
  z-index: 5;
  min-width: 6.7rem;
}

.brand-revenue-table th:first-child {
  z-index: 8;
  background: #eff6ff;
}

.brand-revenue-table tbody td:first-child {
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 1px 0 0 rgba(226, 232, 240, 0.82);
}

.brand-revenue-table tbody tr:nth-child(even) td {
  background: rgba(248, 250, 252, 0.72);
}

.brand-revenue-table tbody tr:nth-child(even) td:first-child {
  background: rgba(248, 250, 252, 0.96);
}

.brand-revenue-table tbody td:nth-child(n + 3) {
  color: rgb(15 23 42);
  font-weight: 800;
}

.brand-revenue-skeleton-table th {
  color: rgba(71, 85, 105, 0.84);
}

.brand-revenue-skeleton-table tbody tr:nth-child(even) td {
  background: rgba(248, 250, 252, 0.64);
}

.brand-revenue-skeleton-line {
  position: relative;
  display: inline-flex;
  width: 4.7rem;
  height: 0.82rem;
  overflow: hidden;
  border-radius: 9999px;
  background: linear-gradient(90deg, rgba(226, 232, 240, 0.8), rgba(219, 234, 254, 0.92));
  vertical-align: middle;
}

.brand-revenue-skeleton-line::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-110%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.86), transparent);
  animation: brand-revenue-skeleton-shimmer 1.25s ease-in-out infinite;
}

.brand-revenue-skeleton-line.short {
  width: 3.45rem;
}

.brand-revenue-skeleton-line.compact {
  width: 3.2rem;
}

.brand-revenue-skeleton-line.strong {
  height: 0.92rem;
  background: linear-gradient(90deg, rgba(191, 219, 254, 0.95), rgba(219, 234, 254, 0.96));
}

.brand-revenue-table tfoot td {
  position: sticky;
  bottom: 0;
  z-index: 4;
  border-bottom: 0;
  background: #eaf2ff;
  box-shadow:
    0 -1px 0 rgba(191, 219, 254, 0.92),
    0 -10px 22px rgba(15, 23, 42, 0.08);
  color: rgb(30 64 175);
  font-weight: 900;
}

.brand-revenue-table tfoot td:first-child {
  z-index: 8;
  background: #eaf2ff;
}

@keyframes brand-revenue-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes brand-revenue-skeleton-shimmer {
  to {
    transform: translateX(110%);
  }
}

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
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.user-label-badge--clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px -16px rgba(37, 99, 235, 0.8);
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

.order-user-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 186px));
  gap: 0.65rem;
  align-items: stretch;
}

.order-user-tab {
  min-width: 0;
  width: 100%;
  min-height: 6.2rem;
  padding: 0.72rem 0.78rem 0.76rem;
  border: 1px solid rgba(251, 191, 36, 0.18);
  border-radius: 0.85rem;
  background:
    radial-gradient(circle at top right, rgba(253, 224, 71, 0.2), transparent 42%),
    linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(255, 247, 237, 0.98));
  box-shadow: 0 10px 24px -22px rgba(194, 65, 12, 0.42);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.order-user-tab--all {
  border-color: rgba(14, 165, 233, 0.16);
  background:
    radial-gradient(circle at top right, rgba(125, 211, 252, 0.18), transparent 42%),
    linear-gradient(180deg, rgba(240, 249, 255, 0.98), rgba(248, 250, 252, 0.98));
}

.order-user-tab:hover {
  transform: translateY(-1px);
  border-color: rgba(249, 115, 22, 0.28);
  box-shadow: 0 14px 28px -22px rgba(194, 65, 12, 0.48);
}

.order-user-tab.active {
  border-color: rgba(14, 116, 144, 0.28);
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.24), transparent 42%),
    linear-gradient(135deg, rgba(14, 165, 233, 0.98), rgba(3, 105, 161, 0.95));
  box-shadow: 0 18px 34px -28px rgba(3, 105, 161, 0.72);
}

.order-user-tab--loading {
  cursor: progress;
}

.order-user-tab--loading:hover {
  transform: none;
}

.order-user-tab__body {
  min-height: 100%;
}

.order-user-tab__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.45rem;
}

.order-user-tab__label {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: rgb(154 52 18);
  line-height: 1.25;
  word-break: break-all;
}

.order-user-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0.12rem 0.45rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.72);
  color: rgb(194 65 12);
  font-size: 0.68rem;
  font-weight: 600;
}

.order-user-tab__amount {
  margin-top: 0.46rem;
  font-size: 1.02rem;
  font-weight: 800;
  line-height: 1.2;
  color: rgb(15 23 42);
}

.order-user-tab__meta {
  margin-top: 0.26rem;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgb(120 113 108);
}

.own-order-summary {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(245, 158, 11, 0.16);
  border-radius: 1.1rem;
  padding: 0.95rem;
  background:
    radial-gradient(circle at top right, rgba(251, 191, 36, 0.24), transparent 34%),
    radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.14), transparent 30%),
    linear-gradient(135deg, rgba(255, 251, 235, 0.98), rgba(255, 255, 255, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 18px 42px -34px rgba(180, 83, 9, 0.42);
}

.own-order-summary__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  margin-bottom: 0.78rem;
}

.own-order-summary__eyebrow {
  margin: 0;
  color: rgb(217 119 6);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.own-order-summary__title {
  margin: 0.12rem 0 0;
  color: rgb(15 23 42);
  font-size: 0.98rem;
  font-weight: 800;
  line-height: 1.25;
}

.own-order-summary__badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0.22rem 0.58rem;
  border-radius: 9999px;
  color: rgb(180 83 9);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.16);
  font-size: 0.72rem;
  font-weight: 700;
}

.own-order-summary__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.own-order-summary-card {
  display: flex;
  align-items: center;
  gap: 0.78rem;
  min-width: 0;
  padding: 0.88rem 0.92rem;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 12px 26px -24px rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(10px);
}

.own-order-summary-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 0.85rem;
  color: white;
  box-shadow: 0 12px 24px -18px currentColor;
}

.own-order-summary-card__icon--amount {
  background: linear-gradient(135deg, rgb(245 158 11), rgb(249 115 22));
}

.own-order-summary-card__icon--orders {
  background: linear-gradient(135deg, rgb(14 165 233), rgb(37 99 235));
}

.own-order-summary-card__label {
  margin: 0;
  color: rgb(100 116 139);
  font-size: 0.76rem;
  font-weight: 700;
}

.own-order-summary-card__value {
  margin: 0.12rem 0 0;
  color: rgb(15 23 42);
  font-size: 1.24rem;
  font-weight: 900;
  line-height: 1.18;
}

.own-order-summary-card__meta {
  margin: 0.18rem 0 0;
  color: rgb(148 163 184);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.3;
}

.orders-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
}

.orders-pagination-prefix {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: rgb(100 116 139);
  font-size: 0.85rem;
  font-weight: 600;
}

:deep(.orders-table-footer .n-pagination) {
  margin-left: auto;
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

.order-branch-panel {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(14, 165, 233, 0.14);
  border-radius: 1rem;
  padding: 0.78rem 0.82rem 0.86rem;
  background:
    radial-gradient(circle at top right, rgba(34, 211, 238, 0.18), transparent 34%),
    radial-gradient(circle at left center, rgba(251, 191, 36, 0.14), transparent 30%),
    linear-gradient(145deg, rgba(248, 250, 252, 0.98), rgba(239, 246, 255, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 18px 40px -30px rgba(14, 116, 144, 0.32);
}

.order-branch-panel__tree {
  position: relative;
  padding-top: 0.95rem;
}

.order-branch-panel__trunk {
  position: absolute;
  top: 0;
  left: 1.2rem;
  width: calc(100% - 2.4rem);
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(56, 189, 248, 0.16),
    rgba(56, 189, 248, 0.5),
    rgba(14, 165, 233, 0.16)
  );
}

.order-branch-panel__trunk::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -0.7rem;
  width: 2px;
  height: 1rem;
  transform: translateX(-50%);
  background: linear-gradient(180deg, rgba(56, 189, 248, 0), rgba(14, 165, 233, 0.7));
}

.order-branch-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 156px));
  gap: 0.55rem;
  justify-content: start;
}

.order-branch-card {
  min-width: 0;
  min-height: 74px;
  padding: 0.56rem 0.62rem 0.6rem;
  border: 1px solid rgba(14, 165, 233, 0.12);
  border-radius: 0.72rem;
  background:
    radial-gradient(circle at top right, rgba(125, 211, 252, 0.12), transparent 36%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
  box-shadow: 0 8px 18px -22px rgba(14, 116, 144, 0.18);
  text-align: left;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.order-branch-card:hover {
  transform: translateY(-1px);
  border-color: rgba(14, 165, 233, 0.22);
  box-shadow: 0 10px 20px -22px rgba(14, 116, 144, 0.24);
}

.order-branch-card.active {
  border-color: rgba(14, 116, 144, 0.24);
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.14), transparent 40%),
    linear-gradient(145deg, rgba(239, 246, 255, 0.98), rgba(240, 249, 255, 0.98));
  box-shadow: 0 10px 22px -24px rgba(14, 116, 144, 0.28);
}

.order-branch-card__label {
  margin: 0;
  color: rgb(12 74 110);
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.25;
}

.order-branch-card__amount-label {
  margin: 0.34rem 0 0;
  color: rgb(100 116 139);
  font-size: 0.67rem;
  line-height: 1.2;
}

.order-branch-card__amount {
  margin: 0.16rem 0 0;
  color: rgb(15 23 42);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.15;
}

.order-branch-card.active .order-branch-card__label,
.order-branch-card.active .order-branch-card__amount {
  color: rgb(8 47 73);
}

.order-branch-card.active .order-branch-card__amount-label {
  color: rgb(14 116 144);
}

@keyframes order-tab-skeleton {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: -100% 50%;
  }
}

@media (max-width: 640px) {
  .brand-revenue-popover {
    position: fixed;
    top: 4.35rem;
    left: 0.75rem;
    right: 0.75rem;
    width: auto;
    max-height: calc(100dvh - 5.1rem);
    padding: 0.75rem;
    transform-origin: top left;
  }

  .brand-revenue-menu--open:not(.brand-revenue-menu--disabled) .brand-revenue-popover {
    transform: translateY(0) scale(1);
  }

  .brand-revenue-popover__header {
    margin-bottom: 0.62rem;
    padding-right: 2.2rem;
    justify-content: flex-start;
  }

  .brand-revenue-popover__hero {
    font-size: 1.18rem;
    letter-spacing: 0.04em;
  }

  .brand-revenue-toolbar {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
  }

  .brand-revenue-table-shell {
    max-height: calc(100dvh - 10.25rem);
    border-radius: 0.8rem;
  }

  .brand-revenue-table {
    font-size: 0.8rem;
  }

  .brand-revenue-table th,
  .brand-revenue-table td {
    padding: 0.52rem 0.58rem;
  }

  .order-user-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .own-order-summary__header {
    flex-direction: column;
  }

  .own-order-summary__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .order-branch-panel__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 460px) {
  .order-user-tabs {
    grid-template-columns: minmax(0, 1fr);
  }

  .order-branch-panel__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ============ 首页 Tab 切换器:胶囊分段式 + 滑动指示器 ============ */
.home-shell {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}

.dashboard-main {
  width: 100%;
  min-width: 0;
}

.home-tab-pane {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.home-tab-bar {
  position: relative;
  display: inline-flex;
  align-self: flex-start;
  padding: 5px;
  gap: 2px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.7));
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px -12px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.home-tab-bar::before {
  /* 顶部装饰高光 */
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.25), transparent);
  pointer-events: none;
}

.home-tab-button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border: 0;
  background: transparent;
  color: #475569;
  font-size: 14px;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.25s ease,
    transform 0.25s ease;
}

.home-tab-button:hover:not(.active):not(:disabled) {
  color: #1e293b;
  transform: translateY(-1px);
}

.home-tab-button.active {
  color: #4338ca;
  font-weight: 600;
}

.home-tab-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.home-tab-button__icon {
  width: 16px;
  height: 16px;
  transition: transform 0.3s ease;
}

.home-tab-button.active .home-tab-button__icon {
  transform: scale(1.1) rotate(-4deg);
  color: #6366f1;
}

.home-tab-button__label {
  line-height: 1;
}

.home-tab-indicator {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 0;
  width: 0;
  background: #fff;
  border-radius: 10px;
  box-shadow:
    0 1px 2px rgba(99, 102, 241, 0.15),
    0 6px 16px -8px rgba(99, 102, 241, 0.45);
  transition:
    transform 0.36s cubic-bezier(0.34, 1.18, 0.64, 1),
    width 0.36s cubic-bezier(0.34, 1.18, 0.64, 1);
  pointer-events: none;
  z-index: 0;
}

.home-tab-indicator::after {
  /* 渐变描边 */
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.5), rgba(168, 85, 247, 0.35));
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.home-tab-pane {
  /* 不保留 transform，避免移动端 fixed 浮层被当前 Tab 面板重新定位。 */
  animation: home-tab-fade-in 0.32s ease;
}

@keyframes home-tab-fade-in {
  0% {
    opacity: 0;
    transform: translateY(6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 移动端:Tab Bar 横向滚动,字号略缩 */
@media (max-width: 640px) {
  .home-tab-bar {
    align-self: stretch;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .channel-tabs-shell {
    display: flex;
    width: 100%;
  }

  .channel-tab-button {
    flex: 0 0 auto;
  }

  .home-tab-bar::-webkit-scrollbar {
    display: none;
  }

  .home-tab-button {
    padding: 8px 14px;
    font-size: 13px;
  }
}
</style>
