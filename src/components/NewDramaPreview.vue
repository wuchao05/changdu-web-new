<template>
  <div
    class="new-drama-preview-page min-h-full"
    :class="embedded ? 'is-embedded' : 'bg-gradient-to-br from-slate-50 to-blue-50'"
  >
    <!-- 顶部导航栏(仅独立页面模式显示) -->
    <header
      v-if="!embedded"
      class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- 左侧：Logo和标题 -->
          <div class="flex items-center space-x-4">
            <div
              class="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl"
            >
              <Icon icon="mdi:fire" class="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                class="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent"
              >
                渠道爆剧爆剪
              </h1>
              <p class="text-xs text-gray-500">聚焦当前渠道的新剧抢跑与榜单剧工作台</p>
            </div>
          </div>

          <!-- 右侧：操作按钮 -->
          <div class="flex items-center space-x-3">
            <!-- 返回首页按钮 -->
            <button
              @click="goBack"
              class="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Icon icon="mdi:arrow-left" class="w-4 h-4" />
              <span>返回首页</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- 置顶筛选区域 -->
    <div
      class="sticky z-40 bg-white/95 backdrop-blur-md border-b border-gray-200/60 shadow-sm filter-sticky"
      :class="embedded ? 'is-embedded' : ''"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="filter-section">
          <!-- 紧凑的筛选布局 -->
          <div class="compact-filter-row">
            <!-- Tab 切换 -->
            <div class="tab-switcher">
              <button
                @click="activeTab = 'new-drama'"
                :class="['tab-switch-btn', activeTab === 'new-drama' ? 'active' : '']"
              >
                <Icon icon="mdi:rocket-launch-outline" class="tab-icon-compact" />
                <span class="tab-text-compact">新剧抢跑</span>
              </button>
              <button
                @click="activeTab = 'ranking'"
                :class="['tab-switch-btn', activeTab === 'ranking' ? 'active' : '']"
              >
                <Icon icon="mdi:trophy" class="tab-icon-compact" />
                <span class="tab-text-compact">榜单剧</span>
              </button>
            </div>

            <!-- 搜索和查询 -->
            <div class="search-query-compact">
              <NSelect
                v-if="hasMultipleFeishuTableGroups"
                v-model:value="selectedFeishuTableGroupId"
                :options="feishuTableGroupOptions"
                size="small"
                class="feishu-group-select"
                placeholder="选择表格组"
              />
              <NInput
                v-model:value="searchKeyword"
                placeholder="搜索短剧名称..."
                clearable
                size="small"
                class="search-input-native"
                @input="handleSearchInput"
                @clear="clearSearch"
              >
                <template #prefix>
                  <Icon icon="mdi:magnify" class="w-4 h-4 text-gray-400" />
                </template>
              </NInput>
              <button
                @click="handleRefresh"
                :disabled="loading || listSkeletonLoading || searchLoading || rankingLoading"
                class="refresh-btn-modern"
                :title="
                  loading || listSkeletonLoading || searchLoading || rankingLoading
                    ? '刷新中...'
                    : '刷新数据'
                "
              >
                <Icon
                  icon="mdi:refresh"
                  :class="[
                    'refresh-icon-modern',
                    loading || listSkeletonLoading || searchLoading || rankingLoading
                      ? 'animate-spin'
                      : '',
                  ]"
                />
              </button>
              <button
                v-if="ENABLE_FETCH_ALL_NEW_DRAMA && activeTab === 'new-drama'"
                @click="handleFetchAllDramaList"
                :disabled="
                  fullDramaLoading ||
                  loading ||
                  listSkeletonLoading ||
                  searchLoading ||
                  rankingLoading
                "
                class="view-all-btn-modern"
                :title="fullDramaLoading ? '全量查询中...' : '全量查询所有新剧，查询时间慢'"
              >
                查看全部
              </button>
              <button
                @click="showAdxDrawer = true"
                class="refresh-btn-modern"
                title="adx短剧热力榜"
              >
                <Icon icon="mdi:fire" class="refresh-icon-modern" />
              </button>
              <!-- 自动提交下载按钮（在新剧抢跑tab显示） -->
              <button
                v-if="activeTab === 'new-drama'"
                @click="showAutoSubmitModal = true"
                :disabled="isAutoSubmitEnabledForCurrentChannel || loading || listSkeletonLoading"
                :class="[
                  'pending-download-btn',
                  isAutoSubmitEnabledForCurrentChannel ? 'active' : '',
                ]"
                :title="isAutoSubmitEnabledForCurrentChannel ? '自动提交运行中' : '自动提交下载'"
              >
                <Icon
                  icon="mdi:robot-outline"
                  :class="[
                    'pending-download-icon',
                    currentSchedulerStatus.running && isAutoSubmitEnabledForCurrentChannel
                      ? 'animate-pulse'
                      : '',
                  ]"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="clip-workspace" :class="{ 'has-adx-panel': showAdxDrawer }">
      <div
        ref="clipMainContentRef"
        class="clip-main-content px-4 sm:px-6 lg:px-8 py-6 pt-2 sm:pt-2 md:pt-2"
        :style="{ '--clip-content-panel-min-height': `${clipContentPanelMinHeight}px` }"
      >
        <!-- 自动提交下载状态栏 -->
        <div
          v-if="isAutoSubmitEnabledForCurrentChannel && activeTab === 'new-drama'"
          class="auto-download-bar"
        >
          <div class="auto-download-info">
            <Icon icon="mdi:robot-outline" class="auto-download-icon" />
            <div>
              <div class="auto-download-title">自动提交下载</div>
              <div class="auto-download-desc">
                <span v-if="currentSchedulerStatus.running">
                  <template v-if="currentSchedulerStatus.progress.total > 0">
                    正在处理【{{ currentSchedulerStatus.progress.currentDate }}】第
                    {{ currentSchedulerStatus.progress.current }}/{{
                      currentSchedulerStatus.progress.total
                    }}
                    部：{{ currentSchedulerStatus.progress.currentDrama }}
                  </template>
                  <template v-else>
                    正在{{ currentSchedulerStatus.progress.currentDate || '准备' }}...
                  </template>
                </span>
                <span v-else> 下次运行倒计时：{{ formatCountdown(autoSubmitCountdown) }} </span>
              </div>
            </div>
          </div>
          <div class="auto-download-actions">
            <button class="auto-download-button stop" @click="stopAutoSubmit">停止自动提交</button>
          </div>
        </div>

        <!-- 搜索态的全局提示 Toast -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="transform translate-y-2 opacity-0"
          enter-to-class="transform translate-y-0 opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="transform translate-y-0 opacity-100"
          leave-to-class="transform translate-y-2 opacity-0"
        >
          <div v-if="isSearching && showCopyToast" class="toast">
            <Icon icon="mdi:check-circle" class="toast-icon" />
            <span class="toast-message">{{ copyToastMessage }}</span>
          </div>
        </Transition>

        <div class="new-drama-preview">
          <div class="embedded-list-filter-row">
            <div v-if="activeTab === 'new-drama'" class="secondary-tab-switcher">
              <button
                v-for="date in dateOptions"
                :key="date.value"
                :disabled="isSearching"
                @click="!isSearching && (selectedDate = date.value)"
                :class="[
                  'secondary-tab-btn',
                  selectedDate === date.value ? 'active' : '',
                  isSearching ? 'is-disabled' : '',
                ]"
              >
                <Icon :icon="getDateIcon(date.value)" class="secondary-tab-icon" />
                <span class="secondary-tab-text">{{ date.label }}</span>
                <span v-if="getDateDramaCount(date.value) > 0" class="secondary-tab-count">
                  {{ getDateDramaCount(date.value) }}
                </span>
              </button>
            </div>
            <div v-else-if="activeTab === 'ranking'" class="secondary-tab-switcher">
              <button
                v-for="level in incomeLevelOptions"
                :key="level.value"
                @click="selectedIncomeLevel = level.value"
                :class="['secondary-tab-btn', selectedIncomeLevel === level.value ? 'active' : '']"
              >
                <Icon :icon="level.icon" class="secondary-tab-icon" />
                <span class="secondary-tab-text">{{ level.label }}</span>
              </button>
            </div>
            <div class="date-cart-actions">
              <div
                v-if="activeTab === 'new-drama' && !isSearching && newDramaStatusLoading"
                class="bulk-cart-skeleton"
                aria-hidden="true"
              >
                <span class="bulk-cart-skeleton__icon"></span>
                <span class="bulk-cart-skeleton__text"></span>
                <span class="bulk-cart-skeleton__count"></span>
              </div>
              <button
                v-else-if="activeTab === 'new-drama' && !isSearching"
                type="button"
                class="bulk-cart-button"
                :class="{ 'is-ready': currentDateAddableNotInCartCount > 0 }"
                :disabled="currentDateAddableNotInCartCount === 0"
                :title="bulkCartButtonTitle"
                @click="handleAddCurrentDateToCart"
              >
                <span class="bulk-cart-button__glow"></span>
                <Icon icon="mdi:tray-plus" class="bulk-cart-button__icon" />
                <span class="bulk-cart-button__text">一键加入</span>
                <span class="bulk-cart-button__count">{{ currentDateAddableNotInCartCount }}</span>
              </button>
              <DramaCart
                ref="dramaCartRef"
                inline
                :scope-key="currentChannelStateScopeKey"
                @batch-submitted="handleBatchSubmitted"
                @items-changed="handleCartItemsChanged"
              />
            </div>
          </div>

          <!-- 搜索结果列表 - 保留筛选行和购物车常驻 -->
          <div
            v-if="isSearching && !searchLoading && !error && searchResults.length > 0"
            class="drama-list"
          >
            <DramaCard
              v-for="drama in searchResults"
              :key="drama.book_id"
              :drama="drama"
              :download-data="getDownloadDataForDrama(drama.series_name)"
              :is-download-triggered="isDownloadTriggered(drama.series_name)"
              :is-syncing="syncingDramaId === drama.book_id"
              :is-processing="clipProcessingDramaId === drama.book_id"
              :is-any-syncing="isAnyOperationBlocked"
              :is-downloaded="isDramaDownloaded(drama.series_name)"
              :is-submitted-for-download="isSubmittedForDownload(drama.book_id)"
              :is-submitted-for-clip="isSubmittedForClip(drama.book_id)"
              :is-new-drama="isRedFlagDrama(drama)"
              :is-manual-red-flag="isManualRedFlag(drama.book_id)"
              :is-in-cart="isDramaInCart(drama.book_id)"
              @show-image="showDramaImage"
              @copy-name="copyDramaName"
              @sync-to-feishu="syncToFeishu"
              @add-to-cart="handleAddToCart"
              @red-flag-change="handleManualRedFlagChange"
              @download="handleDownload"
            />
          </div>
          <div v-else-if="isSearching && searchLoading" class="empty-state">
            <Icon icon="mdi:loading" class="empty-icon animate-spin" />
            <h3 class="empty-title">搜索中...</h3>
            <p class="empty-description">正在匹配短剧，请稍候</p>
          </div>
          <div v-else-if="isSearching && !searchLoading && !error" class="empty-state">
            <Icon icon="mdi:magnify" class="empty-icon" />
            <h3 class="empty-title">未找到相关短剧</h3>
            <p class="empty-description">请尝试其他关键词或清空搜索</p>
          </div>

          <!-- 骨架屏加载状态 -->
          <div
            v-if="loading || listSkeletonLoading || searchLoading || rankingLoading"
            class="drama-list-skeleton"
          >
            <div class="skeleton-drama-list">
              <div v-for="n in 8" :key="n" class="skeleton-drama-card">
                <!-- 左侧封面骨架 -->
                <div class="skeleton-poster"></div>

                <!-- 中间信息区域骨架 -->
                <div class="skeleton-drama-info">
                  <div class="skeleton-drama-main">
                    <div class="skeleton-drama-details">
                      <!-- 分类标签 -->
                      <div class="skeleton-category-tags">
                        <div class="skeleton-tag"></div>
                        <div class="skeleton-tag"></div>
                        <div class="skeleton-tag"></div>
                        <div class="skeleton-tag"></div>
                      </div>

                      <!-- 剧集信息 -->
                      <div class="skeleton-episode-info">
                        <div class="skeleton-episode-item"></div>
                      </div>

                      <!-- 首发时间 -->
                      <div class="skeleton-publish-time">
                        <div class="skeleton-time-text"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 右侧状态和操作区域骨架 -->
                <div class="skeleton-drama-actions">
                  <div class="skeleton-status-label"></div>
                  <div class="skeleton-drama-id"></div>
                  <div class="skeleton-action-button"></div>
                </div>
              </div>
            </div>
            <div class="skeleton-loading-indicator">
              <div class="skeleton-spinner"></div>
              <span class="skeleton-loading-text">
                {{
                  activeTab === 'ranking'
                    ? '正在加载榜单剧数据...'
                    : (activeTab as string) === 'feishu'
                      ? '正在加载飞书清单数据...'
                      : '正在加载新剧数据...'
                }}
              </span>
            </div>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="error" class="error-section">
            <Icon icon="mdi:alert-circle" class="error-icon" />
            <p class="error-message">{{ error }}</p>
            <button @click="fetchDramaList" class="retry-button">
              <Icon icon="mdi:refresh" class="w-4 h-4 mr-2" />
              重试
            </button>
          </div>

          <!-- 新剧抢跑列表 - 仅在没有搜索时显示 -->
          <div
            v-else-if="
              !isSearching &&
              !listSkeletonLoading &&
              paginatedDramas.length > 0 &&
              activeTab === 'new-drama'
            "
            class="drama-list"
          >
            <DramaCard
              v-for="drama in paginatedDramas"
              :key="drama.book_id"
              :drama="drama"
              :download-data="getDownloadDataForDrama(drama.series_name)"
              :is-download-triggered="isDownloadTriggered(drama.series_name)"
              :is-syncing="syncingDramaId === drama.book_id"
              :is-processing="clipProcessingDramaId === drama.book_id"
              :is-any-syncing="isAnyOperationBlocked"
              :is-downloaded="isDramaDownloaded(drama.series_name)"
              :is-submitted-for-download="isSubmittedForDownload(drama.book_id)"
              :is-submitted-for-clip="isSubmittedForClip(drama.book_id)"
              :is-new-drama="isRedFlagDrama(drama)"
              :is-manual-red-flag="isManualRedFlag(drama.book_id)"
              :is-in-cart="isDramaInCart(drama.book_id)"
              :status-loading="newDramaStatusLoading"
              @show-image="showDramaImage"
              @copy-name="copyDramaName"
              @sync-to-feishu="syncToFeishu"
              @add-to-cart="handleAddToCart"
              @red-flag-change="handleManualRedFlagChange"
              @download="handleDownload"
            />
          </div>

          <!-- 榜单剧列表 - 仅在没有搜索时显示 -->
          <div
            v-else-if="
              !isSearching && !rankingLoading && rankingList.length > 0 && activeTab === 'ranking'
            "
            class="drama-list"
          >
            <DramaCard
              v-for="(drama, index) in rankingList"
              :key="drama.book_id"
              :drama="drama as any"
              :download-data="getRankingDownloadDataForDrama(drama.book_name)"
              :is-download-triggered="isDownloadTriggered(drama.book_name)"
              :is-syncing="syncingDramaId === drama.book_id"
              :is-processing="clipProcessingDramaId === drama.book_id"
              :is-any-syncing="isAnyOperationBlocked"
              :is-downloaded="isRankingDramaDownloaded(drama.book_name)"
              :is-submitted-for-download="isSubmittedForDownload(drama.book_id)"
              :is-submitted-for-clip="isSubmittedForClip(drama.book_id)"
              :ranking="rankingPageIndex * rankingPageSize + index + 1"
              :show-ranking="true"
              :is-manual-red-flag="isManualRedFlag(drama.book_id)"
              :is-in-cart="isDramaInCart(drama.book_id)"
              @show-image="showDramaImage"
              @copy-name="copyDramaName"
              @sync-to-feishu="syncToFeishu"
              @add-to-cart="handleAddToCart"
              @red-flag-change="handleManualRedFlagChange"
              @download="handleDownload"
            />
          </div>

          <!-- 榜单剧分页器 -->
          <div
            v-if="
              !isSearching &&
              !rankingLoading &&
              rankingList.length > 0 &&
              activeTab === 'ranking' &&
              rankingTotal > rankingPageSize
            "
            class="pagination-container"
          >
            <div class="pagination">
              <button
                @click="goToRankingPage(rankingPageIndex)"
                :disabled="rankingPageIndex <= 0"
                class="pagination-btn prev-btn"
              >
                <Icon icon="mdi:chevron-left" class="btn-icon" />
                <span>上一页</span>
              </button>

              <div class="pagination-pages">
                <button
                  v-for="page in rankingVisiblePages"
                  :key="page"
                  @click="typeof page === 'number' ? goToRankingPage(page - 1) : null"
                  :class="['page-btn', page === rankingPageIndex + 1 ? 'active' : '']"
                  :disabled="typeof page === 'string'"
                >
                  {{ page }}
                </button>
              </div>

              <button
                @click="goToRankingPage(rankingPageIndex + 2)"
                :disabled="rankingPageIndex >= Math.ceil(rankingTotal / rankingPageSize) - 1"
                class="pagination-btn next-btn"
              >
                <span>下一页</span>
                <Icon icon="mdi:chevron-right" class="btn-icon" />
              </button>
            </div>

            <div class="pagination-info">
              <span class="page-info">
                第 {{ rankingPageIndex + 1 }} 页，共
                {{ Math.ceil(rankingTotal / rankingPageSize) }} 页
              </span>
              <span class="total-info"> 共 {{ rankingTotal }} 条记录 </span>
            </div>
          </div>

          <!-- 搜索结果分页器 -->
          <div
            v-if="
              isSearching &&
              !searchLoading &&
              searchResults.length > 0 &&
              searchTotal > searchPageSize
            "
            class="pagination-container"
          >
            <div class="pagination">
              <button
                @click="goToSearchPage(searchCurrentPage - 1)"
                :disabled="searchCurrentPage <= 1"
                class="pagination-btn prev-btn"
              >
                <Icon icon="mdi:chevron-left" class="btn-icon" />
                <span>上一页</span>
              </button>
              <div class="pagination-info">
                <span
                  >第 {{ searchCurrentPage }} 页，共
                  {{ Math.ceil(searchTotal / searchPageSize) }} 页</span
                >
              </div>
              <button
                @click="goToSearchPage(searchCurrentPage + 1)"
                :disabled="searchCurrentPage >= Math.ceil(searchTotal / searchPageSize)"
                class="pagination-btn next-btn"
              >
                <span>下一页</span>
                <Icon icon="mdi:chevron-right" class="btn-icon" />
              </button>
            </div>
          </div>

          <!-- 普通分页器 - 仅在没有搜索且不是榜单剧标签页时显示 -->
          <div
            v-else-if="
              !isSearching &&
              !listSkeletonLoading &&
              paginatedDramas.length > 0 &&
              activeTab !== 'ranking' &&
              (activeTab !== 'new-drama' || selectedDate === 'all')
            "
            class="pagination-container"
          >
            <div class="pagination">
              <button
                @click="goToPage(currentPage - 1)"
                :disabled="currentPage <= 1"
                class="pagination-btn prev-btn"
              >
                <Icon icon="mdi:chevron-left" class="btn-icon" />
                <span>上一页</span>
              </button>

              <div class="pagination-pages">
                <button
                  v-for="page in visiblePages"
                  :key="page"
                  @click="goToPage(page)"
                  :class="['page-btn', page === currentPage ? 'active' : '']"
                >
                  {{ page }}
                </button>
              </div>

              <button
                @click="goToPage(currentPage + 1)"
                :disabled="currentPage >= totalPages"
                class="pagination-btn next-btn"
              >
                <span>下一页</span>
                <Icon icon="mdi:chevron-right" class="btn-icon" />
              </button>
            </div>

            <div class="pagination-info">
              <span class="page-info"> 第 {{ currentPage }} 页，共 {{ totalPages }} 页 </span>
              <span class="total-info"> 共 {{ filteredDramas.length }} 条记录 </span>
            </div>
          </div>

          <!-- 空状态 -->
          <div
            v-else-if="
              !listSkeletonLoading &&
              !rankingLoading &&
              filteredDramas.length === 0 &&
              rankingList.length === 0
            "
            class="empty-state"
          >
            <Icon
              :icon="
                isSearching
                  ? 'mdi:magnify'
                  : activeTab === 'ranking'
                    ? 'mdi:trophy'
                    : 'mdi:calendar-clock'
              "
              class="empty-icon"
            />
            <h3 class="empty-title">
              {{
                isSearching
                  ? '未找到相关短剧'
                  : activeTab === 'ranking'
                    ? '暂无榜单剧数据'
                    : selectedDateLabel + '暂无新剧'
              }}
            </h3>
            <p class="empty-description">
              {{
                isSearching
                  ? '请尝试其他关键词或清空搜索'
                  : activeTab === 'ranking'
                    ? '榜单剧数据正在加载中，请稍后再来查看'
                    : '请关注其他日期或稍后再来查看'
              }}
            </p>
          </div>

          <!-- 复制成功提示 Toast -->
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="transform translate-y-2 opacity-0"
            enter-to-class="transform translate-y-0 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="transform translate-y-0 opacity-100"
            leave-to-class="transform translate-y-2 opacity-0"
          >
            <div v-if="showCopyToast" class="toast">
              <Icon icon="mdi:check-circle" class="toast-icon" />
              <span class="toast-message">{{ copyToastMessage }}</span>
            </div>
          </Transition>
        </div>
      </div>

      <AdxRankingDrawer v-model:show="showAdxDrawer" @search-drama="handleAdxDramaSearch" />
    </div>

    <Teleport to="body">
      <!-- 剧集大图弹窗（需要按视口全局居中，不能受短剧列表滚动容器影响） -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div v-if="showImageModal" class="image-modal-overlay" @click="closeImageModal">
          <div class="image-modal" @click.stop>
            <div class="image-modal-header">
              <h3 class="image-modal-title">
                {{ currentDramaImage?.series_name || '剧集大图' }}
              </h3>
              <button @click="closeImageModal" class="image-modal-close">
                <Icon icon="mdi:close" class="close-icon" />
              </button>
            </div>
            <div class="image-modal-content">
              <div class="image-container">
                <!-- 骨架屏加载效果 -->
                <div v-if="imageLoading" class="image-skeleton">
                  <div class="skeleton-image-large"></div>
                  <div class="skeleton-loading-text">正在加载大图...</div>
                </div>

                <!-- 错误状态 -->
                <div v-else-if="imageError" class="image-error">
                  <Icon icon="mdi:alert-circle" class="error-icon" />
                  <span>{{ imageError }}</span>
                </div>

                <!-- 图片显示 -->
                <div v-else-if="currentDramaImage?.original_thumb_url" class="image-display">
                  <img
                    :src="currentDramaImage.original_thumb_url"
                    :alt="currentDramaImage.series_name"
                    class="image-large image-fade-in"
                    @click="closeImageModal"
                    @error="handleImageError"
                  />
                </div>

                <!-- 空状态 -->
                <div v-else class="image-empty">
                  <Icon icon="mdi:image-off" class="empty-icon" />
                  <span>暂无大图信息</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 日期选择器弹窗 -->
    <DatePicker
      v-model:show="showDatePicker"
      :drama-name="getDramaName(currentClipDrama)"
      :loading="clipProcessingDramaId !== null"
      @confirm="handleDateConfirm"
      @cancel="handleDateCancel"
    />

    <Teleport to="body">
      <!-- 自动提交下载轮询间隔选择弹窗 -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="showAutoSubmitModal"
          class="auto-submit-modal-overlay"
          @click.self="showAutoSubmitModal = false"
        >
          <div class="auto-submit-modal-card" @click.stop>
            <!-- 弹窗标题 -->
            <div class="auto-submit-modal-header">
              <div class="auto-submit-modal-title-row">
                <div class="auto-submit-modal-title-left">
                  <div class="auto-submit-modal-icon-box">
                    <Icon icon="mdi:robot-outline" class="auto-submit-modal-icon" />
                  </div>
                  <div>
                    <h3 class="auto-submit-modal-title">自动提交下载</h3>
                    <p class="auto-submit-modal-subtitle">选择轮询间隔和提交范围</p>
                  </div>
                </div>
                <button @click="showAutoSubmitModal = false" class="auto-submit-modal-close">
                  <Icon icon="mdi:close" class="auto-submit-modal-close-icon" />
                </button>
              </div>
            </div>

            <!-- 弹窗内容 -->
            <div class="auto-submit-modal-body">
              <div class="auto-submit-field">
                <label class="auto-submit-label"> 轮询间隔 </label>
                <NSelect
                  v-model:value="autoSubmitInterval"
                  :options="autoSubmitIntervalOptions"
                  placeholder="请选择轮询间隔"
                  size="large"
                />
              </div>

              <div class="auto-submit-field">
                <label class="auto-submit-label"> 提交时间范围 </label>
                <NSelect
                  v-model:value="autoSubmitRangeDays"
                  :options="autoSubmitRangeOptions"
                  placeholder="请选择提交时间范围"
                  size="large"
                />
              </div>

              <!-- 红标剧筛选配置 -->
              <!-- 提交范围选项 -->
              <div class="auto-submit-field">
                <label class="auto-submit-label">提交范围</label>
                <div class="auto-submit-radio-list">
                  <label class="auto-submit-radio-card" :class="{ active: !autoSubmitOnlyRedFlag }">
                    <input
                      type="radio"
                      :value="false"
                      v-model="autoSubmitOnlyRedFlag"
                      class="mr-3"
                    />
                    <div>
                      <div class="auto-submit-radio-title">提交所有剧</div>
                      <div class="auto-submit-radio-desc">
                        提交所有符合条件的剧集（包含红标、绿标、黄标）
                      </div>
                    </div>
                  </label>
                  <label
                    class="auto-submit-radio-card"
                    :class="{ active: autoSubmitOnlyRedFlag, danger: autoSubmitOnlyRedFlag }"
                  >
                    <input
                      type="radio"
                      :value="true"
                      v-model="autoSubmitOnlyRedFlag"
                      class="mr-3"
                    />
                    <div>
                      <div class="auto-submit-radio-title">只提交红标剧</div>
                      <div class="auto-submit-radio-desc">仅提交红标剧集</div>
                    </div>
                  </label>
                </div>
              </div>

              <div class="auto-submit-help-card">
                <div class="auto-submit-help-content">
                  <Icon icon="mdi:information" class="auto-submit-help-icon" />
                  <div>
                    <p class="auto-submit-help-title">功能说明：</p>
                    <ul class="auto-submit-help-list">
                      <li>{{ autoSubmitRangeDescription }}</li>
                      <li v-if="isAutoSubmitRunOnce">仅执行当前这一轮，完成后自动停止</li>
                      <li v-else>按所选轮询间隔持续执行</li>
                      <li v-if="autoSubmitOnlyRedFlag" class="auto-submit-help-danger">
                        只处理红标剧（含首发 0 点至 1 点自动红标）
                      </li>
                      <li v-else>处理所有符合条件的剧集</li>
                      <li>自动提交符合条件的剧集到待下载流程</li>
                      <li>按日期顺序依次执行</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- 弹窗操作按钮 -->
            <div class="auto-submit-modal-footer">
              <button @click="showAutoSubmitModal = false" class="auto-submit-cancel-button">
                取消
              </button>
              <button
                @click="startAutoSubmit"
                class="auto-submit-confirm-button"
                :disabled="autoSubmitStarting"
              >
                {{ autoSubmitStarting ? '启动中...' : '开始自动提交' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { NInput, NSelect, useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useApiConfigStore } from '@/stores/apiConfig'
import { useDouyinMaterialStore } from '@/stores/douyinMaterial'
import { useSessionStore } from '@/stores/session'
import {
  getNewDramaList,
  getNewDramaFeishuStatus,
  searchNewDramaList,
  getDownloadTaskList,
  getDownloadUrl,
  feishuApi,
} from '@/api'
import { getCurrentSession, reportPageVisit } from '@/api/admin'
import {
  startAutoSubmit as startAutoSubmitApi,
  stopAutoSubmit as stopAutoSubmitApi,
  getAutoSubmitStatus,
  type AutoSubmitStatus,
} from '@/api/autoSubmit'
import { FEISHU_CONFIG } from '@/config/feishu'
import http from '@/api/http'
import type { NewDramaItem, DownloadTask } from '@/api/types'
import type { RuntimeFeishuTableGroup } from '@/api/feishu'
import dayjs from 'dayjs'
import DatePicker from './DatePicker.vue'
import DramaCard from './DramaCard.vue'
import AdxRankingDrawer from './AdxRankingDrawer.vue'
import DramaCart, { type CartItem } from './DramaCart.vue'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// 配置dayjs插件
dayjs.extend(utc)
dayjs.extend(timezone)

// 嵌入模式 prop:为 true 时表示在首页 Tab 内嵌入,隐藏顶部导航,sticky 位置改为 0
defineProps<{
  embedded?: boolean
}>()

// 路由实例
const router = useRouter()

const apiConfigStore = useApiConfigStore()
const douyinMaterialStore = useDouyinMaterialStore()
const sessionStore = useSessionStore()
const currentBrandName = computed(
  () => sessionStore.currentRuntimeUser?.brandName || sessionStore.currentUser?.brandName || '小红'
)
const accountRecycleEnabled = ref(false)
const ALL_FEISHU_TABLE_GROUP_ID = '__all__'
const AUTO_RED_FLAG_START_HOUR = 0
const AUTO_RED_FLAG_END_HOUR = 1

function isAutoRedFlagPublishTime(publishTime?: string) {
  if (!publishTime) return false

  const publishHour = dayjs.tz(publishTime, 'Asia/Shanghai').hour()
  return publishHour >= AUTO_RED_FLAG_START_HOUR && publishHour <= AUTO_RED_FLAG_END_HOUR
}

async function syncCurrentChannelConfig() {
  try {
    const sessionData = await getCurrentSession()
    accountRecycleEnabled.value = Boolean(sessionData?.buildConfig?.recycleAccountsWhenExhausted)
    apiConfigStore.updateFromAuthConfig({
      platforms: sessionData?.platforms,
      feishu: sessionData?.feishu,
      sessionUser: sessionData?.user,
      runtimeUser: sessionData?.runtimeUser ?? undefined,
      activeChannel: sessionData?.channel,
    })
  } catch (error) {
    console.warn('同步当前渠道配置失败，继续使用现有配置:', error)
  }
}

function resetChannelScopedData() {
  searchResults.value = []
  searchTotal.value = 0
  searchCurrentPage.value = 1
  currentPage.value = 1
  dramaList.value = []
  rankingList.value = []
  rankingTotal.value = 0
  rankingPageIndex.value = 0
  rankingListCache.clear()
  downloadList.value = []
  newDramaStatusLoading.value = false
  cartBookIds.value = new Set()
  submittedForDownloadSet.value = new Set()
  submittedForClipSet.value = new Set()
  manualRedFlagSet.value = new Set()
  disabledRedFlagSet.value = new Set()
  syncingDramaSet.clear()
  syncingDramaId.value = null
  isAnyDramaSyncing.value = false
  clipProcessingDramaId.value = null
  showDatePicker.value = false
  currentClipDrama.value = null
  dramaCartRef.value?.resetForScopeChange?.()
}

async function reloadChannelScopedData() {
  resetChannelScopedData()

  const keyword = searchKeyword.value.trim()
  if (keyword) {
    await performSearch(keyword, 1)
    return
  }

  if (activeTab.value === 'ranking') {
    await fetchRankingList()
    return
  }

  await fetchDramaList()
}

// 格式化抖音号素材配置
function formatDouyinMaterialConfig(
  group: RuntimeFeishuTableGroup | null | undefined = activeFeishuTableGroup.value
): string {
  const matches = group?.douyinMaterialMatches || douyinMaterialStore.matches

  if (!matches || matches.length === 0) {
    return ''
  }

  return matches
    .filter(match => match.douyinAccount && match.douyinAccountId && match.materialRange) // 过滤掉不完整的数据
    .map(match => `${match.douyinAccount} ${match.douyinAccountId} ${match.materialRange}`)
    .join('\n')
}

function getDramaListTableId(group: RuntimeFeishuTableGroup | undefined) {
  return (
    group?.feishu?.dramaListTableId ||
    apiConfigStore.config.dramaListTableId ||
    FEISHU_CONFIG.table_ids.drama_list
  )
}

function getDramaStatusTableId(group: RuntimeFeishuTableGroup | undefined) {
  return (
    group?.feishu?.dramaStatusTableId ||
    apiConfigStore.config.dramaStatusTableId ||
    FEISHU_CONFIG.table_ids.drama_status
  )
}

function getAccountTableId(group: RuntimeFeishuTableGroup | undefined) {
  return group?.feishu?.accountTableId || apiConfigStore.config.accountTableId || ''
}

async function dramaExistsInFeishuTableGroup(dramaName: string, group: RuntimeFeishuTableGroup) {
  const result = await feishuApi.searchDramaList(dramaName, getDramaListTableId(group))
  return (result.data?.items || []).some(item => item.fields['剧名']?.[0]?.text === dramaName)
}

async function searchDramaStatusRecordInConfiguredGroups(dramaName: string, timestamp: number) {
  const targetGroups = feishuTableGroups.value.filter(group => group.feishu?.dramaStatusTableId)
  const groups = targetGroups.length ? targetGroups : [activeFeishuTableGroup.value]
  const results = await Promise.all(
    groups
      .filter(Boolean)
      .map(group =>
        feishuApi.searchDramaStatusRecord(dramaName, timestamp, group.feishu?.dramaStatusTableId)
      )
  )

  return results.some(result => (result.data?.items || []).length > 0)
}

// 使用 Naive UI 的 message API
const message = useMessage()

const dramaCartRef = ref<
  (InstanceType<typeof DramaCart> & { resetForScopeChange?: () => void }) | null
>(null)
const cartBookIds = ref<Set<string>>(new Set())

// ===== 请求代际:用于 Tab 切换时丢弃在途请求结果 =====
// 每次 cancelAllListRequests() 会把 generation +1
// 列表/搜索/榜单类请求在响应回来后会检查 generation,若不一致则丢弃结果
let listRequestGeneration = 0
let channelScopedReloadGeneration = 0
function beginListRequest() {
  return listRequestGeneration
}
function isListRequestStale(gen: number) {
  return gen !== listRequestGeneration
}

// 响应式数据
const loading = ref(false)
const error = ref('')
const dramaList = ref<NewDramaItem[]>([])
const downloadList = ref<DownloadTask[]>([])
const listSkeletonLoading = ref(false)
const newDramaStatusLoading = ref(false)
const selectedDate = ref('today')
const showCopyToast = ref(false)
const copyToastMessage = ref('')
const syncingDramaId = ref<string | null>(null)
const isAnyDramaSyncing = ref(false)

// 记录已提交的剧集（仅当前会话有效）
const submittedForDownloadSet = ref<Set<string>>(new Set())
const submittedForClipSet = ref<Set<string>>(new Set())
const manualRedFlagSet = ref<Set<string>>(new Set())
const disabledRedFlagSet = ref<Set<string>>(new Set())

// 增剧对比相关状态
const showingComparedDramas = ref(false)
const forceComparisonChannelMode = ref(false)
const comparedNewDramas = ref<Set<string>>(new Set()) // 存储增剧的book_id

// 将标志暴露到window对象，供HTTP拦截器使用
if (typeof window !== 'undefined') {
  ;(window as any).__forceComparisonChannelMode__ = forceComparisonChannelMode
}

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  window.removeEventListener('resize', updateClipContentPanelMinHeight)
  stopStatusPolling() // 清理服务端状态轮询
})

// 新增：Tab 切换
const activeTab = ref<'new-drama' | 'ranking'>('new-drama')

const fullDramaLoading = ref(false)

// 并发控制：当自动提交运行时，禁用手动操作
const isAnyOperationBlocked = computed(() => {
  return (
    (currentSchedulerStatus.value.running && isAutoSubmitEnabledForCurrentChannel.value) ||
    isAnyDramaSyncing.value
  )
})

const feishuTableGroups = computed<RuntimeFeishuTableGroup[]>(() => {
  const groups = Array.isArray(apiConfigStore.config.feishuTableGroups)
    ? apiConfigStore.config.feishuTableGroups
    : []

  if (groups.length > 0) {
    return groups
      .map((group, index) => ({
        id: String(group.id || (index === 0 ? 'default' : `group-${index + 1}`)),
        name: String(group.name || (index === 0 ? '默认表格' : `表格组 ${index + 1}`)),
        enabled: group.enabled !== false,
        feishu: group.feishu || {},
        douyinMaterialMatches: Array.isArray(group.douyinMaterialMatches)
          ? group.douyinMaterialMatches
          : [],
      }))
      .filter(group => group.enabled)
  }

  return [
    {
      id: 'default',
      name: '默认表格',
      enabled: true,
      feishu: {
        dramaListTableId:
          apiConfigStore.config.dramaListTableId || FEISHU_CONFIG.table_ids.drama_list,
        dramaStatusTableId:
          apiConfigStore.config.dramaStatusTableId || FEISHU_CONFIG.table_ids.drama_status,
        accountTableId: apiConfigStore.config.accountTableId || '',
      },
      douyinMaterialMatches: douyinMaterialStore.matches,
    },
  ]
})
const selectedFeishuTableGroupId = ref('')
const activeFeishuTableGroup = computed(() => {
  return (
    feishuTableGroups.value.find(group => group.id === selectedFeishuTableGroupId.value) ||
    feishuTableGroups.value[0]
  )
})
const hasMultipleFeishuTableGroups = computed(() => feishuTableGroups.value.length > 1)
const feishuTableGroupOptions = computed(() => [
  ...(hasMultipleFeishuTableGroups.value
    ? [
        {
          label: '所有表格',
          value: ALL_FEISHU_TABLE_GROUP_ID,
        },
      ]
    : []),
  ...feishuTableGroups.value.map(group => ({
    label: group.name,
    value: group.id,
  })),
])
const currentDramaListTableId = computed(
  () =>
    activeFeishuTableGroup.value?.feishu?.dramaListTableId ||
    apiConfigStore.config.dramaListTableId ||
    FEISHU_CONFIG.table_ids.drama_list
)
const currentDramaStatusTableId = computed(
  () =>
    activeFeishuTableGroup.value?.feishu?.dramaStatusTableId ||
    apiConfigStore.config.dramaStatusTableId ||
    FEISHU_CONFIG.table_ids.drama_status
)
const currentAccountTableId = computed(
  () =>
    activeFeishuTableGroup.value?.feishu?.accountTableId ||
    apiConfigStore.config.accountTableId ||
    ''
)
const currentChannelStateScopeKey = computed(() =>
  [
    sessionStore.selectedChannelId ||
      sessionStore.activeChannelId ||
      apiConfigStore.config.channelId,
    getSelectedFeishuTableGroupId(),
    currentDramaListTableId.value,
    currentDramaStatusTableId.value,
    currentAccountTableId.value,
  ]
    .map(value => String(value || ''))
    .join('|')
)

function getChannelScopedBookKey(bookId: string, scopeKey = currentChannelStateScopeKey.value) {
  return `${scopeKey}:${bookId}`
}

watch(
  feishuTableGroups,
  groups => {
    if (!groups.length) {
      selectedFeishuTableGroupId.value = ''
      return
    }

    if (selectedFeishuTableGroupId.value === ALL_FEISHU_TABLE_GROUP_ID && groups.length > 1) {
      return
    }

    if (!groups.some(group => group.id === selectedFeishuTableGroupId.value)) {
      selectedFeishuTableGroupId.value =
        groups.length > 1 ? ALL_FEISHU_TABLE_GROUP_ID : groups[0].id
    }
  },
  { immediate: true }
)

function isAllFeishuTableGroupsSelected() {
  return selectedFeishuTableGroupId.value === ALL_FEISHU_TABLE_GROUP_ID
}

function getSelectedFeishuTableGroupId() {
  return isAllFeishuTableGroupsSelected()
    ? ALL_FEISHU_TABLE_GROUP_ID
    : activeFeishuTableGroup.value?.id || ''
}

function getSelectedFeishuTableGroupName() {
  return isAllFeishuTableGroupsSelected() ? '所有表格' : activeFeishuTableGroup.value?.name || ''
}

function getTargetFeishuTableGroupsForDownload() {
  if (isAllFeishuTableGroupsSelected()) {
    return feishuTableGroups.value
  }

  return activeFeishuTableGroup.value ? [activeFeishuTableGroup.value] : []
}

watch(selectedFeishuTableGroupId, () => {
  if (selectedFeishuTableGroupId.value) {
    void reloadChannelScopedData()
  }
})

function updateClipContentPanelMinHeight() {
  if (typeof window === 'undefined' || !showAdxDrawer.value) {
    clipContentPanelMinHeight.value = 0
    return
  }

  const mainContent = clipMainContentRef.value
  if (!mainContent) return

  const panel = mainContent.querySelector('.new-drama-preview, .drama-list, .empty-state')
  if (!panel) return

  const panelTop = Math.max(0, panel.getBoundingClientRect().top)
  const footer = document.querySelector('footer')
  const footerTop = footer?.getBoundingClientRect().top ?? window.innerHeight
  const bottomLimit = Math.min(window.innerHeight, footerTop)
  const bottomGap = 16

  clipContentPanelMinHeight.value = Math.max(0, Math.floor(bottomLimit - panelTop - bottomGap))
}

// 新增：排行榜相关数据
// 排行榜数据类型定义
interface RankingDramaItem {
  book_id: string
  book_name: string
  series_name?: string
  category?: string
  category_text?: string
  category_tags?: string[]
  original_thumb_url: string
  episode_amount?: number
  publish_time?: string
  feishu_downloaded?: boolean
  feishu_exists?: boolean
  [key: string]: unknown
}

const rankingList = ref<RankingDramaItem[]>([])
const rankingLoading = ref(false)
const rankingError = ref('')
const rankingDownloadList = ref<DownloadTask[]>([])
interface RankingListCacheEntry {
  list: RankingDramaItem[]
  total: number
  downloadList: DownloadTask[]
}
const rankingListCache = new Map<string, RankingListCacheEntry>()

// 榜单剧分页相关状态
const rankingPageIndex = ref(0)
const rankingPageSize = ref(10)
const rankingTotal = ref(0)

// 收入评级筛选状态
const selectedIncomeLevel = ref('all')

// 新增待剪辑相关状态
const showDatePicker = ref(false)
const currentClipDrama = ref<NewDramaItem | null>(null)
const clipProcessingDramaId = ref<string | null>(null)

// 搜索和分页相关
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10) // 每页显示10条记录

// 搜索相关状态
const searchResults = ref<NewDramaItem[]>([])
const searchLoading = ref(false)
const searchTotal = ref(0)
const searchCurrentPage = ref(1)
const searchPageSize = ref(10)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const downloadTriggeredSet = ref<Set<string>>(new Set())

// 自动提交下载相关状态
const createDefaultAutoSubmitStatus = (): AutoSubmitStatus => ({
  channelId: '',
  channelName: '',
  enabled: false,
  running: false,
  intervalMinutes: 5,
  onlyRedFlag: false,
  runOnce: false,
  submitRangeDays: 3,
  feishuTableGroupId: '',
  nextRunTime: null,
  lastRunTime: null,
  stats: { totalProcessed: 0, successCount: 0, failCount: 0, skipCount: 0 },
  progress: { current: 0, total: 0, currentDate: '', currentDrama: '' },
  taskHistory: [],
})
const autoSubmitStatus = ref<AutoSubmitStatus>(createDefaultAutoSubmitStatus())
const autoSubmitTimer = ref<number | null>(null) // 定时器ID
const autoSubmitCountdownTimer = ref<number | null>(null) // 倒计时定时器ID
type AutoSubmitIntervalOptionValue = number | 'once'
const autoSubmitInterval = ref<AutoSubmitIntervalOptionValue>(20) // 轮询间隔（分钟）
const autoSubmitCountdown = ref(0) // 倒计时（秒）
const showAutoSubmitModal = ref(false) // 是否显示时间选择弹窗
const autoSubmitStarting = ref(false)
const showAdxDrawer = ref(false)
const clipMainContentRef = ref<HTMLElement | null>(null)
const clipContentPanelMinHeight = ref(0)
const autoSubmitOnlyRedFlag = ref(false) // 是否只提交红标剧，默认false（提交所有剧）
const autoSubmitRangeDays = ref<1 | 2 | 3>(3)

const ENABLE_FETCH_ALL_NEW_DRAMA = false
const DEFAULT_NEW_DRAMA_PAGE_COUNT = 2
const FULL_NEW_DRAMA_PAGE_COUNT = 20
const NEW_DRAMA_PAGE_SIZE = 100
const FULL_NEW_DRAMA_PAGE_DELAY_MS = 300

// 当前渠道调度状态
const currentSchedulerStatus = computed(() => {
  return autoSubmitStatus.value || createDefaultAutoSubmitStatus()
})

const isAutoSubmitRunOnce = computed(() => autoSubmitInterval.value === 'once')

const autoSubmitRangeDescription = computed(() => {
  switch (autoSubmitRangeDays.value) {
    case 1:
      return '仅提交下载当天的剧集'
    case 2:
      return '提交下载今天和明天的剧集'
    default:
      return '提交下载今天、明天、后天的剧集'
  }
})

// 判断当前渠道是否启用了自动提交
const isAutoSubmitEnabledForCurrentChannel = computed(() => {
  return currentSchedulerStatus.value.enabled
})

// 图片弹窗相关状态
const showImageModal = ref(false)
const imageLoading = ref(false)
const imageError = ref('')
const currentDramaImage = ref<NewDramaItem | null>(null)

// 动态计算日期选项（每次访问时都获取最新的日期，使用北京时间）
const dateOptions = computed(() => {
  // 每次调用时重新计算当前日期
  const today = dayjs().tz('Asia/Shanghai')
  const tomorrow = today.add(1, 'day')
  const dayAfterTomorrow = today.add(2, 'day')

  return [
    {
      value: 'today',
      label: '今天',
      date: formatDate(today),
    },
    {
      value: 'tomorrow',
      label: '明天',
      date: formatDate(tomorrow),
    },
    {
      value: 'day-after-tomorrow',
      label: '后天',
      date: formatDate(dayAfterTomorrow),
    },
  ]
})

// 自动提交下载轮询时间选项
const autoSubmitIntervalOptions = [
  { label: '仅执行一次', value: 'once' },
  { label: '20 分钟', value: 20 },
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
  { label: '2 小时', value: 120 },
]

const autoSubmitRangeOptions = [
  { label: '近1天', value: 1 },
  { label: '近2天', value: 2 },
  { label: '近3天', value: 3 },
]

// 收入评级选项
const incomeLevelOptions = [
  {
    value: 'all',
    label: '全部',
    icon: 'mdi:view-list',
    incomeLevel: null,
  },
  {
    value: 's-plus',
    label: 'S+',
    icon: 'mdi:star',
    incomeLevel: 4,
  },
  {
    value: 's',
    label: 'S',
    icon: 'mdi:star-outline',
    incomeLevel: 3,
  },
  {
    value: 'a',
    label: 'A',
    icon: 'mdi:circle',
    incomeLevel: 2,
  },
  {
    value: 'b',
    label: 'B',
    icon: 'mdi:circle-outline',
    incomeLevel: 1,
  },
  {
    value: 'c',
    label: 'C',
    icon: 'mdi:minus',
    incomeLevel: 0,
  },
]

// 计算属性
const selectedDateLabel = computed(() => {
  const option = dateOptions.value.find(opt => opt.value === selectedDate.value)
  return option?.label || '今天'
})

const currentDateDramas = computed(() => {
  const option = dateOptions.value.find(opt => opt.value === selectedDate.value)
  if (!option) return []

  // 具体日期：今天、明天、后天
  const filteredDramas = dramaList.value.filter(drama => {
    const publishDate = drama.publish_time.split(' ')[0]
    return publishDate === option.date
  })

  // 按首发时间排序，越早的排在越前面（使用北京时间）
  return filteredDramas.sort((a, b) => {
    const timeA = dayjs.tz(a.publish_time, 'Asia/Shanghai').valueOf()
    const timeB = dayjs.tz(b.publish_time, 'Asia/Shanghai').valueOf()
    return timeA - timeB
  })
})

function canAddDownloadDrama(drama: NewDramaItem | RankingDramaItem) {
  return !drama.feishu_downloaded && !drama.feishu_exists && !isSubmittedForDownload(drama.book_id)
}

function buildCartItem(drama: NewDramaItem | RankingDramaItem): CartItem {
  return {
    book_id: drama.book_id,
    series_name: (drama as any).series_name || (drama as any).book_name || '未知剧名',
    publish_time: drama.publish_time || '',
    manualRedFlag: isManualRedFlag(drama.book_id),
    autoRedFlag: isRedFlagDrama(drama) && !isManualRedFlag(drama.book_id),
    fromSearchResult: searchKeyword.value.trim().length > 0,
    feishuTableGroupId: getSelectedFeishuTableGroupId(),
    feishuTableGroupName: getSelectedFeishuTableGroupName(),
  }
}

const currentDateAddableDramas = computed(() =>
  newDramaStatusLoading.value
    ? []
    : currentDateDramas.value.filter(drama => canAddDownloadDrama(drama))
)

const currentDateAddableNotInCartCount = computed(
  () => currentDateAddableDramas.value.filter(drama => !cartBookIds.value.has(drama.book_id)).length
)

const bulkCartButtonTitle = computed(() => {
  if (newDramaStatusLoading.value) {
    return `${selectedDateLabel.value}状态加载中`
  }

  if (currentDateAddableDramas.value.length === 0) {
    return `${selectedDateLabel.value}暂无可加入购物车的剧`
  }

  if (currentDateAddableNotInCartCount.value === 0) {
    return `${selectedDateLabel.value}可加入的剧已全部在购物车中`
  }

  return `将${selectedDateLabel.value}${currentDateAddableNotInCartCount.value}部可新增待下载剧加入购物车`
})

// 是否正在搜索
const isSearching = computed(() => searchKeyword.value.trim().length > 0)

// 过滤后的短剧列表（包含搜索过滤）
const filteredDramas = computed(() => {
  // 如果有搜索关键词，返回搜索结果
  if (isSearching.value) {
    return searchResults.value
  }

  // 没有搜索关键词时，返回当前日期tab下的短剧
  const dramas = currentDateDramas.value

  if (newDramaStatusLoading.value) {
    return dramas
  }

  // 判断是否可以新增待下载
  // 判断下载状态是否为完成
  const isDownloadCompleted = (drama: NewDramaItem) => {
    const downloadData = getDownloadDataForDrama(drama.series_name)
    return downloadData?.task_status === 2
  }

  // 如果有增剧数据，将增剧置顶，并对非增剧进行三级排序
  if (comparedNewDramas.value.size > 0) {
    const newDramas = dramas.filter(d => comparedNewDramas.value.has(d.book_id))
    const otherDramas = dramas.filter(d => !comparedNewDramas.value.has(d.book_id))

    // 对非增剧进行三级排序：
    // 1. 可新增待下载 + 下载完成
    // 2. 可新增待下载 + 下载未完成
    // 3. 不可新增待下载
    const dramasWithAddAndCompleted = otherDramas.filter(
      d => canAddDownloadDrama(d) && isDownloadCompleted(d)
    )
    const dramasWithAddButNotCompleted = otherDramas.filter(
      d => canAddDownloadDrama(d) && !isDownloadCompleted(d)
    )
    const dramasWithoutAddButton = otherDramas.filter(d => !canAddDownloadDrama(d))

    return [
      ...newDramas,
      ...dramasWithAddAndCompleted,
      ...dramasWithAddButNotCompleted,
      ...dramasWithoutAddButton,
    ]
  }

  // 没有增剧时，也对列表进行三级排序
  const dramasWithAddAndCompleted = dramas.filter(
    d => canAddDownloadDrama(d) && isDownloadCompleted(d)
  )
  const dramasWithAddButNotCompleted = dramas.filter(
    d => canAddDownloadDrama(d) && !isDownloadCompleted(d)
  )
  const dramasWithoutAddButton = dramas.filter(d => !canAddDownloadDrama(d))

  return [...dramasWithAddAndCompleted, ...dramasWithAddButNotCompleted, ...dramasWithoutAddButton]
})

// 分页后的短剧列表
const paginatedDramas = computed(() => {
  // 搜索态使用搜索结果
  if (isSearching.value) {
    return searchResults.value
  }

  // 分日tab下不分页，显示所有短剧
  if (activeTab.value === 'new-drama' && selectedDate.value !== 'all') {
    return filteredDramas.value
  }

  // 正常分页逻辑（全部tab）
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredDramas.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  // 搜索态使用搜索总页数
  if (isSearching.value) {
    return Math.ceil(searchTotal.value / searchPageSize.value)
  }

  return Math.ceil(filteredDramas.value.length / pageSize.value)
})

// 可见的页码
const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    // 如果总页数不超过7页，显示所有页码
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // 如果总页数超过7页，显示省略号
    if (current <= 4) {
      // 当前页在前4页
      for (let i = 1; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      // 当前页在后4页
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) {
        pages.push(i)
      }
    } else {
      // 当前页在中间
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    }
  }

  return pages
})

// 工具函数
function formatDate(date: dayjs.Dayjs): string {
  // 使用北京时间
  return date.format('YYYY-MM-DD')
}

// 获取当前日期范围（实时计算，使用北京时间）
function getCurrentDateRange(): string[] {
  const today = dayjs().tz('Asia/Shanghai')
  const tomorrow = today.add(1, 'day')
  const dayAfterTomorrow = today.add(2, 'day')

  return [
    today.format('YYYY-MM-DD'), // 今天
    tomorrow.format('YYYY-MM-DD'), // 明天
    dayAfterTomorrow.format('YYYY-MM-DD'), // 后天
  ]
}

function getDateDramaCount(dateValue: string): number {
  // 使用动态计算的日期选项
  const option = dateOptions.value.find(opt => opt.value === dateValue)
  if (!option) return 0

  // 具体日期：今天、明天、后天
  return dramaList.value.filter(drama => {
    const publishDate = drama.publish_time.split(' ')[0]
    return publishDate === option.date
  }).length
}

function getDateIcon(dateValue: string): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfterTomorrow = new Date(today)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0]

  if (dateValue === 'today' || dateValue === todayStr) return 'mdi:calendar-today'
  if (dateValue === 'tomorrow' || dateValue === tomorrowStr) return 'mdi:calendar-clock'
  if (dateValue === 'day-after-tomorrow' || dateValue === dayAfterTomorrowStr)
    return 'mdi:calendar-plus'
  return 'mdi:calendar'
}

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement
  target.src = '/placeholder-cover.svg' // 设置默认封面
}

// 显示成功提示
function showSuccessToast(message: string, duration = 3000) {
  copyToastMessage.value = message
  showCopyToast.value = true

  // 3秒后自动隐藏提示
  setTimeout(() => {
    showCopyToast.value = false
  }, duration)
}

// 复制剧名功能
async function copyDramaName(dramaName: string) {
  try {
    await navigator.clipboard.writeText(dramaName)
    showSuccessToast(`已复制剧名: ${dramaName}`)
  } catch (err) {
    console.error('复制失败:', err)
    // 降级方案：使用传统的复制方法
    const textArea = document.createElement('textarea')
    textArea.value = dramaName
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      showSuccessToast(`已复制剧名: ${dramaName}`)
    } catch (fallbackErr) {
      console.error('降级复制也失败:', fallbackErr)
      showSuccessToast('复制失败，请手动复制')
    }
    document.body.removeChild(textArea)
  }
}

// 检查剧集是否已下载
function isDramaDownloaded(dramaName: string): boolean {
  // 检查飞书剧集清单中的下载状态
  const drama = dramaList.value.find(d => d.series_name === dramaName)
  return drama?.feishu_downloaded === true
}

// 下载处理函数
async function handleDownload(
  downloadData: DownloadTask,
  options: { silent?: boolean } = {}
): Promise<boolean> {
  const silent = options.silent === true
  const downloadKey =
    downloadData.book_name?.trim() || downloadData.task_name?.trim() || downloadData.task_id

  // 检查是否有可用下载参数
  if (!downloadData.imagex_uri && !downloadData.download_url) {
    if (!silent) {
      copyToastMessage.value = '该任务没有可用的下载地址'
      showCopyToast.value = true
      setTimeout(() => {
        showCopyToast.value = false
      }, 3000)
    } else {
      console.warn('下载跳过：缺少下载地址', downloadData)
    }
    return false
  }

  try {
    if (downloadKey) {
      markDownloadTriggered(downloadKey)
    }
    const dramaName = downloadData.book_name || downloadData.task_name || '未知剧名'

    // 显示下载开始提示
    if (!silent) {
      copyToastMessage.value = `准备下载：${dramaName}`
      showCopyToast.value = true
    }

    // 前端直接触发下载（优先直链），避免后端代理
    const baseName = downloadData.book_name?.trim() || downloadData.task_name || '下载文件'
    const fileName = /\.zip$/i.test(baseName) ? baseName : `${baseName}.zip`

    let directUrl = downloadData.download_url || ''
    if (!directUrl && downloadData.imagex_uri) {
      try {
        const urlResp = await getDownloadUrl(downloadData.imagex_uri)
        if (urlResp.code === 0 && urlResp.download_url) {
          directUrl = urlResp.download_url
        }
      } catch (error) {
        console.warn('获取下载直链失败', error)
      }
    }

    if (!directUrl) {
      throw new Error('无可用下载链接')
    }

    const link = document.createElement('a')
    link.href = directUrl
    link.download = fileName
    link.target = '_self'
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    requestAnimationFrame(() => {
      link.click()
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link)
        }
      }, 0)
    })
    const downloaded = true

    // 显示成功提示
    if (!silent) {
      copyToastMessage.value = downloaded ? `下载已开始：${dramaName}` : `下载已触发：${dramaName}`
      setTimeout(() => {
        showCopyToast.value = false
      }, 3000)
    }
    return downloaded
  } catch (err) {
    console.error('下载失败:', err)
    if (downloadKey) {
      clearDownloadTriggered(downloadKey)
    }
    if (!silent) {
      copyToastMessage.value = `下载失败：${downloadData.book_name || '未知剧名'}`
      setTimeout(() => {
        showCopyToast.value = false
      }, 3000)
    }
    return false
  }
}

// 查看剧集大图功能（直接使用短剧列表返回的 original_thumb_url）
function showDramaImage(drama: NewDramaItem) {
  showImageModal.value = true
  imageLoading.value = true
  imageError.value = ''
  currentDramaImage.value = null

  if (drama.original_thumb_url) {
    // 预加载图片，确保图片加载完成后再显示
    const img = new Image()
    img.onload = () => {
      currentDramaImage.value = drama
      imageLoading.value = false
    }
    img.onerror = () => {
      imageError.value = '图片加载失败'
      imageLoading.value = false
    }
    img.src = drama.original_thumb_url
  } else {
    imageError.value = '暂无大图信息'
    imageLoading.value = false
  }
}

// 关闭图片弹窗
function closeImageModal() {
  showImageModal.value = false
  currentDramaImage.value = null
  imageError.value = ''
}

// 同步到飞书功能
// 防止重复调用的锁
const syncingDramaSet = new Set<string>()

function getManualRedFlagScopeKey() {
  return currentChannelStateScopeKey.value
}

function getManualRedFlagKey(bookId: string) {
  return `${getManualRedFlagScopeKey()}:${bookId}`
}

function isManualRedFlag(bookId: string) {
  return manualRedFlagSet.value.has(getManualRedFlagKey(bookId))
}

function isDisabledRedFlag(bookId: string) {
  return disabledRedFlagSet.value.has(getManualRedFlagKey(bookId))
}

function isRedFlagDrama(drama: NewDramaItem | RankingDramaItem) {
  if (isDisabledRedFlag(drama.book_id)) {
    return false
  }

  return (
    isManualRedFlag(drama.book_id) ||
    (drama as any).auto_red_flag === true ||
    comparedNewDramas.value.has(drama.book_id) ||
    isAutoRedFlagPublishTime(drama.publish_time)
  )
}

function isSubmittedForDownload(bookId: string) {
  return submittedForDownloadSet.value.has(getChannelScopedBookKey(bookId))
}

function isSubmittedForClip(bookId: string) {
  return submittedForClipSet.value.has(getChannelScopedBookKey(bookId))
}

function isDramaInCart(bookId: string) {
  return cartBookIds.value.has(bookId)
}

function handleCartItemsChanged(bookIds: string[]) {
  cartBookIds.value = new Set(bookIds)
}

function handleManualRedFlagChange(payload: {
  drama: NewDramaItem | RankingDramaItem
  value: boolean
}) {
  const { drama, value } = payload
  const key = getManualRedFlagKey(drama.book_id)
  const nextManual = new Set(manualRedFlagSet.value)
  const nextDisabled = new Set(disabledRedFlagSet.value)

  if (value) {
    nextManual.add(key)
    nextDisabled.delete(key)
  } else {
    nextManual.delete(key)
    nextDisabled.add(key)
  }

  manualRedFlagSet.value = nextManual
  disabledRedFlagSet.value = nextDisabled
  dramaCartRef.value?.updateItemRedFlag?.(
    drama.book_id,
    isManualRedFlag(drama.book_id),
    isRedFlagDrama(drama) && !isManualRedFlag(drama.book_id)
  )
}

// 添加到购物车
function handleAddToCart(payload: {
  drama: NewDramaItem | RankingDramaItem
  sourceElement: HTMLElement
}) {
  const { drama } = payload

  if (!canAddDownloadDrama(drama)) {
    message.info('该剧已提交待下载，无需重复加入')
    return
  }

  if (!dramaCartRef.value) {
    message.error('购物车组件未加载')
    return
  }

  // 添加到购物车（带动画）
  dramaCartRef.value.addItem(buildCartItem(drama))
}

function handleAddCurrentDateToCart() {
  if (newDramaStatusLoading.value) {
    message.info('新剧状态还在加载中，请稍后再加入购物车')
    return
  }

  if (!dramaCartRef.value) {
    message.error('购物车组件未加载')
    return
  }

  const targetDramas = currentDateAddableDramas.value.filter(
    drama => !cartBookIds.value.has(drama.book_id)
  )

  if (targetDramas.length === 0) {
    message.info(bulkCartButtonTitle.value)
    return
  }

  dramaCartRef.value.addItems(targetDramas.map(buildCartItem))
}

// 处理批量提交完成
function handleBatchSubmitted(bookIds: string[], scopeKey: string) {
  if (scopeKey && scopeKey !== currentChannelStateScopeKey.value) {
    return
  }

  const targetScopeKey = scopeKey || currentChannelStateScopeKey.value

  // 将所有提交的剧集标记为"已提交下载"
  bookIds.forEach(bookId => {
    submittedForDownloadSet.value.add(getChannelScopedBookKey(bookId, targetScopeKey))
  })
  console.log(`[批量提交] 已标记 ${bookIds.length} 部剧集为"已提交下载"`)
}

async function syncToFeishu(payload: { drama: NewDramaItem | RankingDramaItem }) {
  const { drama } = payload

  // 防止重复调用：使用剧集ID作为锁
  const dramaId = drama.book_id
  if (syncingDramaSet.has(dramaId)) {
    console.log('该剧集正在同步中，跳过重复调用')
    return
  }

  syncingDramaSet.add(dramaId)

  try {
    if (drama.feishu_downloaded) {
      await handleAddClip(drama)
      return
    }

    // 判断是否为红标剧，包含手动红标和首发时间 0 点至 1 点的自动红标。
    const isRedFlag = isRedFlagDrama(drama) ? true : undefined
    await handleAddDownload(drama, {
      overrideIsRedFlag: isRedFlag,
      manualRedFlag: isManualRedFlag(drama.book_id),
      fromSearchResult: searchKeyword.value.trim().length > 0,
    })
  } finally {
    // 清除锁
    syncingDramaSet.delete(dramaId)
  }
}

// 获取剧集名称的辅助函数
function getDramaName(drama: NewDramaItem | RankingDramaItem | null): string {
  if (!drama) return ''

  // 如果是排行榜数据，使用book_name字段
  if ('book_name' in drama && drama.book_name) {
    return drama.book_name
  }

  // 如果是新剧数据，使用series_name字段
  if ('series_name' in drama && drama.series_name) {
    return drama.series_name
  }

  return ''
}

// 处理新增待剪辑流程
async function handleAddClip(drama: NewDramaItem | RankingDramaItem) {
  // 设置当前剪辑的剧集
  currentClipDrama.value = drama as NewDramaItem
  showDatePicker.value = true
}

// 处理日期选择确认
async function handleDateConfirm(selectedDate: string) {
  if (!currentClipDrama.value || !selectedDate) {
    return
  }

  try {
    // 设置处理状态
    clipProcessingDramaId.value = currentClipDrama.value.book_id
    const operationScopeKey = currentChannelStateScopeKey.value

    // 将选择的日期转换为时间戳
    const date = new Date(selectedDate)
    const timestamp = date.getTime()

    // 获取剧名，兼容排行榜和新剧列表数据
    const dramaName =
      (currentClipDrama.value as any).book_name || (currentClipDrama.value as any).series_name

    // 查询剧集状态表，检查该日期是否已存在该剧集
    const alreadyExists = await searchDramaStatusRecordInConfiguredGroups(dramaName, timestamp)

    if (alreadyExists) {
      // 已存在记录，提示并中断流程
      showSuccessToast(`剧集"${dramaName}"在${selectedDate}已有记录，无需重复添加`)
    } else {
      // 不存在记录，直接检查账户并创建剪辑记录
      try {
        // 检查是否有可用账户
        const hasAvailableAccount = await feishuApi.checkAvailableChannelAccounts(
          currentAccountTableId.value,
          accountRecycleEnabled.value
        )
        if (!hasAvailableAccount) {
          showSuccessToast('无可用账户，请联系管理员')
          return // 中断后续流程
        }

        // 确定评级：新增待剪辑只写入状态表，不需要写评级字段
        const ratingValue = undefined

        // 获取可用账户
        const availableAccount = await feishuApi.getAvailableChannelAccount(
          currentAccountTableId.value,
          accountRecycleEnabled.value
        )

        if (!availableAccount) {
          showSuccessToast('无可用账户，请联系管理员')
          return
        }

        const finalAccountId = availableAccount.account
        const finalRecordId = availableAccount.recordId

        if (finalAccountId && finalRecordId) {
          const douyinMaterial = formatDouyinMaterialConfig()

          const clipStatus = '待下载'

          // 创建剪辑记录，包含剧名、上架时间和账户
          await feishuApi.createClipRecord(
            dramaName,
            timestamp,
            finalAccountId,
            currentClipDrama.value.publish_time || '',
            douyinMaterial || undefined, // 如果为空字符串则传 undefined
            ratingValue,
            clipStatus,
            currentDramaStatusTableId.value
          )

          await feishuApi.updateChannelAccountUsedStatus(finalRecordId, currentAccountTableId.value)

          showSuccessToast(
            `剧集"${dramaName}"已成功添加到${selectedDate}的剪辑计划中，分配账户：${finalAccountId}`
          )

          // 标记为已提交待剪辑
          if (currentClipDrama.value) {
            if (operationScopeKey === currentChannelStateScopeKey.value) {
              submittedForClipSet.value.add(
                getChannelScopedBookKey(currentClipDrama.value.book_id, operationScopeKey)
              )
            }
          }
        } else {
          // 没有可用账户，终止流程
          showSuccessToast('无可用账户，请联系管理员')
          return
        }
      } catch (accountError) {
        console.error('分配账户失败:', accountError)
        // 分配账户失败，终止流程
        const errorMessage = accountError instanceof Error ? accountError.message : '未知错误'
        showSuccessToast(`分配账户失败：${errorMessage}`)
        return
      }
    }
  } catch (error) {
    console.error('处理剪辑记录失败:', error)
    const dramaName =
      (currentClipDrama.value as any)?.book_name || (currentClipDrama.value as any)?.series_name
    showSuccessToast(`处理剪辑记录失败：${dramaName}`)
  } finally {
    // 清理状态
    clipProcessingDramaId.value = null
    showDatePicker.value = false
    currentClipDrama.value = null
  }
}

// 取消日期选择
function handleDateCancel() {
  showDatePicker.value = false
  currentClipDrama.value = null
}

// ==================== 自动提交下载功能 ====================

// 状态轮询定时器
let statusPollingTimer: number | null = null

async function startAutoSubmit() {
  if (currentSchedulerStatus.value.enabled) {
    message.warning('当前渠道的自动提交已在运行中')
    return
  }

  if (autoSubmitStarting.value) {
    return
  }

  try {
    autoSubmitStarting.value = true
    const runOnce = autoSubmitInterval.value === 'once'
    const intervalMinutes =
      typeof autoSubmitInterval.value === 'number' ? autoSubmitInterval.value : 0

    console.log(
      `启动服务端自动提交下载，轮询间隔: ${runOnce ? '仅执行一次' : `${intervalMinutes} 分钟`}，提交范围: 近${autoSubmitRangeDays.value}天，渠道: ${sessionStore.activeChannelId}`
    )

    const result = await startAutoSubmitApi({
      intervalMinutes,
      onlyRedFlag: autoSubmitOnlyRedFlag.value,
      runOnce,
      submitRangeDays: autoSubmitRangeDays.value,
      feishuTableGroupId: getSelectedFeishuTableGroupId(),
    })

    if (result.code === 0) {
      showAutoSubmitModal.value = false
      const startedStatus = {
        ...(result.data || currentSchedulerStatus.value),
        enabled: true,
        running: true,
        intervalMinutes: runOnce ? null : intervalMinutes,
        onlyRedFlag: autoSubmitOnlyRedFlag.value,
        runOnce,
        submitRangeDays: autoSubmitRangeDays.value,
        feishuTableGroupId: getSelectedFeishuTableGroupId(),
        nextRunTime: result.data?.nextRunTime || null,
        progress: result.data?.progress?.currentDate
          ? result.data.progress
          : { current: 0, total: 0, currentDate: '筛选候选', currentDrama: '' },
      }
      if (result.data) {
        autoSubmitStatus.value = startedStatus
      } else {
        autoSubmitStatus.value = startedStatus
      }
      message.success(runOnce ? '已开始执行本次自动提交' : '自动提交已启动（服务端运行）')
      if (currentSchedulerStatus.value.enabled) {
        startStatusPolling()
      } else {
        stopStatusPolling()
      }
    } else {
      message.error(result.message || '启动失败')
    }
  } catch (error) {
    console.error('启动自动提交失败:', error)
    message.error('启动自动提交失败')
  } finally {
    autoSubmitStarting.value = false
  }
}

// 停止自动提交（调用服务端API）
async function stopAutoSubmit() {
  console.log('停止服务端自动提交下载')

  try {
    const result = await stopAutoSubmitApi()

    if (result.code === 0) {
      message.success('自动提交已停止')
      // 更新本地状态
      if (result.data) {
        autoSubmitStatus.value = result.data
      }
    } else {
      message.warning(result.message || '停止可能未成功')
    }
  } catch (error) {
    console.error('停止自动提交失败:', error)
  }

  // 无论成功失败，都清理本地状态
  autoSubmitCountdown.value = 0

  // 停止状态轮询
  stopStatusPolling()

  if (autoSubmitTimer.value) {
    clearTimeout(autoSubmitTimer.value)
    autoSubmitTimer.value = null
  }

  if (autoSubmitCountdownTimer.value) {
    clearInterval(autoSubmitCountdownTimer.value)
    autoSubmitCountdownTimer.value = null
  }
}

// 开始轮询服务端状态
function startStatusPolling() {
  stopStatusPolling() // 先清理
  fetchAutoSubmitStatusFromServer() // 立即获取一次
  statusPollingTimer = window.setInterval(fetchAutoSubmitStatusFromServer, 5000) // 每5秒轮询
}

// 停止轮询服务端状态
function stopStatusPolling() {
  if (statusPollingTimer) {
    clearInterval(statusPollingTimer)
    statusPollingTimer = null
  }
}

// 从服务端获取状态并更新本地
async function fetchAutoSubmitStatusFromServer() {
  try {
    const result = await getAutoSubmitStatus()
    if (result.code === 0 && result.data) {
      autoSubmitStatus.value = result.data
      const currentStatus = currentSchedulerStatus.value
      if (currentStatus.nextRunTime) {
        const nextTime = new Date(currentStatus.nextRunTime).getTime()
        const now = Date.now()
        autoSubmitCountdown.value = Math.max(0, Math.floor((nextTime - now) / 1000))
      } else {
        autoSubmitCountdown.value = 0
      }

      if (!currentStatus.enabled) {
        stopStatusPolling()
      }
    }
  } catch (error) {
    console.error('获取自动提交状态失败:', error)
  }
}

// 格式化倒计时显示
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '即将开始...'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分${secs}秒`
  } else if (minutes > 0) {
    return `${minutes}分${secs}秒`
  } else {
    return `${secs}秒`
  }
}

// ==================== 自动提交下载功能结束 ====================

interface AddDownloadOptions {
  overrideIsRedFlag?: boolean
  manualRedFlag?: boolean
  fromSearchResult?: boolean
}

interface AddDownloadToGroupResult {
  success: boolean
  groupName: string
  account?: string
  reason?: 'already_exists' | 'no_account' | 'error'
  error?: string
}

function resolveDramaRating(
  drama: NewDramaItem | RankingDramaItem,
  options: AddDownloadOptions = {}
) {
  if (isDisabledRedFlag(drama.book_id)) {
    return options.fromSearchResult === true ? '绿标' : '黄标'
  }

  const shouldMarkRedFlag =
    options.manualRedFlag === true ||
    (drama as any).auto_red_flag === true ||
    isAutoRedFlagPublishTime(drama.publish_time) ||
    (options.overrideIsRedFlag !== undefined
      ? options.overrideIsRedFlag
      : comparedNewDramas.value.has(drama.book_id))

  if (shouldMarkRedFlag) {
    return '红标'
  }

  if (options.fromSearchResult === true) {
    return '绿标'
  }

  return '黄标'
}

async function addDownloadToFeishuTableGroup(
  drama: NewDramaItem | RankingDramaItem,
  group: RuntimeFeishuTableGroup,
  rating: string
): Promise<AddDownloadToGroupResult> {
  const dramaName = (drama as any).book_name || (drama as any).series_name
  const groupName = group.name || '默认表格'

  try {
    const alreadyExists = await dramaExistsInFeishuTableGroup(dramaName, group)
    if (alreadyExists) {
      console.log(`剧集已存在，跳过表格组: ${dramaName} -> ${groupName}`)
      return { success: false, groupName, reason: 'already_exists' }
    }

    const accountTableId = getAccountTableId(group)
    const availableAccount = await feishuApi.getAvailableChannelAccount(
      accountTableId,
      accountRecycleEnabled.value
    )

    if (!availableAccount?.account || !availableAccount.recordId) {
      console.log(`暂无可用账户，跳过表格组: ${dramaName} -> ${groupName}`)
      return { success: false, groupName, reason: 'no_account' }
    }

    const finalAccountId = availableAccount.account
    const finalRecordId = availableAccount.recordId

    const createResult = await feishuApi.createDramaRecord(
      dramaName,
      '',
      drama.publish_time,
      drama.book_id,
      rating,
      getDramaListTableId(group)
    )
    console.log('新增记录成功:', createResult, groupName)

    // 根据下载状态决定飞书状态：加密中(4)/压缩中(1)/完成(2)设为"待下载"，其他设为"待提交"
    const downloadData = getDownloadDataForDrama(dramaName)
    const taskStatus = downloadData?.task_status
    const readyStatuses = [1, 2, 4] // 压缩中、完成、加密中
    const feishuStatus =
      taskStatus !== undefined && readyStatuses.includes(taskStatus) ? '待下载' : '待提交'

    const douyinMaterial = formatDouyinMaterialConfig(group)

    await feishuApi.createDramaStatusRecord(
      dramaName,
      drama.publish_time || '',
      finalAccountId,
      feishuStatus,
      douyinMaterial || undefined,
      rating,
      getDramaStatusTableId(group)
    )
    console.log(
      '剧集状态记录创建成功，已分配账户:',
      finalAccountId,
      '状态:',
      feishuStatus,
      '表格组:',
      groupName
    )

    await feishuApi.updateChannelAccountUsedStatus(finalRecordId, accountTableId)

    try {
      const remark = `${currentBrandName.value}-${dramaName}`
      const { editJuliangAccountRemark } = await import('@/api/juliang')
      await editJuliangAccountRemark({
        account_id: finalAccountId,
        remark,
      })
      console.log('更新巨量账户备注成功:', finalAccountId, remark)
    } catch (juliangError) {
      console.error('更新巨量账户备注失败:', juliangError)
      // 不中断主流程，只记录错误
    }

    return { success: true, groupName, account: finalAccountId }
  } catch (error) {
    console.error(`表格组 ${groupName} 新增待下载失败:`, error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return { success: false, groupName, reason: 'error', error: errorMessage }
  }
}

// 处理新增待下载流程
async function handleAddDownload(
  drama: NewDramaItem | RankingDramaItem,
  options: AddDownloadOptions = {}
) {
  // 获取剧名，兼容排行榜和新剧列表数据
  const dramaName = (drama as any).book_name || (drama as any).series_name

  // 防止重复调用：如果已经在同步中，直接返回
  if (syncingDramaId.value === drama.book_id && isAnyDramaSyncing.value) {
    console.log('该剧集正在同步中，跳过重复调用')
    return
  }

  try {
    // 设置同步状态
    syncingDramaId.value = drama.book_id
    isAnyDramaSyncing.value = true
    const operationScopeKey = currentChannelStateScopeKey.value

    const targetGroups = getTargetFeishuTableGroupsForDownload()
    if (targetGroups.length === 0) {
      showSuccessToast('未配置可用飞书表格组')
      return
    }

    const rating = resolveDramaRating(drama, options)
    const results: AddDownloadToGroupResult[] = []

    for (const group of targetGroups) {
      results.push(await addDownloadToFeishuTableGroup(drama, group, rating))
    }

    const successResults = results.filter(result => result.success)
    if (successResults.length > 0) {
      if (operationScopeKey === currentChannelStateScopeKey.value) {
        submittedForDownloadSet.value.add(getChannelScopedBookKey(drama.book_id, operationScopeKey))
      }

      if (isAllFeishuTableGroupsSelected()) {
        showSuccessToast(
          `剧集"${dramaName}"已成功添加到 ${successResults.length}/${targetGroups.length} 个飞书表格组`,
          1000
        )
      } else {
        showSuccessToast(
          `剧集"${dramaName}"已成功添加到飞书剧集清单，并分配账户：${successResults[0].account}`,
          1000
        )
      }

      console.log('账户分配成功:', successResults.map(result => result.account).join('、'))
      return
    }

    if (results.every(result => result.reason === 'already_exists')) {
      showSuccessToast(`剧集"${dramaName}"已在目标飞书剧集清单中，无需重复同步`)
    } else if (results.every(result => result.reason === 'no_account')) {
      showSuccessToast('无可用账户，请联系管理员')
    } else {
      const firstError = results.find(result => result.error)
      showSuccessToast(firstError?.error || `创建记录失败：${dramaName}`)
    }
  } catch (err) {
    console.error('同步飞书失败:', err)
    showSuccessToast(`同步飞书失败：${dramaName}`)
  } finally {
    // 清除同步状态
    syncingDramaId.value = null
    isAnyDramaSyncing.value = false
  }
}

// 下载数据过滤逻辑
function filterDownloadData(
  downloadData: DownloadTask[],
  dramaData: NewDramaItem[] | RankingDramaItem[]
): DownloadTask[] {
  // 1. 获取当前展示的剧集名称列表
  const dramaNames = dramaData
    .map(drama => {
      const name =
        'series_name' in drama && drama.series_name
          ? drama.series_name
          : (drama as RankingDramaItem).book_name
      // 清理剧名，去除前后空格
      return name?.trim() || ''
    })
    .filter(name => name) // 过滤掉空字符串

  // 2. 过滤出匹配的下载数据（包含所有task_status）

  const matchedData = downloadData.filter(item => {
    const downloadBookName = item.book_name?.trim() || ''
    // 只进行完全匹配，不进行任何处理
    const exactMatch = dramaNames.includes(downloadBookName)

    if (exactMatch) {
      console.log('匹配到下载数据:', downloadBookName, '状态:', item.task_status)
    }
    return exactMatch
  })

  // 3. 按剧名分组
  const groupedByBookName = matchedData.reduce(
    (acc, item) => {
      const bookName = item.book_name
      if (!acc[bookName]) {
        acc[bookName] = []
      }
      acc[bookName].push(item)
      return acc
    },
    {} as Record<string, DownloadTask[]>
  )

  // 4. 对每组进行优化选择：按状态优先级和task_name长度选择
  const deduplicatedData = Object.values(groupedByBookName).map((group: DownloadTask[]) => {
    // 4.1 按状态优先级排序：成功(2) > 压缩中(1) > 加密中(4) > 失败(3) > 其他(0)
    const statusPriority: Record<number, number> = { 2: 1, 1: 2, 4: 3, 3: 4, 0: 5 }

    // 4.2 先按状态优先级排序
    const sortedTasks = group.sort((a, b) => {
      const statusDiff = (statusPriority[a.task_status] || 5) - (statusPriority[b.task_status] || 5)
      if (statusDiff !== 0) {
        return statusDiff
      }
      // 状态相同时，只有成功状态(2)才按task_name长度排序（降序，选择最长的）
      if (a.task_status === 2 && b.task_status === 2) {
        return b.task_name.length - a.task_name.length
      }
      return 0
    })

    const selectedTask = sortedTasks[0]
    console.log('selectedTask', selectedTask)
    return selectedTask
  })

  return deduplicatedData
}

function mergeDownloadTasks(base: DownloadTask[], incoming: DownloadTask[]): DownloadTask[] {
  if (!incoming || incoming.length === 0) {
    return base
  }

  const map = new Map<string, DownloadTask>()

  base.forEach(task => {
    if (task.book_name) {
      map.set(task.book_name, task)
    }
  })

  incoming.forEach(task => {
    if (task.book_name) {
      map.set(task.book_name, task)
    }
  })

  return Array.from(map.values())
}

function getRequestErrorMessage(prefix: string, result?: { message?: string }) {
  return `${prefix}${result?.message ? `：${result.message}` : ''}`
}

function assertNewDramaListResult(result: Awaited<ReturnType<typeof getNewDramaList>>) {
  if (result.code !== 0) {
    throw new Error(getRequestErrorMessage('获取新剧列表失败', result))
  }

  if (!Array.isArray(result.data?.data)) {
    throw new Error('获取新剧列表失败：返回数据格式异常')
  }
}

function normalizeDownloadTaskList(result: Awaited<ReturnType<typeof getDownloadTaskList>>) {
  if (result.code !== 0) {
    throw new Error(getRequestErrorMessage('获取下载状态失败', result))
  }

  const responseData = result.data as any
  const taskList = Array.isArray(responseData?.data)
    ? responseData.data
    : Array.isArray(responseData)
      ? responseData
      : null

  if (!taskList) {
    throw new Error('获取下载状态失败：返回数据格式异常')
  }

  return taskList as DownloadTask[]
}

async function hydrateNewDramaStatuses(
  requestGen: number,
  dramaSnapshot: NewDramaItem[],
  timeRange: { startTime: number; endTime: number }
) {
  if (dramaSnapshot.length === 0) {
    downloadList.value = []
    return
  }

  const feishuStatusTask = getNewDramaFeishuStatus({
    drama_list_table_id: currentDramaListTableId.value,
    dramas: dramaSnapshot.map(drama => ({
      book_id: drama.book_id,
      series_name: drama.series_name,
    })),
  }).then(result => {
    if (result.code !== 0) {
      throw new Error(getRequestErrorMessage('获取飞书剧集状态失败', result))
    }

    if (!Array.isArray(result.data)) {
      throw new Error('获取飞书剧集状态失败：返回数据格式异常')
    }

    if (isListRequestStale(requestGen)) {
      return
    }

    const statusMap = new Map(
      result.data.map(item => [
        item.book_id,
        {
          series_name: item.series_name.trim(),
          feishu_downloaded: item.feishu_downloaded,
          feishu_exists: item.feishu_exists,
        },
      ])
    )

    dramaList.value = dramaList.value.map(drama => {
      const status = statusMap.get(drama.book_id)
      if (!status || status.series_name !== drama.series_name.trim()) {
        return drama
      }

      return {
        ...drama,
        feishu_downloaded: status.feishu_downloaded,
        feishu_exists: status.feishu_exists,
      }
    })
  })

  const downloadStatusTask = getDownloadTaskList({
    start_time: timeRange.startTime,
    end_time: timeRange.endTime,
    page_index: 0,
    page_size: 20000,
  }).then(result => {
    if (isListRequestStale(requestGen)) {
      return
    }

    downloadList.value = filterDownloadData(normalizeDownloadTaskList(result), dramaList.value)
  })

  await Promise.all([feishuStatusTask, downloadStatusTask])
}

// 根据剧名获取对应的下载数据，兼容榜单列表的下载集合
function getDownloadDataForDrama(dramaName: string): DownloadTask | null {
  const name = dramaName?.trim()
  if (!name) return null

  const matchByName = (list: DownloadTask[]) =>
    list.find(item => item.book_name?.trim() === name) || null

  return matchByName(downloadList.value) || matchByName(rankingDownloadList.value)
}

// 根据排行榜剧名获取对应的下载数据
function getRankingDownloadDataForDrama(dramaName: string): DownloadTask | null {
  const result = rankingDownloadList.value.find(item => item.book_name === dramaName) || null
  return result
}

// 检查排行榜剧集是否已下载
function isRankingDramaDownloaded(dramaName: string): boolean {
  const drama = rankingList.value.find(d => d.book_name === dramaName)
  return drama?.feishu_downloaded === true
}

// API 请求函数
async function fetchDramaList() {
  await fetchDramaListByPageCount(DEFAULT_NEW_DRAMA_PAGE_COUNT)
}

async function fetchDramaListByPageCount(
  pageCount: number,
  options: { sequential?: boolean; pageIntervalMs?: number } = {}
) {
  const requestGen = beginListRequest()
  loading.value = true
  listSkeletonLoading.value = true
  newDramaStatusLoading.value = false
  error.value = ''
  dramaList.value = []
  downloadList.value = []

  try {
    // 计算时间范围（过去30天到未来30天，使用北京时间）
    const now = dayjs().tz('Asia/Shanghai')
    const startTime = Math.floor(now.subtract(30, 'day').valueOf() / 1000)
    const endTime = Math.floor(now.add(30, 'day').valueOf() / 1000)

    const safePageCount = Math.max(1, pageCount)
    const { sequential = false, pageIntervalMs = 0 } = options

    let dramaResults: Awaited<ReturnType<typeof getNewDramaList>>[] = []

    if (sequential) {
      // 全量查询使用串行分页，避免接口瞬时并发压力
      for (let pageIndex = 0; pageIndex < safePageCount; pageIndex++) {
        const pageResult = await getNewDramaList({
          page_size: NEW_DRAMA_PAGE_SIZE,
          permission_statuses: '3,4',
          page_index: pageIndex + 1,
          drama_list_table_id: currentDramaListTableId.value,
          skip_feishu_status: 1,
        })
        assertNewDramaListResult(pageResult)
        dramaResults.push(pageResult)

        if (pageIndex < safePageCount - 1 && pageIntervalMs > 0) {
          await new Promise<void>(resolve => {
            setTimeout(resolve, pageIntervalMs)
          })
        }
      }
    } else {
      const dramaRequests = Array.from({ length: safePageCount }, (_, pageIndex) =>
        getNewDramaList({
          page_size: NEW_DRAMA_PAGE_SIZE,
          permission_statuses: '3,4',
          page_index: pageIndex + 1,
          drama_list_table_id: currentDramaListTableId.value,
          skip_feishu_status: 1,
        })
      )
      dramaResults = await Promise.all(dramaRequests)
      dramaResults.forEach(assertNewDramaListResult)
    }

    // 若期间用户切走了 Tab,丢弃这次响应,不更新 UI
    if (isListRequestStale(requestGen)) return

    // 合并多页新剧列表结果
    const allDramaData = dramaResults.flatMap(result => result.data?.data || [])

    // 根据 book_id 去重（防止重复数据）
    const uniqueDramaData = allDramaData.reduce(
      (acc, drama) => {
        if (!acc.find(item => item.book_id === drama.book_id)) {
          acc.push(drama)
        }
        return acc
      },
      [] as typeof allDramaData
    )

    // 过滤新剧数据：只要dy_audit_status为3（审核通过）且在指定日期范围内的数据
    // 每次刷新时重新计算当前日期范围
    const currentDateRange = getCurrentDateRange()

    const filteredDramaData = uniqueDramaData.filter(drama => {
      // 检查审核状态
      if (drama.dy_audit_status !== 3) return false

      // 检查发布日期是否在日期范围内（今天、明天、后天）
      const publishDate = drama.publish_time.split(' ')[0]
      const isInRange = currentDateRange.includes(publishDate)

      // 过滤掉集数少于 40 集的短剧
      if (drama.episode_amount && drama.episode_amount < 40) return false

      return isInRange
    })

    dramaList.value = filteredDramaData
    downloadList.value = []
    newDramaStatusLoading.value = filteredDramaData.length > 0
    void hydrateNewDramaStatuses(requestGen, filteredDramaData, { startTime, endTime })
      .then(() => {
        if (!isListRequestStale(requestGen)) {
          newDramaStatusLoading.value = false
        }
      })
      .catch(err => {
        if (!isListRequestStale(requestGen)) {
          console.error('Failed to hydrate new drama statuses:', err)
          error.value = err instanceof Error ? err.message : '获取新剧状态失败'
          dramaList.value = []
          downloadList.value = []
          newDramaStatusLoading.value = false
        }
      })

    // 刷新后检查当前页面是否还有数据，如果没有则重置到第一页
    const totalPages = Math.ceil(filteredDramaData.length / pageSize.value)
    if (currentPage.value > totalPages && totalPages > 0) {
      currentPage.value = 1
    }
  } catch (err) {
    if (isListRequestStale(requestGen)) return
    console.error('Failed to fetch data:', err)
    error.value = err instanceof Error ? err.message : '获取数据失败'
    dramaList.value = []
    downloadList.value = []
    newDramaStatusLoading.value = false
  } finally {
    if (!isListRequestStale(requestGen)) {
      loading.value = false
      // 延迟隐藏骨架屏
      setTimeout(() => {
        if (!isListRequestStale(requestGen)) {
          listSkeletonLoading.value = false
        }
      }, 300)
    }
  }
}

async function handleFetchAllDramaList() {
  if (fullDramaLoading.value || loading.value) {
    return
  }

  fullDramaLoading.value = true
  showSuccessToast('开始全量查询 20 页新剧数据，请稍候...', 2500)

  try {
    await fetchDramaListByPageCount(FULL_NEW_DRAMA_PAGE_COUNT, {
      sequential: true,
      pageIntervalMs: FULL_NEW_DRAMA_PAGE_DELAY_MS,
    })
    showSuccessToast('全量查询完成（20 页）')
  } finally {
    fullDramaLoading.value = false
  }
}

// 监听选中日期变化
watch(selectedDate, async newDate => {
  // 切换日期时重置到第一页
  currentPage.value = 1

  // 如果切换到"全部"，清除增剧标记
  if (newDate === 'all' && activeTab.value === 'new-drama') {
    comparedNewDramas.value.clear()
    showingComparedDramas.value = false
    return
  }
})

// 监听收入评级变化
watch(selectedIncomeLevel, () => {
  // 切换收入评级时重置到第一页并重新获取数据
  rankingPageIndex.value = 0
  if (activeTab.value === 'ranking') {
    fetchRankingList()
  }
})

// 监听搜索关键词变化
watch(searchKeyword, () => {
  // 搜索时重置到第一页
  currentPage.value = 1
})

// 监听 Tab 切换
watch(activeTab, async newTab => {
  // 如果正在搜索，不执行任何操作，保持搜索结果
  if (isSearching.value) {
    return
  }

  if (newTab === 'new-drama') {
    // 新剧抢跑 tab：如果没有数据则加载
    if (dramaList.value.length === 0) {
      await fetchDramaList()
    }
  } else if (newTab === 'ranking') {
    // 榜单剧 tab：如果没有数据则加载
    if (rankingList.value.length === 0) {
      fetchRankingList()
    }
  }
})

// 返回首页
function goBack() {
  router.push('/')
}

function isDownloadTriggered(name?: string | null) {
  if (!name) return false
  return downloadTriggeredSet.value.has(name.trim())
}

function markDownloadTriggered(name?: string | null) {
  if (!name) return
  const next = new Set(downloadTriggeredSet.value)
  next.add(name.trim())
  downloadTriggeredSet.value = next
}

function clearDownloadTriggered(name?: string | null) {
  if (!name) return
  const next = new Set(downloadTriggeredSet.value)
  next.delete(name.trim())
  downloadTriggeredSet.value = next
}

// 智能刷新处理
async function handleRefresh() {
  if (searchKeyword.value.trim()) {
    // 有关键词时，执行搜索逻辑
    handleSearch()
  } else {
    // 没有关键词时，根据当前标签页执行对应的刷新逻辑
    if (activeTab.value === 'new-drama') {
      // 新剧抢跑标签页：刷新新剧数据
      fetchDramaList()
    } else if (activeTab.value === 'ranking') {
      // 排行榜标签页：刷新排行榜数据
      fetchRankingList({ force: true })
    }
  }
}

// 搜索处理（防抖触发）
function handleSearchInput() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    handleSearch()
  }, 400)
}

async function handleSearch() {
  const keyword = searchKeyword.value.trim()

  // 如果搜索框被清空，清空搜索结果
  if (!keyword) {
    searchResults.value = []
    searchTotal.value = 0
    searchCurrentPage.value = 1
    currentPage.value = 1
    return
  }

  // 执行远程搜索
  await performSearch(keyword, 1)
}

async function handleAdxDramaSearch(name: string) {
  const keyword = name.trim()
  if (!keyword) return

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }

  activeTab.value = 'new-drama'
  searchKeyword.value = keyword
  currentPage.value = 1
  await performSearch(keyword, 1)
}

// 执行搜索接口调用
async function performSearch(keyword: string, page: number) {
  const requestGen = beginListRequest()
  try {
    searchLoading.value = true
    error.value = ''
    searchCurrentPage.value = page

    // 计算时间范围（过去30天到未来30天，使用北京时间）
    const now = dayjs().tz('Asia/Shanghai')
    const startTime = Math.floor(now.subtract(30, 'day').valueOf() / 1000)
    const endTime = Math.floor(now.add(30, 'day').valueOf() / 1000)

    // 并发请求搜索接口和下载任务列表
    const [searchResult, downloadResult] = await Promise.all([
      // 统一按关键词查询，固定取前 10 条
      searchNewDramaList({
        query: keyword,
        page_index: 0,
        page_size: 10,
        drama_list_table_id: currentDramaListTableId.value, // 使用当前渠道表ID
      }),
      // 获取下载任务列表（获取所有状态）
      getDownloadTaskList({
        start_time: startTime,
        end_time: endTime,
        page_index: 0,
        page_size: 20000,
        // 移除 task_status 过滤，获取所有状态的下载任务
      }),
    ])

    if (isListRequestStale(requestGen)) return

    assertNewDramaListResult(searchResult)

    if (searchResult.data) {
      const searchDramaData = searchResult.data.data || []
      searchResults.value = searchDramaData
      searchTotal.value = searchDramaData.length

      // 处理下载数据，为搜索结果关联下载状态
      const downloadTasks = normalizeDownloadTaskList(downloadResult)
      if (downloadTasks.length > 0) {
        // 使用与页面初始化相同的逻辑处理下载数据
        const searchDownloadList = filterDownloadData(downloadTasks, searchDramaData)

        // 将搜索结果的下载数据合并到全局下载列表中
        // 这样可以确保 getDownloadDataForDrama 函数能找到对应的下载状态
        const existingDownloadList = downloadList.value || []
        downloadList.value = mergeDownloadTasks(existingDownloadList, searchDownloadList)
        console.log('downloadList.value', downloadList.value)
      }

      console.log(
        '搜索结果已包含飞书状态和下载状态:',
        searchResults.value.map(d => ({
          name: d.series_name,
          feishu_downloaded: d.feishu_downloaded,
          downloadStatus: getDownloadDataForDrama(d.series_name)?.task_status,
        }))
      )
    }
  } catch (err) {
    if (isListRequestStale(requestGen)) return
    console.error('搜索失败:', err)
    error.value = err instanceof Error ? err.message : '搜索失败'
    searchResults.value = []
    searchTotal.value = 0
  } finally {
    if (!isListRequestStale(requestGen)) {
      searchLoading.value = false
    }
  }
}

// 注意：飞书状态现在由后端接口直接提供，无需前端重复获取

// 清空搜索
function clearSearch() {
  // 清空搜索结果
  searchResults.value = []
  searchTotal.value = 0
  searchCurrentPage.value = 1
  currentPage.value = 1
}

// 分页相关方法
async function goToPage(page: number | string) {
  if (typeof page === 'string' || page < 1 || page > totalPages.value) {
    return
  }

  // 如果正在搜索，执行搜索分页
  if (isSearching.value) {
    const keyword = searchKeyword.value.trim()
    if (keyword) {
      await performSearch(keyword, page)
    }
  } else {
    currentPage.value = page
  }

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 搜索分页方法
async function goToSearchPage(page: number) {
  if (page < 1 || page > Math.ceil(searchTotal.value / searchPageSize.value)) {
    return
  }

  const keyword = searchKeyword.value.trim()
  if (keyword) {
    await performSearch(keyword, page)
  }

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function getRankingListCacheKey() {
  return [
    currentDramaListTableId.value,
    selectedIncomeLevel.value,
    rankingPageIndex.value,
    rankingPageSize.value,
  ].join('|')
}

function applyRankingListCacheEntry(entry: RankingListCacheEntry) {
  rankingList.value = entry.list
  rankingTotal.value = entry.total
  rankingDownloadList.value = entry.downloadList
  rankingError.value = ''
}

// 获取排行榜数据
async function fetchRankingList(options: { force?: boolean } = {}) {
  const cacheKey = getRankingListCacheKey()
  if (options.force) {
    rankingListCache.delete(cacheKey)
  }

  if (!options.force) {
    const cachedEntry = rankingListCache.get(cacheKey)
    if (cachedEntry) {
      applyRankingListCacheEntry(cachedEntry)
      return
    }
  }

  const requestGen = beginListRequest()
  rankingLoading.value = true
  rankingError.value = ''

  try {
    // 计算时间范围（过去90天到未来30天，使用北京时间）
    // 排行榜数据可能包含更早的剧集，需要扩大时间范围
    const now = dayjs().tz('Asia/Shanghai')
    const startTime = Math.floor(now.subtract(90, 'day').valueOf() / 1000)
    const endTime = Math.floor(now.add(30, 'day').valueOf() / 1000)

    // 获取当前选择的收入评级
    const selectedOption = incomeLevelOptions.find(opt => opt.value === selectedIncomeLevel.value)
    const incomeLevel = selectedOption?.incomeLevel

    // 构建filter_options参数
    const filterOptions: any = { sort_type: 1 }
    if (incomeLevel !== null && incomeLevel !== undefined) {
      filterOptions.income_level = incomeLevel
    }

    // 并发请求排行榜接口和下载任务列表
    const [rankingResult, downloadResult] = await Promise.all([
      // 使用后端接口获取排行榜数据（包含飞书状态）
      http
        .get('/novelsale/distributor/statistic/rank/series/quality/list/v2', {
          params: {
            filter_options: JSON.stringify(filterOptions),
            page_index: rankingPageIndex.value,
            page_size: rankingPageSize.value,
            drama_list_table_id: currentDramaListTableId.value, // 使用当前渠道表格
          },
        })
        .then(res => res.data),
      // 获取下载任务列表（获取所有状态）
      getDownloadTaskList({
        start_time: startTime,
        end_time: endTime,
        page_index: 0,
        page_size: 20000,
      }),
    ])

    if (isListRequestStale(requestGen)) return

    if (rankingResult.code === 0 && rankingResult.data) {
      // 处理排行榜数据，添加分类标签分割
      const processedRankingData: RankingDramaItem[] = rankingResult.data
        .filter((item: unknown) => {
          const itemData = item as Record<string, unknown>
          // 过滤掉 permission_status 等于 2 的数据
          // 过滤掉 delivery_status 等于 2 的数据
          return itemData.permission_status !== 2 && itemData.delivery_status !== 2
        })
        .map((item: unknown) => {
          const itemData = item as Record<string, unknown>
          return {
            ...itemData,
            book_id: itemData.book_id as string,
            book_name: itemData.book_name as string,
            series_name: itemData.series_name as string,
            category: itemData.category as string,
            category_text: itemData.category_text as string,
            // 优先使用 original_thumb_url，如果不存在则使用 thumb_url
            original_thumb_url: (itemData.original_thumb_url || itemData.thumb_url) as string,
            episode_amount: itemData.episode_amount as number,
            publish_time: itemData.publish_time as string,
            feishu_downloaded: itemData.feishu_downloaded as boolean,
            feishu_exists: itemData.feishu_exists as boolean,
            // 将 category 字段按逗号分割为数组
            category_tags: itemData.category
              ? (itemData.category as string).split(',').map((tag: string) => tag.trim())
              : [],
          } as RankingDramaItem
        })

      // 更新分页信息
      rankingTotal.value = rankingResult.total || 0

      // 直接设置数据（分页模式）
      rankingList.value = processedRankingData
      console.log('downloadResult.value', downloadResult.data)
      console.log('processedRankingData', processedRankingData)

      // 处理下载数据，为排行榜数据关联下载状态
      if (downloadResult.data && Array.isArray(downloadResult.data)) {
        // 使用与页面初始化相同的逻辑处理下载数据
        const filteredRankingDownloadList = filterDownloadData(
          downloadResult.data,
          processedRankingData
        )
        console.log('filteredRankingDownloadList', filteredRankingDownloadList)
        rankingDownloadList.value = filteredRankingDownloadList
      } else {
        console.warn('排行榜下载数据为空，尝试使用全局下载数据')
        // 如果排行榜专用下载数据为空，尝试使用全局下载数据
        if (downloadList.value && downloadList.value.length > 0) {
          const filteredRankingDownloadList = filterDownloadData(
            downloadList.value,
            processedRankingData
          )
          rankingDownloadList.value = filteredRankingDownloadList
        } else {
          rankingDownloadList.value = []
        }
      }

      rankingListCache.set(cacheKey, {
        list: rankingList.value,
        total: rankingTotal.value,
        downloadList: rankingDownloadList.value,
      })

      console.log(
        '排行榜数据已包含飞书状态和下载状态:',
        rankingList.value.map(d => ({
          name: d.book_name,
          feishu_downloaded: d.feishu_downloaded,
          feishu_exists: d.feishu_exists,
          downloadStatus: getRankingDownloadDataForDrama(d.book_name)?.task_status,
        }))
      )

      // 调试：检查下载数据匹配情况
      console.log('排行榜下载数据匹配情况:')
      console.log(
        '排行榜剧名列表:',
        rankingList.value.map(d => d.book_name)
      )
      console.log(
        '下载任务剧名列表:',
        downloadResult.data?.data?.map((d: any) => d.book_name) || []
      )
      console.log('匹配的下载数据:', rankingDownloadList.value)

      // 检查剧名匹配情况
      const rankingNames = rankingList.value.map(d => d.book_name)
      const downloadNames = downloadResult.data?.data?.map((d: any) => d.book_name) || []
      const matchedNames = rankingNames.filter(name => downloadNames.includes(name))
      console.log('匹配的剧名数量:', matchedNames.length, '总排行榜数量:', rankingNames.length)
      console.log('匹配的剧名:', matchedNames)

      // 检查未匹配的剧名
      const unmatchedRankingNames = rankingNames.filter(
        (name: string) => !downloadNames.includes(name)
      )
      const unmatchedDownloadNames = downloadNames.filter(
        (name: string) => !rankingNames.includes(name)
      )
      console.log('未匹配的排行榜剧名:', unmatchedRankingNames.slice(0, 5)) // 只显示前5个
      console.log('未匹配的下载任务剧名:', unmatchedDownloadNames.slice(0, 5)) // 只显示前5个

      // 检查剧名长度和字符
      if (unmatchedRankingNames.length > 0) {
        console.log(
          '排行榜剧名示例:',
          unmatchedRankingNames[0],
          '长度:',
          unmatchedRankingNames[0].length
        )
        console.log(
          '排行榜剧名字符码:',
          Array.from(unmatchedRankingNames[0]).map((c: string) => c.charCodeAt(0))
        )
      }
      if (unmatchedDownloadNames.length > 0) {
        console.log(
          '下载任务剧名示例:',
          unmatchedDownloadNames[0],
          '长度:',
          unmatchedDownloadNames[0].length
        )
        console.log(
          '下载任务剧名字符码:',
          Array.from(unmatchedDownloadNames[0] as string).map((c: string) => c.charCodeAt(0))
        )
      }
    } else {
      rankingList.value = []
      rankingTotal.value = 0
      rankingDownloadList.value = []
      rankingListCache.set(cacheKey, {
        list: [],
        total: 0,
        downloadList: [],
      })
    }
  } catch (error) {
    if (isListRequestStale(requestGen)) return
    console.error('获取排行榜数据失败:', error)
    rankingError.value = '获取榜单剧数据失败，请稍后重试'
    rankingList.value = []
  } finally {
    if (!isListRequestStale(requestGen)) {
      rankingLoading.value = false
    }
  }
}

// 榜单剧分页相关计算属性
const rankingVisiblePages = computed(() => {
  const pages = []
  const total = Math.ceil(rankingTotal.value / rankingPageSize.value)
  const current = rankingPageIndex.value + 1

  if (total <= 7) {
    // 如果总页数不超过7页，显示所有页码
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // 如果总页数超过7页，显示省略号
    if (current <= 4) {
      // 当前页在前4页
      for (let i = 1; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      // 当前页在后4页
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) {
        pages.push(i)
      }
    } else {
      // 当前页在中间
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    }
  }

  return pages
})

// 榜单剧分页方法
async function goToRankingPage(page: number | string) {
  if (
    typeof page === 'string' ||
    page < 0 ||
    page >= Math.ceil(rankingTotal.value / rankingPageSize.value)
  ) {
    return
  }

  rankingPageIndex.value = page
  await fetchRankingList()

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 取消所有列表/搜索/榜单类在途请求,并把 loading 状态归位
// (响应实际仍会回来,但靠 listRequestGeneration 在 await 之后丢弃结果)
function cancelAllListRequests() {
  listRequestGeneration += 1
  loading.value = false
  listSkeletonLoading.value = false
  newDramaStatusLoading.value = false
  searchLoading.value = false
  rankingLoading.value = false
  fullDramaLoading.value = false
}
defineExpose({ cancelAllRequests: cancelAllListRequests })

// 组件挂载时获取数据
onMounted(async () => {
  window.addEventListener('resize', updateClipContentPanelMinHeight)

  await syncCurrentChannelConfig()

  reportPageVisit('剧单页').catch((error: unknown) => {
    console.warn('记录剧单页访问日志失败:', error)
  })

  // 加载当前运行用户的抖音号素材配置
  douyinMaterialStore.loadFromServer(true)

  // 从 URL 参数中读取 user_id（如果存在）
  const urlParams = new URLSearchParams(window.location.search)
  const urlUserId = urlParams.get('user_id')

  // 如果 URL 中有 user_id 参数，确保更新到 store
  if (urlUserId) {
    const currentUserId = apiConfigStore.effectiveUserId
    // 只有当 URL 中的 user_id 与当前的不同时才更新
    if (urlUserId !== currentUserId) {
      apiConfigStore.updateConfig({ userId: urlUserId })
    }
  }

  // 根据当前激活的 tab 加载对应的数据
  if (activeTab.value === 'new-drama') {
    // 新剧抢跑 tab：加载新剧数据
    fetchDramaList()
  } else if (activeTab.value === 'ranking') {
    // 榜单剧 tab：加载榜单数据
    fetchRankingList()
  }

  // 检查服务端自动提交状态，如果正在运行则恢复UI状态
  try {
    const statusResult = await getAutoSubmitStatus()
    if (statusResult.code === 0 && statusResult.data) {
      autoSubmitStatus.value = statusResult.data
      if (currentSchedulerStatus.value.enabled) {
        startStatusPolling()
      }
    }
  } catch (error) {
    console.log('检查服务端自动提交状态失败:', error)
  }

  nextTick(updateClipContentPanelMinHeight)
})

watch(showAdxDrawer, () => {
  nextTick(updateClipContentPanelMinHeight)
})

watch([activeTab, searchKeyword, listSkeletonLoading, searchLoading, rankingLoading], () => {
  nextTick(updateClipContentPanelMinHeight)
})

watch(
  () => sessionStore.selectedChannelId,
  async (newChannelId, oldChannelId) => {
    if (!newChannelId || newChannelId === oldChannelId) {
      return
    }

    const reloadGeneration = ++channelScopedReloadGeneration
    cancelAllListRequests()
    resetChannelScopedData()

    await syncCurrentChannelConfig()

    if (
      reloadGeneration !== channelScopedReloadGeneration ||
      String(apiConfigStore.config.channelId || '') !== String(newChannelId)
    ) {
      return
    }

    douyinMaterialStore.loadFromServer(true).catch(error => {
      console.error('切换渠道后加载抖音号匹配素材失败:', error)
    })

    reloadChannelScopedData().catch(error => {
      console.error('切换渠道后刷新爆剧爆剪数据失败:', error)
    })
  }
)
</script>

<style scoped>
@import '@/assets/newDramaPreview.css';

/* 一级筛选条 sticky 位置 */
.filter-sticky {
  top: 64px;
}

.clip-workspace {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
}

.clip-workspace.has-adx-panel {
  max-width: min(1680px, calc(100vw - 32px));
  padding-right: 16px;
}

.clip-main-content {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 80rem;
  margin: 0 auto;
}

.clip-workspace.has-adx-panel .clip-main-content {
  flex: 1 1 0;
  max-width: none;
  margin: 0;
}

.clip-workspace.has-adx-panel > :deep(.adx-ranking-panel) {
  flex: 0 0 380px;
}

.clip-workspace.has-adx-panel .clip-main-content > .new-drama-preview,
.clip-workspace.has-adx-panel .clip-main-content > .drama-list,
.clip-workspace.has-adx-panel .clip-main-content > .empty-state {
  width: 100%;
  min-width: 0;
  min-height: max(0px, var(--clip-content-panel-min-height, 0px));
}

.filter-sticky.is-embedded {
  /* 嵌入到首页 Tab 容器内时,父容器自身处于 main 区,无需粘附在视口顶部 */
  position: relative;
  top: auto;
}

.secondary-tab-sticky {
  top: 124px;
}

/* 嵌入模式下二级 tab 不再粘附 */
.is-embedded .secondary-tab-sticky {
  position: relative;
  top: auto;
}

@media (max-width: 640px) {
  .secondary-tab-sticky {
    top: 156px;
  }
}

/* 嵌入模式:去掉外层背景渐变(由父级首页统一渐变),并去掉外层 min-h-full */
.new-drama-preview-page.is-embedded {
  min-height: 0;
  background: transparent;
}

/* 首页嵌入态：降低内部 Tab 权重，避免与首页/渠道 Tab 形成多层胶囊堆叠 */
.new-drama-preview-page.is-embedded .filter-sticky,
.new-drama-preview-page.is-embedded .secondary-tab-sticky {
  background: transparent;
  border-bottom: 0;
  box-shadow: none;
  backdrop-filter: none;
}

.new-drama-preview-page.is-embedded .filter-sticky > div,
.new-drama-preview-page.is-embedded .secondary-tab-sticky > div {
  padding-left: 0;
  padding-right: 0;
}

.new-drama-preview-page.is-embedded .clip-main-content {
  padding-left: 0;
  padding-right: 0;
  padding-top: 0;
}

.new-drama-preview-page.is-embedded .clip-workspace {
  max-width: none;
}

.new-drama-preview-page.is-embedded .clip-workspace.has-adx-panel {
  padding-right: 0;
}

.new-drama-preview-page.is-embedded .filter-section {
  height: auto;
  min-height: 0;
}

.new-drama-preview-page.is-embedded .compact-filter-row {
  gap: 10px;
  flex-wrap: wrap;
  padding: 14px 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-bottom: 0;
  border-radius: 20px 20px 0 0;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 38px -32px rgba(15, 23, 42, 0.35);
}

.new-drama-preview-page.is-embedded .tab-switcher,
.new-drama-preview-page.is-embedded .secondary-tab-switcher {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.new-drama-preview-page.is-embedded .tab-switch-btn {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  box-shadow: none;
  font-weight: 600;
}

.new-drama-preview-page.is-embedded .tab-switch-btn.active {
  border-color: rgba(99, 102, 241, 0.18);
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
  box-shadow: none;
  transform: none;
}

.new-drama-preview-page.is-embedded .secondary-tab-sticky {
  margin-top: 8px;
}

.new-drama-preview-page.is-embedded .secondary-tab-switcher {
  height: auto;
  min-height: 0;
  max-height: none;
  flex-wrap: wrap;
  gap: 6px;
}

.new-drama-preview-page.is-embedded .secondary-tab-btn {
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  box-shadow: none;
}

.new-drama-preview-page.is-embedded .secondary-tab-btn.active {
  border-color: rgba(37, 99, 235, 0.12);
  background: rgba(37, 99, 235, 0.09);
  box-shadow: none;
  transform: none;
}

.new-drama-preview-page.is-embedded .secondary-tab-btn.is-disabled,
.new-drama-preview-page.is-embedded .secondary-tab-btn:disabled {
  cursor: not-allowed;
  opacity: 0.44;
  filter: grayscale(0.4);
  transform: none;
  box-shadow: none;
}

.new-drama-preview-page.is-embedded .secondary-tab-btn.is-disabled.active,
.new-drama-preview-page.is-embedded .secondary-tab-btn:disabled.active {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(148, 163, 184, 0.08);
  color: #64748b;
}

.new-drama-preview-page.is-embedded .search-query-compact {
  min-width: min(520px, 100%);
  flex: 1 1 360px;
}

.new-drama-preview-page.is-embedded .search-input-native {
  width: min(320px, 100%);
}

.feishu-group-select {
  width: 150px;
  flex: 0 0 150px;
}

.new-drama-preview-page.is-embedded .new-drama-preview {
  margin-top: 0;
  padding: 18px 18px 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-top: 0;
  border-radius: 0 0 20px 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.76)),
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 32%);
  box-shadow: 0 24px 70px -44px rgba(15, 23, 42, 0.45);
}

.new-drama-preview-page.is-embedded .embedded-list-filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 14px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.date-cart-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.bulk-cart-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 46px;
  min-width: 126px;
  padding: 0 13px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.96)),
    radial-gradient(circle at 20% 0%, rgba(14, 165, 233, 0.18), transparent 34%);
  color: #0369a1;
  cursor: pointer;
  box-shadow:
    0 10px 28px -18px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
  backdrop-filter: blur(12px);
}

.bulk-cart-button:not(:disabled):hover {
  transform: translateY(-2px);
  border-color: rgba(14, 165, 233, 0.38);
  color: #075985;
  box-shadow:
    0 18px 38px -20px rgba(14, 165, 233, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.bulk-cart-button:disabled {
  cursor: not-allowed;
  opacity: 0.54;
  box-shadow: none;
}

.bulk-cart-button.is-ready {
  border-color: rgba(14, 165, 233, 0.32);
  background:
    linear-gradient(135deg, #f0f9ff 0%, #ecfeff 100%),
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.18), transparent 36%);
}

.bulk-cart-button__glow {
  position: absolute;
  inset: -40% auto auto -30%;
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.16);
  filter: blur(12px);
}

.bulk-cart-button__icon,
.bulk-cart-button__text,
.bulk-cart-button__count {
  position: relative;
  z-index: 1;
}

.bulk-cart-button__icon {
  width: 20px;
  height: 20px;
}

.bulk-cart-button__text {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.bulk-cart-button__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: #f97316;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 6px 14px rgba(249, 115, 22, 0.26);
}

.bulk-cart-skeleton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  min-width: 126px;
  padding: 0 13px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.82);
  overflow: hidden;
}

.bulk-cart-skeleton__icon,
.bulk-cart-skeleton__text,
.bulk-cart-skeleton__count {
  display: inline-block;
  border-radius: 999px;
  background: linear-gradient(90deg, #e5e7eb 0%, #f8fafc 48%, #e5e7eb 100%);
  background-size: 220% 100%;
  animation: status-skeleton-shimmer 1.4s ease-in-out infinite;
}

.bulk-cart-skeleton__icon {
  width: 20px;
  height: 20px;
}

.bulk-cart-skeleton__text {
  width: 54px;
  height: 13px;
}

.bulk-cart-skeleton__count {
  width: 24px;
  height: 22px;
}

@keyframes status-skeleton-shimmer {
  0% {
    background-position: 160% 0;
  }

  100% {
    background-position: -60% 0;
  }
}

.new-drama-preview-page.is-embedded .drama-list {
  padding: 0;
}

.auto-submit-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.52);
  backdrop-filter: blur(8px);
}

.auto-submit-modal-card {
  width: min(480px, 100%);
  max-height: calc(100dvh - 40px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 26px 80px rgba(15, 23, 42, 0.28);
}

.auto-submit-modal-header {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.14), transparent 36%),
    linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%);
}

.auto-submit-modal-title-row,
.auto-submit-modal-title-left {
  display: flex;
  align-items: center;
}

.auto-submit-modal-title-row {
  justify-content: space-between;
  gap: 14px;
}

.auto-submit-modal-title-left {
  min-width: 0;
  gap: 12px;
}

.auto-submit-modal-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
  color: #fff;
  box-shadow: 0 12px 28px rgba(14, 165, 233, 0.22);
}

.auto-submit-modal-icon {
  width: 22px;
  height: 22px;
}

.auto-submit-modal-title {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
}

.auto-submit-modal-subtitle {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.auto-submit-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  color: #64748b;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.auto-submit-modal-close:hover {
  border-color: rgba(14, 165, 233, 0.22);
  background: #fff;
  color: #0f172a;
}

.auto-submit-modal-close-icon {
  width: 18px;
  height: 18px;
}

.auto-submit-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.auto-submit-field {
  margin-bottom: 16px;
}

.auto-submit-label {
  display: block;
  margin-bottom: 8px;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.auto-submit-radio-list {
  display: grid;
  gap: 10px;
}

.auto-submit-radio-card {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
  background: #fff;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.auto-submit-radio-card:hover {
  background: #f8fafc;
}

.auto-submit-radio-card.active {
  border-color: rgba(14, 165, 233, 0.42);
  background: #f0f9ff;
  box-shadow: 0 10px 28px -24px rgba(14, 165, 233, 0.8);
}

.auto-submit-radio-card.danger {
  border-color: rgba(239, 68, 68, 0.36);
  background: #fff1f2;
}

.auto-submit-radio-title {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}

.auto-submit-radio-desc {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.auto-submit-help-card {
  padding: 14px;
  border: 1px solid rgba(14, 165, 233, 0.18);
  border-radius: 16px;
  background: linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%);
}

.auto-submit-help-content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.auto-submit-help-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  color: #0284c7;
}

.auto-submit-help-title {
  margin: 0 0 6px;
  color: #075985;
  font-size: 13px;
  font-weight: 700;
}

.auto-submit-help-list {
  margin: 0;
  padding-left: 16px;
  color: #0369a1;
  font-size: 12px;
  line-height: 1.7;
}

.auto-submit-help-danger {
  color: #dc2626;
  font-weight: 700;
}

.auto-submit-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
  background: #f8fafc;
}

.auto-submit-cancel-button,
.auto-submit-confirm-button {
  min-height: 38px;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.auto-submit-cancel-button {
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: #fff;
  color: #475569;
}

.auto-submit-confirm-button {
  border: 0;
  background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
  color: #fff;
  box-shadow: 0 12px 26px rgba(14, 165, 233, 0.24);
}

.auto-submit-confirm-button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 30px rgba(14, 165, 233, 0.3);
}

.auto-submit-confirm-button:disabled {
  cursor: not-allowed;
  opacity: 0.68;
  box-shadow: none;
}

@media (max-width: 1180px) {
  .clip-workspace,
  .clip-workspace.has-adx-panel {
    flex-direction: column;
    max-width: 80rem;
    padding-right: 0;
  }

  .clip-main-content {
    width: 100%;
    order: 2;
  }

  .clip-workspace > :deep(.adx-ranking-panel) {
    flex: none;
    order: 1;
    margin: 12px 16px 0;
    width: calc(100% - 32px);
  }
}

@media (max-width: 640px) {
  .new-drama-preview-page.is-embedded .compact-filter-row,
  .new-drama-preview-page.is-embedded .new-drama-preview {
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.16);
  }

  .new-drama-preview-page.is-embedded .compact-filter-row {
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    margin-bottom: 10px;
  }

  .new-drama-preview-page.is-embedded .search-query-compact {
    width: 100%;
    min-width: 0;
    flex: 1 1 100%;
    margin-left: 0;
  }

  .new-drama-preview-page.is-embedded .search-input-native {
    flex: 1 1 auto;
    width: 100%;
    min-width: 180px;
  }

  .new-drama-preview-page.is-embedded .embedded-list-filter-row {
    align-items: flex-start;
  }

  .date-cart-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }

  .bulk-cart-button {
    height: 40px;
    min-width: 112px;
    border-radius: 14px;
  }

  .bulk-cart-button__text {
    font-size: 12px;
  }

  .new-drama-preview-page.is-embedded .secondary-tab-switcher {
    flex: 1 1 calc(100% - 56px);
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
  }

  .new-drama-preview-page.is-embedded .secondary-tab-switcher::-webkit-scrollbar {
    display: none;
  }

  .auto-submit-modal-overlay {
    align-items: flex-end;
    padding: 12px;
  }

  .auto-submit-modal-card {
    max-height: calc(100dvh - 24px);
    border-radius: 20px;
  }

  .auto-submit-modal-header,
  .auto-submit-modal-body,
  .auto-submit-modal-footer {
    padding-left: 16px;
    padding-right: 16px;
  }

  .auto-submit-modal-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
