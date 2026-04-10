<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p class="text-sm font-semibold text-blue-600">管理员后台</p>
          <h1 class="mt-1 text-2xl font-bold text-slate-900">用户与渠道配置中心</h1>
        </div>
        <div class="flex items-center gap-3">
          <n-button tertiary @click="handleBackToWorkspace">返回工作台</n-button>
          <n-button type="error" tertiary @click="handleLogout">退出登录</n-button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div class="grid gap-4 md:grid-cols-4">
        <n-card v-for="item in overviewCards" :key="item.label" :bordered="false" class="shadow-sm">
          <p class="text-sm text-slate-500">{{ item.label }}</p>
          <p class="mt-3 text-3xl font-bold text-slate-900">{{ item.value }}</p>
        </n-card>
      </div>

      <n-card :bordered="false" class="mt-6 shadow-sm">
        <n-tabs type="line" animated>
          <n-tab-pane name="users" tab="用户配置">
            <div class="mb-4 flex items-center justify-between gap-3">
              <n-input
                v-model:value="userKeyword"
                clearable
                placeholder="搜索昵称或账号"
                class="max-w-sm"
              />
              <n-button type="primary" @click="openUserModal()">新增用户</n-button>
            </div>

            <n-data-table
              :columns="userColumns"
              :data="filteredUsers"
              :bordered="false"
              :single-line="false"
            />
          </n-tab-pane>

          <n-tab-pane name="channels" tab="渠道配置">
            <div class="mb-4 flex items-center justify-between gap-3">
              <n-input
                v-model:value="channelKeyword"
                clearable
                placeholder="搜索渠道名称"
                class="max-w-sm"
              />
              <n-button type="primary" @click="openChannelModal()">新增渠道</n-button>
            </div>

            <div v-if="isChannelSortingByKeyword" class="channel-sort-tip">
              正在按关键词筛选，当前仅展示结果，清空搜索后可拖拽调整渠道顺序。
            </div>

            <n-data-table
              v-if="isChannelSortingByKeyword"
              :columns="channelColumns"
              :data="filteredChannels"
              :bordered="false"
              :single-line="false"
            />

            <div v-else class="channel-sort-board">
              <div class="channel-sort-board__head">
                <span class="channel-sort-board__title">渠道顺序</span>
                <span class="channel-sort-board__desc">
                  拖拽左侧手柄调整顺序，保存后用户侧渠道展示顺序会同步更新。
                </span>
              </div>

              <draggable
                v-model="channels"
                item-key="id"
                handle=".channel-sort-card__handle"
                ghost-class="channel-sort-card--ghost"
                chosen-class="channel-sort-card--chosen"
                class="channel-sort-list"
                @end="handleChannelSortEnd"
              >
                <template #item="{ element: channel, index }">
                  <div class="channel-sort-card">
                    <div class="channel-sort-card__main">
                      <button
                        type="button"
                        class="channel-sort-card__handle"
                        :disabled="sortingChannels"
                        title="拖拽调整顺序"
                      >
                        <Icon icon="mdi:drag-vertical" class="h-5 w-5" />
                      </button>

                      <div class="channel-sort-card__content">
                        <div class="channel-sort-card__title-row">
                          <span class="channel-sort-card__index">{{ index + 1 }}</span>
                          <span class="channel-sort-card__name">{{
                            channel.name || '未命名渠道'
                          }}</span>
                        </div>
                        <div class="channel-sort-card__meta">
                          <n-tag size="small" :bordered="false" round type="info">
                            {{ channel.juliang.buildConfig.microAppName || '未配置小程序名称' }}
                          </n-tag>
                          <n-tag size="small" :bordered="false" round>
                            {{
                              channel.juliang.buildConfig.useNewMicroAppAssetFlow
                                ? '新版资产流程'
                                : '老版资产流程'
                            }}
                          </n-tag>
                          <n-tag
                            size="small"
                            :bordered="false"
                            round
                            :type="getAdvanceRuleSummary(channel.juliang.buildConfig).tagType"
                          >
                            {{ getAdvanceRuleSummary(channel.juliang.buildConfig).tagLabel }}
                          </n-tag>
                        </div>
                      </div>
                    </div>

                    <div class="channel-sort-card__actions">
                      <n-button
                        size="small"
                        tertiary
                        :disabled="sortingChannels"
                        @click="openChannelModal(channel)"
                      >
                        编辑
                      </n-button>
                      <n-button
                        size="small"
                        tertiary
                        type="error"
                        :disabled="sortingChannels"
                        @click="confirmDeleteChannel(channel)"
                      >
                        删除
                      </n-button>
                    </div>
                  </div>
                </template>
              </draggable>

              <div v-if="sortingChannels" class="channel-sort-board__saving">
                正在保存渠道顺序...
              </div>
            </div>
          </n-tab-pane>
          <n-tab-pane name="douyin-accounts" tab="抖音号配置">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <n-input
                v-model:value="douyinAccountKeyword"
                clearable
                placeholder="搜索用户、抖音号名称或合作码"
                class="max-w-sm"
              />
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm text-slate-500">
                  这里按用户维护抖音号名称、抖音号 ID
                  和合作码，渠道里的抖音号匹配素材会直接复用这份列表。
                </p>
                <n-button
                  size="small"
                  tertiary
                  @click="setAllDouyinAccountUsersExpanded(!hasExpandedDouyinAccountUsers)"
                >
                  {{ hasExpandedDouyinAccountUsers ? '全部收起' : '全部展开' }}
                </n-button>
              </div>
            </div>

            <div v-if="filteredDouyinAccountUsers.length > 0" class="space-y-4">
              <section
                v-for="user in filteredDouyinAccountUsers"
                :key="user.id"
                class="douyin-account-user-card"
              >
                <div
                  class="douyin-account-user-card__head"
                  role="button"
                  tabindex="0"
                  @click="toggleDouyinAccountUserExpanded(user.id)"
                  @keydown.enter.prevent="toggleDouyinAccountUserExpanded(user.id)"
                  @keydown.space.prevent="toggleDouyinAccountUserExpanded(user.id)"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="douyin-account-user-card__title">
                        {{ user.nickname || user.account || '未命名用户' }}
                      </h3>
                      <n-tag size="small" :bordered="false" round>
                        {{ user.account || '未配置账号' }}
                      </n-tag>
                      <n-tag size="small" :bordered="false" round type="info">
                        {{ getDouyinAccountDrafts(user.id).length }} 个抖音号
                      </n-tag>
                    </div>
                    <div class="douyin-account-user-card__preview-list" @click.stop>
                      <template v-if="getDouyinAccountDrafts(user.id).length > 0">
                        <button
                          type="button"
                          class="douyin-account-user-card__preview-chip"
                          :class="{
                            'douyin-account-user-card__preview-chip--active':
                              !getSelectedDouyinAccountId(user.id),
                          }"
                          @click="selectDouyinAccountPreview(user.id)"
                        >
                          全部
                        </button>
                        <span
                          v-for="accountItem in getDouyinAccountDrafts(user.id)"
                          :key="accountItem.id"
                          class="douyin-account-user-card__preview-chip"
                          :class="{
                            'douyin-account-user-card__preview-chip--active':
                              getSelectedDouyinAccountId(user.id) === accountItem.id,
                          }"
                          role="button"
                          tabindex="0"
                          @click="selectDouyinAccountPreview(user.id, accountItem.id)"
                          @keydown.enter.prevent="
                            selectDouyinAccountPreview(user.id, accountItem.id)
                          "
                          @keydown.space.prevent="
                            selectDouyinAccountPreview(user.id, accountItem.id)
                          "
                        >
                          {{ accountItem.douyinAccount || '未命名抖音号' }}
                        </span>
                      </template>
                      <span v-else class="douyin-account-user-card__preview-empty">暂无抖音号</span>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2" @click.stop>
                    <n-button
                      size="small"
                      tertiary
                      @click="toggleDouyinAccountUserExpanded(user.id)"
                    >
                      {{ isDouyinAccountUserExpanded(user.id) ? '收起' : '展开' }}
                    </n-button>
                    <n-button tertiary type="primary" @click="addDouyinAccountDraft(user.id)">
                      新增抖音号
                    </n-button>
                    <n-button
                      type="primary"
                      :loading="savingDouyinAccountUserId === user.id"
                      @click="saveDouyinAccounts(user)"
                    >
                      保存
                    </n-button>
                  </div>
                </div>

                <div
                  v-if="
                    isDouyinAccountUserExpanded(user.id) &&
                    getFilteredDouyinAccountDrafts(user.id).length > 0
                  "
                  class="douyin-account-user-card__list"
                >
                  <div
                    v-for="accountItem in getFilteredDouyinAccountDrafts(user.id)"
                    :key="accountItem.id"
                    class="douyin-account-row"
                  >
                    <div class="douyin-account-row__head">
                      <span class="douyin-account-row__title">
                        {{ accountItem.douyinAccount || '新抖音号' }}
                      </span>
                      <n-button
                        quaternary
                        circle
                        size="small"
                        type="error"
                        @click="
                          removeDouyinAccountDraft(
                            user.id,
                            getDouyinAccountDrafts(user.id).findIndex(
                              item => item.id === accountItem.id
                            )
                          )
                        "
                      >
                        <template #icon>
                          <Icon icon="mdi:close" />
                        </template>
                      </n-button>
                    </div>
                    <n-input
                      v-model:value="accountItem.douyinAccount"
                      placeholder="请输入抖音号名称"
                    />
                    <n-input
                      v-model:value="accountItem.douyinAccountId"
                      placeholder="请输入抖音号 ID"
                    />
                    <n-input
                      v-model:value="accountItem.cooperationCode"
                      placeholder="请输入合作码"
                    />
                  </div>
                </div>

                <div
                  v-else-if="isDouyinAccountUserExpanded(user.id)"
                  class="douyin-account-user-card__empty"
                >
                  当前用户还没有配置抖音号，点击右上角“新增抖音号”开始维护。
                </div>
              </section>
            </div>

            <div
              v-else
              class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500"
            >
              没有匹配到搜索结果，换个关键词试试。
            </div>
          </n-tab-pane>
          <n-tab-pane name="download-center" tab="下载中心配置">
            <div class="mb-4 flex items-center justify-between gap-3">
              <n-input
                v-model:value="downloadCenterKeyword"
                clearable
                placeholder="搜索常读名称或所属人"
                class="max-w-sm"
              />
              <n-button type="primary" @click="openDownloadCenterModal()">新增配置</n-button>
            </div>

            <n-data-table
              :columns="downloadCenterColumns"
              :data="filteredDownloadCenterConfigs"
              :bordered="false"
              :single-line="false"
            />
          </n-tab-pane>
        </n-tabs>
      </n-card>
    </main>

    <n-drawer
      v-model:show="showUserModal"
      placement="right"
      :width="userDrawerWidth"
      class="admin-form-drawer"
    >
      <n-drawer-content closable body-content-style="padding: 0">
        <template #header>
          <div class="drawer-hero drawer-hero--user">
            <div class="drawer-hero__icon">
              <Icon icon="mdi:account-cog-outline" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="drawer-hero__eyebrow">用户配置</p>
              <h2 class="drawer-hero__title">
                {{ editingUserId ? '编辑用户' : '新增用户' }}
              </h2>
              <!-- <p class="drawer-hero__desc"> -->
              <!--   统一维护账号、渠道权限和运行时配置，页面上下文会保留在右侧抽屉中。 -->
              <!-- </p> -->
              <div class="drawer-hero__meta">
                <span class="drawer-hero__pill">
                  <Icon icon="mdi:account-circle-outline" class="h-4 w-4" />
                  {{ userForm.nickname || userForm.account || '未命名用户' }}
                </span>
                <span class="drawer-hero__pill">
                  <Icon icon="mdi:source-branch" class="h-4 w-4" />
                  {{ selectedUserChannelForms.length }} 个渠道配置
                </span>
              </div>
            </div>
          </div>
        </template>

        <div class="admin-form-drawer__body">
          <div class="admin-form-drawer__content space-y-5">
            <section class="drawer-panel drawer-panel--muted">
              <div class="panel-head">
                <div class="panel-head__icon panel-head__icon--blue">
                  <Icon icon="mdi:badge-account-horizontal-outline" class="h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="panel-head__eyebrow text-blue-600">基础信息</p>
                  <h3 class="panel-head__title">账号与渠道归属</h3>
                  <!-- <p class="panel-head__desc"> -->
                  <!--   先确认昵称、登录账号、身份类型和默认渠道，再继续配置分渠道能力。 -->
                  <!-- </p> -->
                </div>
              </div>
              <n-form
                :model="userForm"
                label-placement="top"
                autocomplete="off"
                class="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                <n-form-item label="昵称">
                  <n-input v-model:value="userForm.nickname" placeholder="请输入昵称" />
                </n-form-item>
                <n-form-item label="账号">
                  <n-input
                    v-model:value="userForm.account"
                    placeholder="请输入账号"
                    :input-props="{
                      autocomplete: 'off',
                      name: 'studio-user-account',
                    }"
                  />
                </n-form-item>
                <n-form-item label="业务前缀" class="md:col-span-2">
                  <div class="space-y-2">
                    <n-input v-model:value="userForm.brandName" placeholder="默认小红" />
                    <p class="text-xs text-slate-500">
                      用到账户备注、推广链命名、搭建流程中的项目和广告命名。
                    </p>
                  </div>
                </n-form-item>
                <n-form-item label="密码">
                  <n-input
                    v-model:value="userForm.password"
                    type="password"
                    show-password-on="click"
                    placeholder="留空表示不修改密码"
                    :input-props="{
                      autocomplete: 'new-password',
                      name: 'studio-user-password',
                    }"
                  />
                </n-form-item>
                <n-form-item label="用户类型">
                  <n-select v-model:value="userForm.userType" :options="userTypeOptions" />
                </n-form-item>
                <n-form-item label="可访问渠道">
                  <n-select
                    v-model:value="userForm.channelIds"
                    :options="channelOptions"
                    clearable
                    multiple
                    placeholder="请选择可访问渠道"
                  />
                </n-form-item>
                <n-form-item label="默认渠道">
                  <n-select
                    v-model:value="userForm.defaultChannelId"
                    :options="defaultChannelOptions"
                    clearable
                    placeholder="请选择默认渠道"
                  />
                </n-form-item>
              </n-form>
            </section>

            <section class="drawer-panel drawer-panel--white">
              <div class="panel-head">
                <div class="panel-head__icon panel-head__icon--emerald">
                  <Icon icon="mdi:tune-variant" class="h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="panel-head__eyebrow text-emerald-600">按渠道配置</p>
                  <h3 class="panel-head__title">运行时业务参数</h3>
                  <!-- <p class="panel-head__desc"> -->
                  <!--   同一个用户可以在不同渠道下分别配置飞书表和抖音匹配素材，运行时会跟随当前渠道切换。 -->
                  <!-- </p> -->
                </div>
              </div>
              <div v-if="selectedUserChannelForms.length > 0" class="space-y-4">
                <div
                  v-for="item in selectedUserChannelForms"
                  :key="item.channel.id"
                  class="channel-config-card"
                >
                  <div
                    class="channel-config-card__head"
                    role="button"
                    tabindex="0"
                    @click="toggleUserChannelSection(item.channel.id)"
                    @keydown.enter.prevent="toggleUserChannelSection(item.channel.id)"
                    @keydown.space.prevent="toggleUserChannelSection(item.channel.id)"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="channel-config-card__title">{{ item.channel.name }}</p>
                        <n-tag
                          v-if="userForm.defaultChannelId === item.channel.id"
                          size="small"
                          type="success"
                          bordered
                        >
                          默认渠道
                        </n-tag>
                      </div>
                      <p class="channel-config-card__desc">
                        当前渠道下的飞书表、素材预览、权限和抖音素材映射都会独立生效。
                      </p>
                    </div>
                    <div class="channel-config-card__meta">
                      <span class="channel-config-card__pill">
                        <Icon icon="mdi:television-play" class="h-4 w-4" />
                        {{ item.config.enabled ? '专属配置已启用' : '仅查看数据' }}
                      </span>
                      <span class="channel-config-card__pill">
                        <Icon icon="mdi:link-variant" class="h-4 w-4" />
                        {{ countConfiguredMaterialMatches(item.config.douyinMaterialMatches) }}
                        条有效规则
                      </span>
                      <button
                        type="button"
                        class="channel-config-card__toggle"
                        @click.stop="toggleUserChannelSection(item.channel.id)"
                      >
                        <Icon
                          :icon="
                            isUserChannelSectionExpanded(item.channel.id)
                              ? 'mdi:chevron-up'
                              : 'mdi:chevron-down'
                          "
                          class="h-4 w-4"
                        />
                        {{
                          isUserChannelSectionExpanded(item.channel.id) ? '收起配置' : '展开配置'
                        }}
                      </button>
                    </div>
                  </div>
                  <div class="channel-config-card__switch" @click.stop>
                    <div>
                      <p class="channel-config-card__switch-title">启用专属配置</p>
                      <p class="channel-config-card__switch-desc">
                        打开后才会展示并启用当前渠道下的飞书、素材预览、权限和抖音匹配素材配置。
                      </p>
                    </div>
                    <div class="channel-config-card__switch-actions">
                      <n-select
                        :value="userChannelReuseSourceIds[item.channel.id] || null"
                        :options="getUserChannelReuseOptions(item.channel.id)"
                        clearable
                        placeholder="复用渠道"
                        class="channel-config-card__reuse-select"
                        @update:value="handleUserChannelReuseSelect(item.channel.id, $event)"
                      />
                      <n-switch
                        :value="item.config.enabled"
                        @update:value="
                          (value: boolean) =>
                            handleUserChannelEnabledChange(item.channel.id, item.config, value)
                        "
                      />
                    </div>
                  </div>
                  <div v-if="isUserChannelSectionExpanded(item.channel.id)" class="mt-1">
                    <div class="config-subpanel">
                      <div class="config-subpanel__head">
                        <div>
                          <p class="text-sm font-semibold text-emerald-600">飞书表格 ID</p>
                          <p class="mt-1 text-sm text-slate-500">
                            为当前渠道配置剧集清单、剧集状态和账户表的 table_id。
                          </p>
                        </div>
                      </div>
                      <n-form
                        :model="item.config"
                        label-placement="top"
                        class="grid grid-cols-1 gap-3 md:grid-cols-2"
                      >
                        <n-form-item label="剧集清单 table_id">
                          <n-input
                            v-model:value="item.config.feishu.dramaListTableId"
                            placeholder="请输入剧集清单 table_id"
                          />
                        </n-form-item>
                        <n-form-item label="剧集状态 table_id">
                          <n-input
                            v-model:value="item.config.feishu.dramaStatusTableId"
                            placeholder="请输入剧集状态 table_id"
                          />
                        </n-form-item>
                        <n-form-item label="账户 table_id" class="md:col-span-2">
                          <n-input
                            v-model:value="item.config.feishu.accountTableId"
                            placeholder="请输入账户 table_id"
                          />
                        </n-form-item>
                      </n-form>
                    </div>

                    <div class="config-subpanel config-subpanel--sky">
                      <div class="config-subpanel__head config-subpanel__head--split">
                        <div>
                          <p class="text-sm font-semibold text-sky-600">素材预览</p>
                          <p class="mt-1 text-sm text-slate-500">
                            控制当前用户在当前渠道下的素材预览开关、轮询间隔和搭建时间窗口。
                          </p>
                        </div>
                        <div class="toggle-hero">
                          <div>
                            <p class="toggle-hero__title">启用素材预览</p>
                            <p class="toggle-hero__desc">
                              建议默认开启，便于预览管理器按渠道工作。
                            </p>
                          </div>
                          <n-switch v-model:value="item.config.materialPreview.enabled" />
                        </div>
                      </div>
                      <n-form
                        :model="item.config.materialPreview"
                        label-placement="top"
                        class="grid grid-cols-1 gap-3 md:grid-cols-2"
                      >
                        <n-form-item label="轮询间隔（分钟）">
                          <n-input-number
                            v-model:value="item.config.materialPreview.intervalMinutes"
                            :min="1"
                            :precision="0"
                            class="w-full"
                          />
                        </n-form-item>
                        <n-form-item label="搭建时间窗口起始（分钟前）">
                          <n-input-number
                            v-model:value="item.config.materialPreview.buildTimeWindowStart"
                            :min="1"
                            :precision="0"
                            class="w-full"
                          />
                        </n-form-item>
                        <n-form-item label="搭建时间窗口结束（分钟前）">
                          <n-input-number
                            v-model:value="item.config.materialPreview.buildTimeWindowEnd"
                            :min="0"
                            :precision="0"
                            class="w-full"
                          />
                        </n-form-item>
                      </n-form>
                    </div>

                    <div class="config-subpanel">
                      <div class="mb-3">
                        <p class="text-sm font-semibold text-amber-600">权限控制</p>
                        <p class="mt-1 text-sm text-slate-500">
                          按终端划分当前用户在当前渠道下可访问哪些工作台入口。
                        </p>
                      </div>
                      <div class="permission-groups">
                        <section class="permission-group permission-group--web">
                          <div class="permission-group__header">
                            <div>
                              <p class="permission-group__eyebrow">Web 端</p>
                              <h4 class="permission-group__title">网页工作台权限</h4>
                              <p class="permission-group__desc">
                                可控制当前用户在当前渠道下能否看到首页数据概览、数据报表，以及是否开放同步账户入口。
                              </p>
                            </div>
                          </div>
                          <div class="permission-grid">
                            <div
                              v-for="permission in webPermissionOptions"
                              :key="permission.key"
                              class="permission-card permission-card--web"
                            >
                              <div class="permission-card__body">
                                <div class="min-w-0">
                                  <div class="permission-card__title-row">
                                    <p class="permission-card__title">{{ permission.label }}</p>
                                    <span
                                      class="permission-card__badge permission-card__badge--web"
                                    >
                                      Web 端
                                    </span>
                                  </div>
                                  <p class="permission-card__meta">
                                    {{ permission.description }}
                                  </p>
                                </div>
                                <n-switch
                                  :value="item.config.permissions.webMenus[permission.key]"
                                  @update:value="
                                    (value: boolean) =>
                                      updateWebPermission(
                                        item.config.permissions.webMenus,
                                        permission.key,
                                        value
                                      )
                                  "
                                />
                              </div>
                            </div>
                            <div class="permission-card permission-card--web">
                              <div class="permission-card__body">
                                <div class="min-w-0">
                                  <div class="permission-card__title-row">
                                    <p class="permission-card__title">同步账户</p>
                                    <span
                                      class="permission-card__badge permission-card__badge--web"
                                    >
                                      Web 端
                                    </span>
                                  </div>
                                  <p class="permission-card__meta">
                                    允许进入网页工作台的同步账户入口。
                                  </p>
                                </div>
                                <n-switch v-model:value="item.config.permissions.syncAccount" />
                              </div>
                            </div>
                          </div>
                        </section>
                        <section class="permission-group permission-group--desktop">
                          <div class="permission-group__header">
                            <div>
                              <p class="permission-group__eyebrow">客户端</p>
                              <h4 class="permission-group__title">客户端入口权限</h4>
                              <p class="permission-group__desc">
                                建议优先开启前四项；“上传搭建”和“形天上传”根据实际投放流程按需开启。
                              </p>
                            </div>
                          </div>
                          <div class="permission-grid">
                            <div
                              v-for="permission in desktopPermissionOptions"
                              :key="permission.key"
                              class="permission-card"
                              :class="{
                                'permission-card--recommended': permission.recommended,
                              }"
                            >
                              <div class="permission-card__body">
                                <div class="min-w-0">
                                  <div class="permission-card__title-row">
                                    <p class="permission-card__title">
                                      {{ permission.label }}
                                    </p>
                                    <span
                                      class="permission-card__badge"
                                      :class="
                                        permission.recommended
                                          ? 'permission-card__badge--recommended'
                                          : 'permission-card__badge--optional'
                                      "
                                    >
                                      {{ permission.recommended ? '推荐开启' : '按需开启' }}
                                    </span>
                                  </div>
                                  <p class="permission-card__meta">
                                    {{ permission.description }}
                                  </p>
                                </div>
                                <n-switch
                                  :value="item.config.permissions.desktopMenus[permission.key]"
                                  @update:value="
                                    (value: boolean) =>
                                      updateDesktopPermission(
                                        item.config.permissions.desktopMenus,
                                        permission.key,
                                        value
                                      )
                                  "
                                />
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>

                    <div class="config-subpanel">
                      <div class="mb-3">
                        <p class="text-sm font-semibold text-rose-600">订单按用户统计</p>
                        <p class="mt-1 text-sm text-slate-500">
                          开启后，首页订单统计会按“推广链来源包含用户名”自动生成专属 tab，
                          并展示当前时间段该用户名对应的充值总金额。
                        </p>
                      </div>
                      <n-form
                        :model="item.config.orderUserStats"
                        label-placement="top"
                        class="grid grid-cols-1 gap-3 md:grid-cols-2"
                      >
                        <n-form-item label="启用按用户统计订单">
                          <div class="flex h-[42px] items-center">
                            <n-switch v-model:value="item.config.orderUserStats.enabled" />
                          </div>
                        </n-form-item>
                        <n-form-item label="排序方式">
                          <n-select
                            v-model:value="item.config.orderUserStats.sortMode"
                            :options="orderUserSortModeOptions"
                          />
                        </n-form-item>
                        <n-form-item label="用户名列表" class="md:col-span-2">
                          <div class="w-full space-y-3">
                            <div
                              v-if="item.config.orderUserStats.usernames.length > 0"
                              class="order-usernames-list"
                            >
                              <div
                                v-for="(username, usernameIndex) in item.config.orderUserStats
                                  .usernames"
                                :key="`${item.channel.id}-${usernameIndex}-${username}`"
                                class="order-username-chip"
                                :class="{
                                  'order-username-chip--dragging':
                                    draggedOrderUsername.channelId === item.channel.id &&
                                    draggedOrderUsername.index === usernameIndex,
                                }"
                                draggable="true"
                                @dragstart="
                                  handleOrderUsernameDragStart(item.channel.id, usernameIndex)
                                "
                                @dragend="resetOrderUsernameDrag"
                                @dragover.prevent
                                @drop="handleOrderUsernameDrop(item.channel.id, usernameIndex)"
                                @dblclick="
                                  startEditOrderUsername(item.channel.id, usernameIndex, username)
                                "
                              >
                                <template
                                  v-if="
                                    editingOrderUsername.channelId === item.channel.id &&
                                    editingOrderUsername.index === usernameIndex
                                  "
                                >
                                  <n-input
                                    :value="editingOrderUsername.value"
                                    size="small"
                                    maxlength="20"
                                    placeholder="请输入用户名"
                                    @update:value="editingOrderUsername.value = $event"
                                    @blur="submitEditOrderUsername(item.channel.id)"
                                    @keyup.enter="submitEditOrderUsername(item.channel.id)"
                                    @keyup.esc="cancelEditOrderUsername"
                                  />
                                </template>
                                <template v-else>
                                  <span class="order-username-chip__handle">⋮⋮</span>
                                  <span class="order-username-chip__text">{{ username }}</span>
                                  <button
                                    type="button"
                                    class="order-username-chip__remove"
                                    @click.stop="
                                      removeOrderUsername(item.channel.id, usernameIndex)
                                    "
                                  >
                                    删除
                                  </button>
                                </template>
                              </div>
                            </div>
                            <div v-else class="order-username-empty">
                              暂无用户名，先在下方新增，再拖拽调整顺序。
                            </div>
                            <div class="flex flex-col gap-2 md:flex-row">
                              <n-input
                                :value="orderUsernameDrafts[item.channel.id] || ''"
                                maxlength="20"
                                placeholder="输入用户名后点击新增，例如：虎哥"
                                @update:value="updateOrderUsernameDraft(item.channel.id, $event)"
                                @keyup.enter="addOrderUsername(item.channel.id)"
                              />
                              <n-button
                                tertiary
                                type="primary"
                                @click="addOrderUsername(item.channel.id)"
                              >
                                新增用户名
                              </n-button>
                            </div>
                            <p class="text-xs text-slate-400">
                              支持拖拽排序，双击用户名可直接修改。列表顺序会同步决定首页订单统计 tab
                              的展示顺序。
                            </p>
                          </div>
                        </n-form-item>
                      </n-form>
                    </div>

                    <div class="config-subpanel config-subpanel--violet">
                      <div class="config-subpanel__head config-subpanel__head--split">
                        <div>
                          <p class="text-sm font-semibold text-violet-600">抖音号匹配素材</p>
                          <p class="mt-1 text-sm text-slate-500">
                            当前渠道只维护素材序号，抖音号名称、抖音号 ID
                            和合作码统一复用该用户绑定的抖音号列表。
                          </p>
                        </div>
                        <div class="flex flex-wrap items-center justify-end gap-3">
                          <div class="toggle-hero">
                            <div>
                              <p class="toggle-hero__title">独立订单统计</p>
                              <p class="toggle-hero__desc">
                                打开后，订单统计只展示推广链来源命中当前用户已绑定抖音号名称的订单。
                              </p>
                            </div>
                            <n-switch v-model:value="item.config.independentOrderStats.enabled" />
                          </div>
                          <span class="channel-config-card__pill channel-config-card__pill--violet">
                            {{ item.config.douyinMaterialMatches.length }} 条规则
                          </span>
                          <span
                            class="channel-config-card__pill"
                            :class="
                              countConfiguredMaterialMatches(item.config.douyinMaterialMatches) > 0
                                ? 'channel-config-card__pill--success'
                                : 'channel-config-card__pill--danger'
                            "
                          >
                            {{ countConfiguredMaterialMatches(item.config.douyinMaterialMatches) }}
                            条有效规则
                          </span>
                        </div>
                      </div>

                      <div class="material-match-toolbar">
                        <n-input
                          :value="materialMatchSearchDrafts[item.channel.id] || ''"
                          clearable
                          placeholder="搜索抖音号、ID、合作码或素材序号..."
                          class="material-match-search"
                          @update:value="updateMaterialMatchSearchDraft(item.channel.id, $event)"
                        >
                          <template #prefix>
                            <Icon icon="mdi:magnify" />
                          </template>
                        </n-input>
                        <p class="material-match-toolbar__meta">
                          {{
                            getFilteredMaterialMatches(
                              item.channel.id,
                              item.config.douyinMaterialMatches
                            ).length
                          }}
                          / {{ item.config.douyinMaterialMatches.length }} 条可见
                        </p>
                      </div>

                      <div
                        v-if="userForm.douyinAccounts.length === 0"
                        class="material-match-empty-warning"
                      >
                        当前用户还没有绑定抖音号，请先到顶部“抖音号配置”里维护抖音号名称、抖音号 ID
                        和合作码。
                      </div>

                      <div
                        v-if="item.config.douyinMaterialMatches.length > 0"
                        class="material-match-list"
                      >
                        <div
                          v-for="match in getFilteredMaterialMatches(
                            item.channel.id,
                            item.config.douyinMaterialMatches
                          )"
                          :key="match.id"
                          class="material-match-card"
                        >
                          <div class="material-match-card__summary">
                            <div class="material-match-card__items">
                              <div class="material-match-card__item">
                                <Icon icon="mdi:account" class="h-4 w-4 text-slate-500" />
                                <span class="material-match-card__name">
                                  {{
                                    getMaterialMatchAccountMeta(match).douyinAccount ||
                                    '未选择抖音号'
                                  }}
                                </span>
                              </div>
                              <div
                                class="material-match-card__item material-match-card__item--muted"
                              >
                                <span class="material-match-card__label">ID</span>
                                <span>
                                  {{
                                    getMaterialMatchAccountMeta(match).douyinAccountId || '未填写'
                                  }}
                                </span>
                              </div>
                              <Icon
                                icon="mdi:arrow-right"
                                class="hidden h-4 w-4 text-slate-300 md:block"
                              />
                              <div
                                class="material-match-card__item material-match-card__item--range"
                              >
                                <Icon icon="mdi:video-outline" class="h-4 w-4 text-slate-500" />
                                <span class="material-match-card__range">
                                  {{ match.materialRange || '未填写素材序号' }}
                                </span>
                              </div>
                            </div>
                            <div class="material-match-card__actions">
                              <n-button
                                size="small"
                                @click="
                                  isEditingUserChannelMatch(item.channel.id, match.id)
                                    ? cancelEditUserChannelMatch(item.channel.id)
                                    : startEditUserChannelMatch(item.channel.id, match.id)
                                "
                              >
                                {{
                                  isEditingUserChannelMatch(item.channel.id, match.id)
                                    ? '收起'
                                    : '编辑'
                                }}
                              </n-button>
                              <n-button
                                size="small"
                                type="error"
                                tertiary
                                @click="removeUserChannelMatch(item.channel.id, match.id)"
                              >
                                删除
                              </n-button>
                            </div>
                          </div>
                          <div
                            v-if="isEditingUserChannelMatch(item.channel.id, match.id)"
                            class="material-match-card__editor"
                          >
                            <n-select
                              v-model:value="match.douyinAccountRefId"
                              :options="getUserDouyinAccountOptions()"
                              filterable
                              placeholder="请选择抖音号"
                            />
                            <n-input
                              v-model:value="match.materialRange"
                              placeholder="请输入素材序号，如 01-04"
                            />
                            <div class="material-match-card__hint">
                              抖音号ID：{{
                                getMaterialMatchAccountMeta(match).douyinAccountId || '未绑定'
                              }}
                              · 合作码：{{
                                getMaterialMatchAccountMeta(match).cooperationCode || '未填写'
                              }}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        v-else
                        class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500"
                      >
                        当前渠道暂无匹配规则，点击下方“添加规则”为已绑定抖音号补充素材序号。
                      </div>

                      <div
                        v-if="
                          item.config.douyinMaterialMatches.length > 0 &&
                          getFilteredMaterialMatches(
                            item.channel.id,
                            item.config.douyinMaterialMatches
                          ).length === 0
                        "
                        class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500"
                      >
                        没有匹配到搜索结果，换个关键词试试。
                      </div>

                      <div class="material-match-actions">
                        <n-button
                          type="primary"
                          tertiary
                          :disabled="userForm.douyinAccounts.length === 0"
                          @click="addUserChannelMatch(item.channel.id)"
                        >
                          <template #icon>
                            <Icon icon="mdi:plus" />
                          </template>
                          添加规则
                        </n-button>
                      </div>
                    </div>
                    <div v-if="!item.config.enabled" class="channel-config-card__empty">
                      当前渠道只作为数据查看渠道使用，未启用专属配置，因此不会展示飞书、素材预览、权限和抖音匹配素材配置项。
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500"
              >
                请先为用户选择可访问渠道，然后再按渠道填写飞书表和抖音匹配素材配置。
              </div>
            </section>
          </div>
        </div>

        <template #footer>
          <div class="admin-form-drawer__footer">
            <n-button @click="showUserModal = false">取消</n-button>
            <n-button type="primary" :loading="savingUser" @click="saveUser">保存</n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer
      v-model:show="showChannelModal"
      placement="right"
      :width="channelDrawerWidth"
      class="admin-form-drawer"
    >
      <n-drawer-content closable body-content-style="padding: 0">
        <template #header>
          <div class="drawer-hero drawer-hero--channel">
            <div class="drawer-hero__icon">
              <Icon icon="mdi:lan-connect" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="drawer-hero__eyebrow">渠道配置</p>
              <h2 class="drawer-hero__title">
                {{ editingChannelId ? '编辑渠道' : '新增渠道' }}
              </h2>
              <!-- <p class="drawer-hero__desc"> -->
              <!--   集中维护渠道标识、巨量投放参数、常读访问参数和 ADX 凭证。 -->
              <!-- </p> -->
              <div class="drawer-hero__meta">
                <span class="drawer-hero__pill">
                  <Icon icon="mdi:tag-outline" class="h-4 w-4" />
                  {{ channelForm.name || '未命名渠道' }}
                </span>
                <span class="drawer-hero__pill">
                  <Icon icon="mdi:rocket-launch-outline" class="h-4 w-4" />
                  {{ channelForm.juliang.buildConfig.microAppName || '待配置投放参数' }}
                </span>
              </div>
            </div>
          </div>
        </template>

        <div class="admin-form-drawer__body">
          <div class="admin-form-drawer__content space-y-5">
            <section class="drawer-panel drawer-panel--muted">
              <div class="panel-head">
                <div class="panel-head__icon panel-head__icon--blue">
                  <Icon icon="mdi:label-outline" class="h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="panel-head__eyebrow text-blue-600">基础信息</p>
                  <h3 class="panel-head__title">渠道标识</h3>
                  <!-- <p class="panel-head__desc">用于管理员后台展示、用户关联和运行时配置映射。</p> -->
                </div>
              </div>
              <n-form :model="channelForm" label-placement="top">
                <n-form-item label="渠道名称" class="mb-0">
                  <n-input v-model:value="channelForm.name" placeholder="请输入渠道名称" />
                </n-form-item>
              </n-form>

              <div class="advance-config-block">
                <div class="advance-config-block__header">
                  <div>
                    <p class="advance-config-block__title">智能搭建时机</p>
                    <p class="advance-config-block__desc">
                      命中禁提前时段的剧必须等到上架时间后才能搭建；其他时段按统一提前小时数执行。
                    </p>
                  </div>
                  <div class="advance-config-block__meta">
                    <n-tag size="small" type="info" :bordered="false" round>强约束规则</n-tag>
                    <span class="advance-config-block__summary">
                      {{ getAdvanceRuleSummary(channelForm.juliang.buildConfig).tagLabel }}，
                      {{ getAdvanceRuleSummary(channelForm.juliang.buildConfig).advanceLabel }}
                    </span>
                  </div>
                </div>

                <div class="advance-config-grid">
                  <div class="advance-config-item">
                    <p class="advance-config-item__title">禁提前上架时段</p>
                    <p class="advance-config-item__desc">
                      上架时间落在这个时段内的剧，不允许提前搭建；开始和结束填一样表示不启用。
                    </p>
                    <div class="advance-config-time-range">
                      <div class="advance-config-time-field">
                        <span class="advance-config-time-field__label">开始</span>
                        <n-select
                          :value="
                            getAdvanceHourSelectValue(
                              channelForm.juliang.buildConfig.forbiddenAdvanceStartHour
                            )
                          "
                          :options="advanceHourOptions"
                          placeholder="开始时间"
                          @update:value="
                            (value: string | null) =>
                              handleAdvanceHourChange('forbiddenAdvanceStartHour', value)
                          "
                        />
                      </div>
                      <span class="advance-config-time-range__split">至</span>
                      <div class="advance-config-time-field">
                        <span class="advance-config-time-field__label">结束</span>
                        <n-select
                          :value="
                            getAdvanceHourSelectValue(
                              channelForm.juliang.buildConfig.forbiddenAdvanceEndHour
                            )
                          "
                          :options="advanceHourEndOptions"
                          placeholder="结束时间"
                          @update:value="
                            (value: string | null) =>
                              handleAdvanceHourChange('forbiddenAdvanceEndHour', value)
                          "
                        />
                      </div>
                    </div>
                  </div>

                  <div class="advance-config-item">
                    <p class="advance-config-item__title">其他时段提前搭建</p>
                    <p class="advance-config-item__desc">
                      未命中禁提前时段的剧，统一按这个时间提前提交搭建。
                    </p>
                    <div class="advance-config-inline">
                      <n-input-number
                        :value="
                          getAdvanceHoursInputValue(
                            channelForm.juliang.buildConfig.advanceBuildHours
                          )
                        "
                        :min="0"
                        :precision="0"
                        class="w-full"
                        placeholder="默认 0"
                        @update:value="
                          (value: number | null) =>
                            handleAdvanceHoursChange('advanceBuildHours', value)
                        "
                      >
                        <template #suffix>小时</template>
                      </n-input-number>
                      <div class="advance-config-inline__tip">
                        设为 0 时，其他时段也必须等上架时间后才能搭建。
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <section class="drawer-panel drawer-panel--white">
                <div class="panel-head">
                  <div class="panel-head__icon panel-head__icon--emerald">
                    <Icon icon="mdi:bullhorn-outline" class="h-5 w-5" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="panel-head__eyebrow text-emerald-600">巨量配置</p>
                    <div class="panel-head__title-row">
                      <h3 class="panel-head__title">投放与搭建参数</h3>
                      <n-radio-group
                        v-model:value="channelForm.juliang.buildConfig.useNewMicroAppAssetFlow"
                        size="small"
                      >
                        <n-radio-button :value="false">老版</n-radio-button>
                        <n-radio-button :value="true">新版</n-radio-button>
                      </n-radio-group>
                    </div>
                    <!-- <p class="panel-head__desc"> -->
                    <!--   维护巨量 Cookie、小程序信息和创建推广链接所需的核心参数。 -->
                    <!-- </p> -->
                  </div>
                </div>
                <n-form
                  :model="channelForm"
                  label-placement="top"
                  class="grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                  <n-form-item label="巨量 Cookie" class="md:col-span-2">
                    <n-input
                      v-model:value="channelForm.juliang.cookie"
                      type="textarea"
                      :rows="3"
                      placeholder="请输入巨量 Cookie"
                    />
                  </n-form-item>
                  <n-form-item label="项目清理">
                    <n-switch
                      v-model:value="
                        channelForm.juliang.buildConfig.clearExistingProjectsBeforeBuild
                      "
                    />
                  </n-form-item>
                  <n-form-item label="账户回收">
                    <n-switch
                      v-model:value="channelForm.juliang.buildConfig.recycleAccountsWhenExhausted"
                    />
                  </n-form-item>
                  <n-form-item label="Source">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.source"
                      placeholder="请输入 Source"
                    />
                  </n-form-item>
                  <n-form-item label="productId">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.productId"
                      placeholder="请输入 productId"
                    />
                  </n-form-item>
                  <n-form-item label="productPlatformId">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.productPlatformId"
                      placeholder="请输入 productPlatformId"
                    />
                  </n-form-item>
                  <n-form-item label="landingUrl" class="md:col-span-2">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.landingUrl"
                      placeholder="请输入 landingUrl"
                    />
                  </n-form-item>
                  <n-form-item label="advertiserName">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.advertiserName"
                      placeholder="请输入 advertiserName"
                    />
                  </n-form-item>
                  <n-form-item
                    v-if="channelForm.juliang.buildConfig.useNewMicroAppAssetFlow"
                    label="ebpid"
                  >
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.ebpid"
                      placeholder="请输入 ebpid"
                    />
                  </n-form-item>
                  <n-form-item label="microAppName">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.microAppName"
                      placeholder="请输入小程序名称"
                    />
                  </n-form-item>
                  <n-form-item label="microAppId">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.microAppId"
                      placeholder="请输入 microAppId"
                    />
                  </n-form-item>
                  <n-form-item label="microAppInstanceId">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.microAppInstanceId"
                      placeholder="请输入 microAppInstanceId"
                    />
                  </n-form-item>
                  <n-form-item
                    v-if="!channelForm.juliang.buildConfig.useNewMicroAppAssetFlow"
                    label="ccId"
                  >
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.ccId"
                      placeholder="请输入 ccId"
                    />
                  </n-form-item>
                  <n-form-item label="rechargeTemplateId">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.rechargeTemplateId"
                      placeholder="请输入 rechargeTemplateId"
                    />
                  </n-form-item>
                  <n-form-item label="adCallbackConfigId">
                    <n-input
                      v-model:value="channelForm.juliang.buildConfig.adCallbackConfigId"
                      placeholder="默认 1845407746151576，留空则创建推广链接时不传"
                    />
                  </n-form-item>
                </n-form>
              </section>

              <section class="drawer-panel drawer-panel--white">
                <div class="panel-head">
                  <div class="panel-head__icon panel-head__icon--violet">
                    <Icon icon="mdi:key-chain-variant" class="h-5 w-5" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="panel-head__eyebrow text-violet-600">常读配置</p>
                    <h3 class="panel-head__title">渠道访问参数</h3>
                    <!-- <p class="panel-head__desc"> -->
                    <!--   统一维护 Secret Key、常读 Cookie、账号标识和 ADX 访问凭证。 -->
                    <!-- </p> -->
                  </div>
                </div>
                <n-form
                  :model="channelForm"
                  label-placement="top"
                  class="grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                  <n-form-item label="常读 Cookie" class="md:col-span-2">
                    <n-input
                      v-model:value="channelForm.changdu.cookie"
                      type="textarea"
                      :rows="3"
                      placeholder="请输入常读 Cookie"
                    />
                  </n-form-item>
                  <n-form-item label="Secret Key">
                    <n-input
                      v-model:value="channelForm.changdu.secretKey"
                      placeholder="请输入 Secret Key"
                    />
                  </n-form-item>
                  <n-form-item label="appId">
                    <n-input v-model:value="channelForm.changdu.appId" placeholder="请输入 appId" />
                  </n-form-item>
                  <n-form-item label="distributorId">
                    <n-input
                      v-model:value="channelForm.changdu.distributorId"
                      placeholder="请输入 distributorId"
                    />
                  </n-form-item>
                  <n-form-item label="adUserId">
                    <n-input
                      v-model:value="channelForm.changdu.adUserId"
                      placeholder="请输入 adUserId"
                    />
                  </n-form-item>
                  <n-form-item label="rootAdUserId" class="md:col-span-2">
                    <n-input
                      v-model:value="channelForm.changdu.rootAdUserId"
                      placeholder="请输入 rootAdUserId"
                    />
                  </n-form-item>
                  <n-form-item label="ADX Cookie" class="md:col-span-2">
                    <n-input
                      v-model:value="channelForm.adx.cookie"
                      type="textarea"
                      :rows="3"
                      placeholder="请输入 ADX Cookie"
                    />
                  </n-form-item>
                </n-form>
              </section>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="admin-form-drawer__footer">
            <n-button @click="showChannelModal = false">取消</n-button>
            <n-button type="primary" :loading="savingChannel" @click="saveChannel">保存</n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>

    <n-drawer
      v-model:show="showDownloadCenterModal"
      placement="right"
      :width="downloadCenterDrawerWidth"
      class="admin-form-drawer"
    >
      <n-drawer-content closable body-content-style="padding: 0">
        <template #header>
          <div class="drawer-hero drawer-hero--channel">
            <div class="drawer-hero__icon">
              <Icon icon="mdi:download-network-outline" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="drawer-hero__eyebrow">下载中心配置</p>
              <h2 class="drawer-hero__title">
                {{ editingDownloadCenterId ? '编辑下载中心配置' : '新增下载中心配置' }}
              </h2>
              <p class="drawer-hero__desc">
                管理常读下载中心鉴权参数，服务端在请求 task_list 时会优先使用默认配置。
              </p>
            </div>
          </div>
        </template>

        <div class="admin-form-drawer__body">
          <div class="admin-form-drawer__content space-y-5">
            <section class="drawer-panel drawer-panel--muted">
              <div class="panel-head">
                <div class="panel-head__icon panel-head__icon--violet">
                  <Icon icon="mdi:card-account-details-outline" class="h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="panel-head__eyebrow text-violet-600">基础信息</p>
                  <h3 class="panel-head__title">配置标识</h3>
                  <p class="panel-head__desc">
                    常读名称和所属人用于后台识别。设置为默认后，服务端下载中心请求会优先读取这条配置。
                  </p>
                </div>
              </div>
              <n-form
                :model="downloadCenterForm"
                label-placement="top"
                class="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                <n-form-item label="常读名称">
                  <n-input v-model:value="downloadCenterForm.name" placeholder="请输入常读名称" />
                </n-form-item>
                <n-form-item label="所属人">
                  <n-input v-model:value="downloadCenterForm.owner" placeholder="请输入所属人" />
                </n-form-item>
                <n-form-item label="设为默认" class="md:col-span-2">
                  <div class="flex h-[42px] items-center gap-3">
                    <n-switch v-model:value="downloadCenterForm.isDefault" />
                    <span class="text-sm text-slate-500">
                      {{
                        downloadCenterConfigs.length <= 1
                          ? '当前仅有一条配置，保存后会自动设为默认'
                          : '默认配置会被服务端优先用于下载中心 task_list 请求'
                      }}
                    </span>
                  </div>
                </n-form-item>
              </n-form>
            </section>

            <section class="drawer-panel drawer-panel--white">
              <div class="panel-head">
                <div class="panel-head__icon panel-head__icon--blue">
                  <Icon icon="mdi:key-link" class="h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="panel-head__eyebrow text-blue-600">常读配置</p>
                  <h3 class="panel-head__title">渠道访问参数</h3>
                  <p class="panel-head__desc">
                    这里维护常读平台下载中心所需的关键鉴权字段，字段含义与现有常读配置保持一致。
                  </p>
                </div>
              </div>
              <n-form
                :model="downloadCenterForm"
                label-placement="top"
                class="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                <n-form-item label="Secret Key">
                  <n-input
                    v-model:value="downloadCenterForm.secretKey"
                    placeholder="请输入 Secret Key"
                  />
                </n-form-item>
                <n-form-item label="appId">
                  <n-input v-model:value="downloadCenterForm.appId" placeholder="请输入 appId" />
                </n-form-item>
                <n-form-item label="常读 Cookie" class="md:col-span-2">
                  <n-input
                    v-model:value="downloadCenterForm.cookie"
                    type="textarea"
                    :rows="4"
                    placeholder="请输入常读 Cookie"
                  />
                </n-form-item>
                <n-form-item label="distributorId">
                  <n-input
                    v-model:value="downloadCenterForm.distributorId"
                    placeholder="请输入 distributorId"
                  />
                </n-form-item>
                <n-form-item label="adUserId">
                  <n-input
                    v-model:value="downloadCenterForm.adUserId"
                    placeholder="请输入 adUserId"
                  />
                </n-form-item>
                <n-form-item label="rootAdUserId" class="md:col-span-2">
                  <n-input
                    v-model:value="downloadCenterForm.rootAdUserId"
                    placeholder="请输入 rootAdUserId"
                  />
                </n-form-item>
              </n-form>
            </section>
          </div>
        </div>

        <template #footer>
          <div class="admin-form-drawer__footer">
            <n-button @click="showDownloadCenterModal = false">取消</n-button>
            <n-button
              type="primary"
              :loading="savingDownloadCenter"
              @click="saveDownloadCenterConfig"
            >
              保存
            </n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
  NTabs,
  NTabPane,
  NTag,
  useDialog,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import draggable from 'vuedraggable'
import * as adminApi from '@/api/admin'
import { useSessionStore } from '@/stores/session'
import { useApiConfigStore } from '@/stores/apiConfig'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const sessionStore = useSessionStore()
const apiConfigStore = useApiConfigStore()

const users = ref<adminApi.UserProfile[]>([])
const channels = ref<adminApi.ChannelConfig[]>([])
const downloadCenterConfigs = ref<adminApi.DownloadCenterConfig[]>([])
const overview = ref({
  userCount: 0,
  channelCount: 0,
  adminCount: 0,
  normalCount: 0,
})
const userKeyword = ref('')
const channelKeyword = ref('')
const douyinAccountKeyword = ref('')
const downloadCenterKeyword = ref('')
const showUserModal = ref(false)
const showChannelModal = ref(false)
const showDownloadCenterModal = ref(false)
const editingUserId = ref('')
const editingChannelId = ref('')
const editingDownloadCenterId = ref('')
const savingUser = ref(false)
const savingChannel = ref(false)
const savingDownloadCenter = ref(false)
const savingDouyinAccountUserId = ref('')
const sortingChannels = ref(false)
const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
const orderUsernameDrafts = reactive<Record<string, string>>({})
const douyinAccountDrafts = reactive<Record<string, adminApi.DouyinAccount[]>>({})
const douyinAccountExpandedState = reactive<Record<string, boolean>>({})
const selectedDouyinAccountByUser = reactive<Record<string, string>>({})
const materialMatchSearchDrafts = reactive<Record<string, string>>({})
const editingMaterialMatchIds = reactive<Record<string, string>>({})
const userChannelExpandedState = reactive<Record<string, boolean>>({})
const userChannelReuseSourceIds = reactive<Record<string, string>>({})
const draggedOrderUsername = reactive({
  channelId: '',
  index: -1,
})
const editingOrderUsername = reactive({
  channelId: '',
  index: -1,
  value: '',
})

interface UserFormModel {
  nickname: string
  account: string
  brandName: string
  password: string
  userType: 'admin' | 'normal'
  channelIds: string[]
  defaultChannelId: string
  douyinAccounts: adminApi.DouyinAccount[]
  channelConfigs: Record<string, adminApi.UserChannelBindingConfig>
  feishu: {
    dramaListTableId: string
    dramaStatusTableId: string
    accountTableId: string
  }
}

interface ChannelFormModel {
  name: string
  juliang: adminApi.ChannelConfig['juliang']
  changdu: adminApi.ChannelConfig['changdu']
  adx: NonNullable<adminApi.ChannelConfig['adx']>
}

interface DownloadCenterConfigFormModel {
  name: string
  owner: string
  secretKey: string
  appId: string
  cookie: string
  distributorId: string
  adUserId: string
  rootAdUserId: string
  isDefault: boolean
}

type DesktopPermissionKey = keyof adminApi.UserChannelBindingConfig['permissions']['desktopMenus']
type WebPermissionKey = keyof adminApi.UserChannelBindingConfig['permissions']['webMenus']
type BuildAdvanceHoursField = 'advanceBuildHours'
type BuildAdvanceHourField = 'forbiddenAdvanceStartHour' | 'forbiddenAdvanceEndHour'

const userForm = reactive<UserFormModel>(createDefaultUserForm())
const channelForm = reactive<ChannelFormModel>(createDefaultChannelForm())
const downloadCenterForm = reactive<DownloadCenterConfigFormModel>(
  createDefaultDownloadCenterForm()
)

const userTypeOptions = [
  { label: '管理员', value: 'admin' },
  { label: '普通用户', value: 'normal' },
]
const advanceHourOptions = Array.from({ length: 24 }, (_, hour) => ({
  label: `${String(hour).padStart(2, '0')}:00`,
  value: String(hour),
}))
const advanceHourEndOptions = [...advanceHourOptions, { label: '24:00', value: '24' }]
const webPermissionOptions: Array<{
  key: WebPermissionKey
  label: string
  description: string
}> = [
  {
    key: 'overview',
    label: '数据概览',
    description: '控制首页顶部数据概览卡片是否展示。',
  },
  {
    key: 'report',
    label: '数据报表',
    description: '控制首页充值日报表格是否展示。',
  },
  {
    key: 'buildSubmit',
    label: '提交搭建',
    description: '控制首页“提交搭建”按钮是否展示。',
  },
]
const desktopPermissionOptions: Array<{
  key: DesktopPermissionKey
  label: string
  description: string
  recommended: boolean
}> = [
  {
    key: 'download',
    label: '剧目下载',
    description: '推荐开启，用于客户端剧目拉取与下载。',
    recommended: true,
  },
  {
    key: 'materialClip',
    label: '素材剪辑',
    description: '推荐开启，用于客户端素材处理与剪辑。',
    recommended: true,
  },
  {
    key: 'juliangUpload',
    label: '巨量上传',
    description: '推荐开启，用于客户端内提交巨量上传任务。',
    recommended: true,
  },
  {
    key: 'juliangBuild',
    label: '巨量搭建',
    description: '推荐开启，用于客户端内执行巨量搭建流程。',
    recommended: true,
  },
  {
    key: 'uploadBuild',
    label: '上传搭建',
    description: '按需开启，适用于需要上传后直接发起搭建的流程。',
    recommended: false,
  },
  {
    key: 'upload',
    label: '形天上传',
    description: '按需开启，适用于需要走形天上传链路的场景。',
    recommended: false,
  },
]
const orderUserSortModeOptions = [
  { label: '按当前顺序排序', value: 'manual' },
  { label: '按充值金额排序', value: 'amount_desc' },
]

const channelOptions = computed(() =>
  channels.value.map(channel => ({ label: channel.name, value: channel.id }))
)
const selectedUserChannels = computed(() =>
  channels.value.filter(
    channel => Array.isArray(userForm.channelIds) && userForm.channelIds.includes(channel.id)
  )
)
const selectedUserChannelForms = computed(() =>
  selectedUserChannels.value
    .map(channel => {
      const config = userForm.channelConfigs[channel.id]
      if (!config) {
        return null
      }

      return {
        channel,
        config,
      }
    })
    .filter(
      (
        item
      ): item is {
        channel: adminApi.ChannelConfig
        config: adminApi.UserChannelBindingConfig
      } => item !== null
    )
)
const defaultChannelOptions = computed(() =>
  channels.value
    .filter(
      channel => Array.isArray(userForm.channelIds) && userForm.channelIds.includes(channel.id)
    )
    .map(channel => ({ label: channel.name, value: channel.id }))
)
const userDrawerWidth = computed(() => {
  if (viewportWidth.value <= 768) {
    return Math.max(viewportWidth.value - 16, 280)
  }

  return 980
})
const channelDrawerWidth = computed(() => {
  if (viewportWidth.value <= 768) {
    return Math.max(viewportWidth.value - 16, 280)
  }

  return 1080
})
const downloadCenterDrawerWidth = computed(() => {
  if (viewportWidth.value <= 768) {
    return Math.max(viewportWidth.value - 16, 280)
  }

  return 860
})

const overviewCards = computed(() => [
  { label: '用户总数', value: overview.value.userCount },
  { label: '渠道总数', value: overview.value.channelCount },
  { label: '管理员', value: overview.value.adminCount },
  { label: '普通用户', value: overview.value.normalCount },
])

const filteredUsers = computed(() => {
  const keyword = userKeyword.value.trim().toLowerCase()
  if (!keyword) return users.value
  return users.value.filter(
    user =>
      user.nickname.toLowerCase().includes(keyword) || user.account.toLowerCase().includes(keyword)
  )
})

const filteredChannels = computed(() => {
  const keyword = channelKeyword.value.trim().toLowerCase()
  if (!keyword) return channels.value
  return channels.value.filter(channel => channel.name.toLowerCase().includes(keyword))
})
const isChannelSortingByKeyword = computed(() => Boolean(channelKeyword.value.trim()))
const filteredDouyinAccountUsers = computed(() => {
  const keyword = douyinAccountKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return users.value
  }

  return users.value.filter(user => {
    const draftAccounts = Array.isArray(douyinAccountDrafts[user.id])
      ? douyinAccountDrafts[user.id]
      : user.douyinAccounts
    return (
      user.nickname.toLowerCase().includes(keyword) ||
      user.account.toLowerCase().includes(keyword) ||
      draftAccounts.some(account =>
        [account.douyinAccount, account.douyinAccountId, account.cooperationCode]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(keyword))
      )
    )
  })
})
const hasExpandedDouyinAccountUsers = computed(() =>
  filteredDouyinAccountUsers.value.some(user => isDouyinAccountUserExpanded(user.id))
)
const filteredDownloadCenterConfigs = computed(() => {
  const keyword = downloadCenterKeyword.value.trim().toLowerCase()
  if (!keyword) return downloadCenterConfigs.value
  return downloadCenterConfigs.value.filter(
    config =>
      config.name.toLowerCase().includes(keyword) || config.owner.toLowerCase().includes(keyword)
  )
})
const userColumns: DataTableColumns<adminApi.UserProfile> = [
  { title: '昵称', key: 'nickname' },
  { title: '账号', key: 'account' },
  {
    title: '类型',
    key: 'userType',
    render: row =>
      h(NTag, { type: row.userType === 'admin' ? 'warning' : 'success' }, () =>
        row.userType === 'admin' ? '管理员' : '普通用户'
      ),
  },
  {
    title: '渠道',
    key: 'channelNames',
    render: row => (row.channelNames?.length ? row.channelNames.join('、') : '-'),
  },
  {
    title: '默认渠道',
    key: 'defaultChannelName',
    render: row => row.defaultChannelName || '-',
  },
  {
    title: '操作',
    key: 'actions',
    render: row =>
      h('div', { class: 'flex gap-2' }, [
        h(
          NButton,
          { size: 'small', tertiary: true, onClick: () => openUserModal(row) },
          () => '编辑'
        ),
        h(
          NButton,
          { size: 'small', tertiary: true, type: 'error', onClick: () => confirmDeleteUser(row) },
          () => '删除'
        ),
      ]),
  },
]

const channelColumns: DataTableColumns<adminApi.ChannelConfig> = [
  { title: '渠道名称', key: 'name' },
  {
    title: '小程序名称',
    key: 'juliang.buildConfig.microAppName',
    render: row => row.juliang.buildConfig.microAppName || '-',
  },
  {
    title: '搭建时机规则',
    key: 'juliang.buildConfig.advanceHours',
    render: row => {
      const summary = getAdvanceRuleSummary(row.juliang.buildConfig)

      return h('div', { class: 'flex flex-wrap gap-2' }, [
        h(
          NTag,
          {
            size: 'small',
            type: summary.tagType,
            bordered: false,
            round: true,
          },
          () => summary.tagLabel
        ),
        h(
          NTag,
          {
            size: 'small',
            type: summary.advanceHours > 0 ? 'success' : 'warning',
            bordered: false,
            round: true,
          },
          () => summary.advanceLabel
        ),
      ])
    },
  },
  {
    title: '操作',
    key: 'actions',
    render: row =>
      h('div', { class: 'flex gap-2' }, [
        h(
          NButton,
          { size: 'small', tertiary: true, onClick: () => openChannelModal(row) },
          () => '编辑'
        ),
        h(
          NButton,
          {
            size: 'small',
            tertiary: true,
            type: 'error',
            onClick: () => confirmDeleteChannel(row),
          },
          () => '删除'
        ),
      ]),
  },
]
const downloadCenterColumns: DataTableColumns<adminApi.DownloadCenterConfig> = [
  {
    title: '常读名称',
    key: 'name',
    render: row =>
      h('div', { class: 'flex items-center gap-2' }, [
        h('span', row.name || '-'),
        row.isDefault
          ? h(NTag, { size: 'small', type: 'success', bordered: false }, () => '默认')
          : null,
      ]),
  },
  { title: '所属人', key: 'owner' },
  {
    title: '操作',
    key: 'actions',
    render: row =>
      h('div', { class: 'flex gap-2' }, [
        h(
          NButton,
          { size: 'small', tertiary: true, onClick: () => openDownloadCenterModal(row) },
          () => '编辑'
        ),
        h(
          NButton,
          {
            size: 'small',
            tertiary: true,
            type: 'error',
            onClick: () => confirmDeleteDownloadCenterConfig(row),
          },
          () => '删除'
        ),
      ]),
  },
]

function normalizeAdvanceHoursValue(value: string | number | null | undefined) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }
  return Math.floor(numericValue)
}

function getAdvanceHoursInputValue(value: string | number | null | undefined) {
  return normalizeAdvanceHoursValue(value)
}

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

function getAdvanceHourSelectValue(value: string | number | null | undefined) {
  return String(normalizeAdvanceHourValue(value))
}

function handleAdvanceHoursChange(field: BuildAdvanceHoursField, value: number | null) {
  channelForm.juliang.buildConfig[field] = String(normalizeAdvanceHoursValue(value))
}

function handleAdvanceHourChange(field: BuildAdvanceHourField, value: string | null) {
  channelForm.juliang.buildConfig[field] = String(normalizeAdvanceHourValue(value))
}

function formatAdvanceHourLabel(value: string | number | null | undefined) {
  return `${String(normalizeAdvanceHourValue(value)).padStart(2, '0')}:00`
}

function getAdvanceRuleSummary(
  buildConfig: adminApi.ChannelConfig['juliang']['buildConfig'] | null | undefined
) {
  const startHour = normalizeAdvanceHourValue(buildConfig?.forbiddenAdvanceStartHour)
  const endHour = normalizeAdvanceHourValue(buildConfig?.forbiddenAdvanceEndHour)
  const advanceHours = normalizeAdvanceHoursValue(buildConfig?.advanceBuildHours)
  const hasForbiddenWindow = startHour !== endHour

  return {
    advanceHours,
    hasForbiddenWindow,
    tagType: (hasForbiddenWindow ? 'warning' : advanceHours > 0 ? 'success' : 'default') as
      | 'warning'
      | 'success'
      | 'default',
    tagLabel: hasForbiddenWindow
      ? `禁提前 ${formatAdvanceHourLabel(startHour)}-${formatAdvanceHourLabel(endHour)}`
      : advanceHours > 0
        ? '全时段可提前'
        : '全时段等上架',
    advanceLabel: advanceHours > 0 ? `其他时段提前 ${advanceHours} 小时` : '其他时段也不提前搭建',
  }
}

function cloneDouyinAccounts(accounts?: adminApi.DouyinAccount[]) {
  return Array.isArray(accounts)
    ? accounts.map(account => ({
        id: String(account?.id || crypto.randomUUID()),
        douyinAccount: String(account?.douyinAccount || ''),
        douyinAccountId: String(account?.douyinAccountId || ''),
        cooperationCode: String(account?.cooperationCode || ''),
        createdAt: account?.createdAt,
        updatedAt: account?.updatedAt,
      }))
    : []
}

function createEmptyDouyinAccount(): adminApi.DouyinAccount {
  return {
    id: crypto.randomUUID(),
    douyinAccount: '',
    douyinAccountId: '',
    cooperationCode: '',
  }
}

function getDouyinAccountDrafts(userId: string) {
  if (!Array.isArray(douyinAccountDrafts[userId])) {
    const user = users.value.find(item => item.id === userId)
    douyinAccountDrafts[userId] = cloneDouyinAccounts(user?.douyinAccounts)
  }

  return douyinAccountDrafts[userId]
}

function syncDouyinAccountDrafts() {
  const userIds = new Set(users.value.map(user => user.id))

  users.value.forEach(user => {
    douyinAccountDrafts[user.id] = cloneDouyinAccounts(user.douyinAccounts)
  })

  Object.keys(douyinAccountDrafts).forEach(userId => {
    if (!userIds.has(userId)) {
      delete douyinAccountDrafts[userId]
    }
  })
}

function syncDouyinAccountExpandedState(userIds: string[]) {
  const nextUserIdSet = new Set(userIds)

  Object.keys(douyinAccountExpandedState).forEach(userId => {
    if (!nextUserIdSet.has(userId)) {
      delete douyinAccountExpandedState[userId]
    }
  })

  userIds.forEach(userId => {
    if (typeof douyinAccountExpandedState[userId] !== 'boolean') {
      douyinAccountExpandedState[userId] = false
    }
  })
}

function syncSelectedDouyinAccountState(userIds: string[]) {
  const nextUserIdSet = new Set(userIds)

  Object.keys(selectedDouyinAccountByUser).forEach(userId => {
    if (!nextUserIdSet.has(userId)) {
      delete selectedDouyinAccountByUser[userId]
      return
    }

    const drafts = getDouyinAccountDrafts(userId)
    const selectedId = String(selectedDouyinAccountByUser[userId] || '').trim()
    if (selectedId && !drafts.some(account => account.id === selectedId)) {
      selectedDouyinAccountByUser[userId] = ''
    }
  })

  userIds.forEach(userId => {
    if (typeof selectedDouyinAccountByUser[userId] !== 'string') {
      selectedDouyinAccountByUser[userId] = ''
    }
  })
}

function isDouyinAccountUserExpanded(userId: string) {
  return Boolean(douyinAccountExpandedState[userId])
}

function toggleDouyinAccountUserExpanded(userId: string) {
  douyinAccountExpandedState[userId] = !isDouyinAccountUserExpanded(userId)
}

function setAllDouyinAccountUsersExpanded(expanded: boolean) {
  filteredDouyinAccountUsers.value.forEach(user => {
    douyinAccountExpandedState[user.id] = expanded
  })
}

function getSelectedDouyinAccountId(userId: string) {
  return String(selectedDouyinAccountByUser[userId] || '').trim()
}

function selectDouyinAccountPreview(userId: string, accountId = '') {
  const nextAccountId = String(accountId || '').trim()
  const currentAccountId = getSelectedDouyinAccountId(userId)

  selectedDouyinAccountByUser[userId] = currentAccountId === nextAccountId ? '' : nextAccountId
  douyinAccountExpandedState[userId] = true
}

function getFilteredDouyinAccountDrafts(userId: string) {
  const drafts = getDouyinAccountDrafts(userId)
  const selectedId = getSelectedDouyinAccountId(userId)

  if (!selectedId) {
    return drafts
  }

  return drafts.filter(account => account.id === selectedId)
}

function addDouyinAccountDraft(userId: string) {
  const nextAccount = createEmptyDouyinAccount()
  getDouyinAccountDrafts(userId).push(nextAccount)
  selectedDouyinAccountByUser[userId] = nextAccount.id
  douyinAccountExpandedState[userId] = true
}

function removeDouyinAccountDraft(userId: string, index: number) {
  const drafts = getDouyinAccountDrafts(userId)
  if (index < 0 || index >= drafts.length) {
    return
  }

  const removedAccountId = drafts[index]?.id
  drafts.splice(index, 1)

  if (removedAccountId && getSelectedDouyinAccountId(userId) === removedAccountId) {
    selectedDouyinAccountByUser[userId] = ''
  }
}

function getUserDouyinAccountOptions(
  douyinAccounts: adminApi.DouyinAccount[] = userForm.douyinAccounts
) {
  return (Array.isArray(douyinAccounts) ? douyinAccounts : []).map(account => ({
    label: account.douyinAccount || account.douyinAccountId || '未命名抖音号',
    value: account.id,
  }))
}

function getBoundDouyinAccount(
  douyinAccountRefId: string,
  douyinAccounts: adminApi.DouyinAccount[] = userForm.douyinAccounts
) {
  return (Array.isArray(douyinAccounts) ? douyinAccounts : []).find(
    account => account.id === String(douyinAccountRefId || '').trim()
  )
}

function getMaterialMatchAccountMeta(
  match: adminApi.UserChannelBindingConfig['douyinMaterialMatches'][number],
  douyinAccounts: adminApi.DouyinAccount[] = userForm.douyinAccounts
) {
  const boundAccount = getBoundDouyinAccount(match.douyinAccountRefId, douyinAccounts)

  return {
    douyinAccount: boundAccount?.douyinAccount || String(match.douyinAccount || '').trim(),
    douyinAccountId: boundAccount?.douyinAccountId || String(match.douyinAccountId || '').trim(),
    cooperationCode: boundAccount?.cooperationCode || String(match.cooperationCode || '').trim(),
  }
}

function validateDouyinAccountDrafts(user: adminApi.UserProfile) {
  const drafts = getDouyinAccountDrafts(user.id).map(account => ({
    ...account,
    douyinAccount: String(account.douyinAccount || '').trim(),
    douyinAccountId: String(account.douyinAccountId || '').trim(),
    cooperationCode: String(account.cooperationCode || '').trim(),
  }))
  const visibleDrafts = drafts.filter(
    account => account.douyinAccount || account.douyinAccountId || account.cooperationCode
  )
  const accountNameSet = new Set<string>()
  const accountIdSet = new Set<string>()

  for (const account of visibleDrafts) {
if (accountNameSet.has(account.douyinAccount)) {
      return '同一个用户下的抖音号名称不能重复'
    }
    if (accountIdSet.has(account.douyinAccountId)) {
      return '同一个用户下的抖音号 ID 不能重复'
    }
    accountNameSet.add(account.douyinAccount)
    accountIdSet.add(account.douyinAccountId)
  }

  return null
}

async function saveDouyinAccounts(user: adminApi.UserProfile) {
  const validationError = validateDouyinAccountDrafts(user)
  if (validationError) {
    message.warning(validationError)
    return
  }

  const payload = getDouyinAccountDrafts(user.id)
    .map(account => ({
      ...account,
      douyinAccount: String(account.douyinAccount || '').trim(),
      douyinAccountId: String(account.douyinAccountId || '').trim(),
      cooperationCode: String(account.cooperationCode || '').trim(),
    }))
    .filter(account => account.douyinAccount && account.douyinAccountId && account.cooperationCode)

  savingDouyinAccountUserId.value = user.id
  try {
    await adminApi.updateUser(user.id, {
      douyinAccounts: payload,
    })
    message.success(`已保存 ${user.nickname || user.account || '该用户'} 的抖音号配置`)
    await loadData()
    await sessionStore.loadSession()
    await apiConfigStore.loadFromStorage()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存抖音号配置失败')
  } finally {
    savingDouyinAccountUserId.value = ''
  }
}

function createDefaultUserForm(): UserFormModel {
  return {
    nickname: '',
    account: '',
    brandName: '小红',
    password: '',
    userType: 'normal',
    channelIds: [],
    defaultChannelId: '',
    douyinAccounts: [],
    channelConfigs: {},
    feishu: {
      dramaListTableId: '',
      dramaStatusTableId: '',
      accountTableId: '',
    },
  }
}

function createDefaultUserChannelConfig(): adminApi.UserChannelBindingConfig {
  return {
    enabled: false,
    feishu: {
      dramaListTableId: '',
      dramaStatusTableId: '',
      accountTableId: '',
    },
    materialPreview: {
      enabled: true,
      intervalMinutes: 20,
      buildTimeWindowStart: 90,
      buildTimeWindowEnd: 20,
    },
    permissions: {
      syncAccount: false,
      webMenus: {
        overview: true,
        report: true,
        buildSubmit: true,
      },
      desktopMenus: {
        download: false,
        materialClip: false,
        upload: false,
        juliangUpload: false,
        uploadBuild: false,
        juliangBuild: false,
      },
    },
    orderUserStats: {
      enabled: false,
      sortMode: 'manual',
      usernames: [],
    },
    independentOrderStats: {
      enabled: false,
    },
    douyinMaterialMatches: [],
  }
}

function normalizeUserChannelConfig(
  config?: Partial<adminApi.UserChannelBindingConfig>
): adminApi.UserChannelBindingConfig {
  const defaultConfig = createDefaultUserChannelConfig()
  const douyinMaterialMatches = Array.isArray(config?.douyinMaterialMatches)
    ? config.douyinMaterialMatches
        .map(match => ({
          id: String(match?.id || crypto.randomUUID()),
          douyinAccountRefId: String(match?.douyinAccountRefId || ''),
          douyinAccount: String(match?.douyinAccount || ''),
          douyinAccountId: String(match?.douyinAccountId || ''),
          cooperationCode: String(match?.cooperationCode || ''),
          materialRange: String(match?.materialRange || ''),
          createdAt: match?.createdAt,
          updatedAt: match?.updatedAt,
        }))
        .filter(
          match =>
            match.douyinAccountRefId ||
            match.douyinAccount ||
            match.douyinAccountId ||
            match.cooperationCode ||
            match.materialRange
        )
    : []

  return {
    ...defaultConfig,
    ...config,
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : false,
    feishu: {
      ...defaultConfig.feishu,
      ...(config?.feishu || {}),
    },
    materialPreview: {
      ...defaultConfig.materialPreview,
      ...(config?.materialPreview || {}),
      enabled: Boolean(config?.materialPreview?.enabled),
    },
    permissions: {
      ...defaultConfig.permissions,
      ...(config?.permissions || {}),
      syncAccount: Boolean(config?.permissions?.syncAccount),
      webMenus: {
        ...defaultConfig.permissions.webMenus,
        ...(config?.permissions?.webMenus || {}),
        overview:
          typeof config?.permissions?.webMenus?.overview === 'boolean'
            ? config.permissions.webMenus.overview
            : defaultConfig.permissions.webMenus.overview,
        report:
          typeof config?.permissions?.webMenus?.report === 'boolean'
            ? config.permissions.webMenus.report
            : defaultConfig.permissions.webMenus.report,
        buildSubmit:
          typeof config?.permissions?.webMenus?.buildSubmit === 'boolean'
            ? config.permissions.webMenus.buildSubmit
            : defaultConfig.permissions.webMenus.buildSubmit,
      },
      desktopMenus: {
        ...defaultConfig.permissions.desktopMenus,
        ...(config?.permissions?.desktopMenus || {}),
        download: Boolean(config?.permissions?.desktopMenus?.download),
        materialClip: Boolean(config?.permissions?.desktopMenus?.materialClip),
        upload: Boolean(config?.permissions?.desktopMenus?.upload),
        juliangUpload: Boolean(config?.permissions?.desktopMenus?.juliangUpload),
        uploadBuild: Boolean(config?.permissions?.desktopMenus?.uploadBuild),
        juliangBuild: Boolean(config?.permissions?.desktopMenus?.juliangBuild),
      },
    },
    orderUserStats: {
      ...defaultConfig.orderUserStats,
      ...(config?.orderUserStats || {}),
      enabled: Boolean(config?.orderUserStats?.enabled),
      sortMode: config?.orderUserStats?.sortMode === 'amount_desc' ? 'amount_desc' : 'manual',
      usernames: Array.isArray(config?.orderUserStats?.usernames)
        ? config.orderUserStats.usernames
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .filter((item, index, list) => list.indexOf(item) === index)
        : [],
    },
    independentOrderStats: {
      ...defaultConfig.independentOrderStats,
      ...(config?.independentOrderStats || {}),
      enabled: Boolean(config?.independentOrderStats?.enabled),
    },
    douyinMaterialMatches,
  }
}

function cloneUserChannelConfig(
  config?: Partial<adminApi.UserChannelBindingConfig>
): adminApi.UserChannelBindingConfig {
  const normalizedConfig = normalizeUserChannelConfig(
    config ? JSON.parse(JSON.stringify(config)) : createDefaultUserChannelConfig()
  )

  return {
    ...normalizedConfig,
    feishu: {
      ...normalizedConfig.feishu,
    },
    materialPreview: {
      ...normalizedConfig.materialPreview,
    },
    permissions: {
      syncAccount: normalizedConfig.permissions.syncAccount,
      webMenus: {
        ...normalizedConfig.permissions.webMenus,
      },
      desktopMenus: {
        ...normalizedConfig.permissions.desktopMenus,
      },
    },
    orderUserStats: {
      ...normalizedConfig.orderUserStats,
      usernames: [...normalizedConfig.orderUserStats.usernames],
    },
    independentOrderStats: {
      ...normalizedConfig.independentOrderStats,
    },
    douyinMaterialMatches: normalizedConfig.douyinMaterialMatches.map(match => ({
      ...match,
      id: crypto.randomUUID(),
    })),
  }
}

function createDefaultChannelForm(): ChannelFormModel {
  return {
    name: '',
    juliang: {
      cookie: '',
      buildConfig: {
        secretKey: '',
        source: '',
        productId: '',
        productPlatformId: '',
        landingUrl: '',
        useNewMicroAppAssetFlow: false,
        clearExistingProjectsBeforeBuild: false,
        recycleAccountsWhenExhausted: false,
        advertiserName: '',
        ebpid: '',
        microAppName: '',
        microAppId: '',
        microAppInstanceId: '',
        ccId: '',
        rechargeTemplateId: '',
        adCallbackConfigId: '',
        forbiddenAdvanceStartHour: '0',
        forbiddenAdvanceEndHour: '0',
        advanceBuildHours: '0',
      },
    },
    changdu: {
      secretKey: '',
      cookie: '',
      distributorId: '',
      adUserId: '',
      rootAdUserId: '',
      appId: '',
    },
    adx: {
      cookie: '',
    },
  }
}

function createDefaultDownloadCenterForm(): DownloadCenterConfigFormModel {
  return {
    name: '',
    owner: '',
    secretKey: '',
    appId: '',
    cookie: '',
    distributorId: '',
    adUserId: '',
    rootAdUserId: '',
    isDefault: false,
  }
}

function resetUserForm() {
  const defaults = createDefaultUserForm()
  Object.keys(userForm).forEach(key => {
    const typedKey = key as keyof UserFormModel
    if (!(key in defaults)) {
      delete userForm[typedKey]
    }
  })
  Object.assign(userForm, defaults)
  Object.keys(orderUsernameDrafts).forEach(key => {
    delete orderUsernameDrafts[key]
  })
  Object.keys(materialMatchSearchDrafts).forEach(key => {
    delete materialMatchSearchDrafts[key]
  })
  Object.keys(editingMaterialMatchIds).forEach(key => {
    delete editingMaterialMatchIds[key]
  })
  Object.keys(userChannelExpandedState).forEach(key => {
    delete userChannelExpandedState[key]
  })
  Object.keys(userChannelReuseSourceIds).forEach(key => {
    delete userChannelReuseSourceIds[key]
  })
  cancelEditOrderUsername()
  resetOrderUsernameDrag()
}

function resetChannelForm() {
  Object.assign(channelForm, createDefaultChannelForm())
}

function resetDownloadCenterForm() {
  Object.assign(downloadCenterForm, createDefaultDownloadCenterForm())
}

function addUserChannelMatch(channelId: string) {
  if (!Array.isArray(userForm.douyinAccounts) || userForm.douyinAccounts.length === 0) {
    message.warning('请先在“抖音号配置”里为该用户维护抖音号')
    return
  }

  if (!userForm.channelConfigs[channelId]) {
    userForm.channelConfigs[channelId] = createDefaultUserChannelConfig()
  }

  const nextMatch = {
    id: crypto.randomUUID(),
    douyinAccountRefId: '',
    materialRange: '',
  }

  userForm.channelConfigs[channelId].douyinMaterialMatches.push(nextMatch)
  editingMaterialMatchIds[channelId] = nextMatch.id
}

function updateMaterialMatchSearchDraft(channelId: string, value: string) {
  materialMatchSearchDrafts[channelId] = value
}

function countConfiguredMaterialMatches(
  matches: adminApi.UserChannelBindingConfig['douyinMaterialMatches']
) {
  return matches.filter(
    match =>
      Boolean(getBoundDouyinAccount(match.douyinAccountRefId)) && Boolean(match.materialRange)
  ).length
}

function getUserChannelReuseOptions(channelId: string) {
  return selectedUserChannels.value
    .filter(channel => channel.id !== channelId)
    .map(channel => {
      const config = userForm.channelConfigs?.[channel.id]

      return {
        label: `${channel.name}${config?.enabled ? '（已启用）' : '（未启用）'}`,
        value: channel.id,
      }
    })
}

function copyUserChannelConfig(channelId: string) {
  const sourceChannelId = String(userChannelReuseSourceIds[channelId] || '').trim()

  if (!sourceChannelId) {
    message.warning('请先选择要复用的渠道')
    return
  }

  if (sourceChannelId === channelId) {
    message.warning('不能复用当前渠道自己的配置')
    return
  }

  const sourceConfig = userForm.channelConfigs?.[sourceChannelId]
  if (!sourceConfig) {
    message.warning('未找到要复用的渠道配置')
    return
  }

  const sourceChannelName =
    channels.value.find(channel => channel.id === sourceChannelId)?.name ||
    `渠道 ${sourceChannelId}`
  const targetChannelName =
    channels.value.find(channel => channel.id === channelId)?.name || `渠道 ${channelId}`

  userForm.channelConfigs[channelId] = cloneUserChannelConfig(sourceConfig)
  userChannelExpandedState[channelId] = true
  editingMaterialMatchIds[channelId] = ''
  materialMatchSearchDrafts[channelId] = ''
  orderUsernameDrafts[channelId] = ''

  message.success(`已将【${sourceChannelName}】配置复制到【${targetChannelName}】，后续可独立修改`)
}

function handleUserChannelReuseSelect(channelId: string, value: string | null) {
  userChannelReuseSourceIds[channelId] = String(value || '').trim()

  if (!userChannelReuseSourceIds[channelId]) {
    return
  }

  copyUserChannelConfig(channelId)
  userChannelReuseSourceIds[channelId] = ''
}

function getFilteredMaterialMatches(
  channelId: string,
  matches: adminApi.UserChannelBindingConfig['douyinMaterialMatches']
) {
  const keyword = String(materialMatchSearchDrafts[channelId] || '')
    .trim()
    .toLowerCase()

  if (!keyword) {
    return matches
  }

  return matches.filter(match => {
    const accountMeta = getMaterialMatchAccountMeta(match)

    return [
      accountMeta.douyinAccount,
      accountMeta.douyinAccountId,
      accountMeta.cooperationCode,
      match.materialRange,
    ]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(keyword))
  })
}

function startEditUserChannelMatch(channelId: string, matchId: string) {
  editingMaterialMatchIds[channelId] = matchId
}

function cancelEditUserChannelMatch(channelId: string) {
  editingMaterialMatchIds[channelId] = ''
}

function isEditingUserChannelMatch(channelId: string, matchId: string) {
  return editingMaterialMatchIds[channelId] === matchId
}

function updateOrderUsernameDraft(channelId: string, value: string) {
  orderUsernameDrafts[channelId] = value
}

function addOrderUsername(channelId: string) {
  const draft = String(orderUsernameDrafts[channelId] || '').trim()
  if (!draft) {
    message.warning('请先输入用户名')
    return
  }

  if (!userForm.channelConfigs[channelId]) {
    userForm.channelConfigs[channelId] = createDefaultUserChannelConfig()
  }

  const usernames = userForm.channelConfigs[channelId].orderUserStats.usernames
  if (usernames.includes(draft)) {
    message.warning('用户名已存在')
    return
  }

  usernames.push(draft)
  orderUsernameDrafts[channelId] = ''
}

function removeOrderUsername(channelId: string, index: number) {
  const usernames = userForm.channelConfigs[channelId]?.orderUserStats.usernames
  if (!Array.isArray(usernames) || index < 0 || index >= usernames.length) {
    return
  }

  usernames.splice(index, 1)

  if (editingOrderUsername.channelId === channelId && editingOrderUsername.index === index) {
    cancelEditOrderUsername()
  }
}

function handleOrderUsernameDragStart(channelId: string, index: number) {
  draggedOrderUsername.channelId = channelId
  draggedOrderUsername.index = index
}

function resetOrderUsernameDrag() {
  draggedOrderUsername.channelId = ''
  draggedOrderUsername.index = -1
}

function handleOrderUsernameDrop(channelId: string, targetIndex: number) {
  const usernames = userForm.channelConfigs[channelId]?.orderUserStats.usernames
  const sourceChannelId = draggedOrderUsername.channelId
  const sourceIndex = draggedOrderUsername.index

  if (
    !Array.isArray(usernames) ||
    sourceChannelId !== channelId ||
    sourceIndex < 0 ||
    sourceIndex >= usernames.length ||
    targetIndex < 0 ||
    targetIndex >= usernames.length ||
    sourceIndex === targetIndex
  ) {
    resetOrderUsernameDrag()
    return
  }

  const [movedUsername] = usernames.splice(sourceIndex, 1)
  usernames.splice(targetIndex, 0, movedUsername)
  resetOrderUsernameDrag()
}

function startEditOrderUsername(channelId: string, index: number, value: string) {
  editingOrderUsername.channelId = channelId
  editingOrderUsername.index = index
  editingOrderUsername.value = value
}

function cancelEditOrderUsername() {
  editingOrderUsername.channelId = ''
  editingOrderUsername.index = -1
  editingOrderUsername.value = ''
}

function submitEditOrderUsername(channelId: string) {
  const usernames = userForm.channelConfigs[channelId]?.orderUserStats.usernames
  const targetIndex = editingOrderUsername.index
  const nextValue = String(editingOrderUsername.value || '').trim()

  if (
    editingOrderUsername.channelId !== channelId ||
    !Array.isArray(usernames) ||
    targetIndex < 0 ||
    targetIndex >= usernames.length
  ) {
    cancelEditOrderUsername()
    return
  }

  if (!nextValue) {
    message.warning('用户名不能为空')
    return
  }

  if (usernames.some((item, index) => item === nextValue && index !== targetIndex)) {
    message.warning('用户名已存在')
    return
  }

  usernames[targetIndex] = nextValue
  cancelEditOrderUsername()
}

function syncUserChannelConfigs() {
  const nextConfigs: Record<string, adminApi.UserChannelBindingConfig> = {}
  const selectedChannelIds = Array.isArray(userForm.channelIds) ? userForm.channelIds : []

  selectedChannelIds.forEach((channelId: string) => {
    nextConfigs[channelId] = normalizeUserChannelConfig(userForm.channelConfigs?.[channelId])
  })

  userForm.channelConfigs = nextConfigs
  syncUserChannelExpandedState(selectedChannelIds)
  syncUserChannelReuseSourceState(selectedChannelIds)

  if (userForm.defaultChannelId && !selectedChannelIds.includes(userForm.defaultChannelId)) {
    userForm.defaultChannelId = ''
  }
}

function syncUserChannelExpandedState(selectedChannelIds: string[]) {
  const nextSelectedSet = new Set(selectedChannelIds)
  Object.keys(userChannelExpandedState).forEach(channelId => {
    if (!nextSelectedSet.has(channelId)) {
      delete userChannelExpandedState[channelId]
    }
  })

  selectedChannelIds.forEach(channelId => {
    if (typeof userChannelExpandedState[channelId] !== 'boolean') {
      userChannelExpandedState[channelId] = false
    }
  })
}

function syncUserChannelReuseSourceState(selectedChannelIds: string[]) {
  const nextSelectedSet = new Set(selectedChannelIds)

  Object.keys(userChannelReuseSourceIds).forEach(channelId => {
    if (!nextSelectedSet.has(channelId)) {
      delete userChannelReuseSourceIds[channelId]
    }
  })

  selectedChannelIds.forEach(channelId => {
    const sourceChannelId = String(userChannelReuseSourceIds[channelId] || '').trim()

    if (
      !sourceChannelId ||
      sourceChannelId === channelId ||
      !nextSelectedSet.has(sourceChannelId)
    ) {
      userChannelReuseSourceIds[channelId] = ''
    }
  })
}

function isUserChannelSectionExpanded(channelId: string) {
  return Boolean(userChannelExpandedState[channelId])
}

function toggleUserChannelSection(channelId: string) {
  userChannelExpandedState[channelId] = !isUserChannelSectionExpanded(channelId)
}

function handleUserChannelEnabledChange(
  channelId: string,
  config: adminApi.UserChannelBindingConfig,
  value: boolean
) {
  config.enabled = value
  if (value) {
    userChannelExpandedState[channelId] = true
  }
}

function removeUserChannelMatch(channelId: string, matchId: string) {
  const channelConfig = userForm.channelConfigs[channelId]
  if (!channelConfig) {
    return
  }

  channelConfig.douyinMaterialMatches = channelConfig.douyinMaterialMatches.filter(
    match => match.id !== matchId
  )

  if (editingMaterialMatchIds[channelId] === matchId) {
    editingMaterialMatchIds[channelId] = ''
  }
}

async function loadData() {
  const [overviewData, userList, channelList, downloadCenterConfigList] = await Promise.all([
    adminApi.getAdminOverview(),
    adminApi.listUsers(),
    adminApi.listChannels(),
    adminApi.listDownloadCenterConfigs(),
  ])
  overview.value = overviewData
  users.value = userList
  channels.value = channelList
  downloadCenterConfigs.value = downloadCenterConfigList
  syncDouyinAccountDrafts()
  syncDouyinAccountExpandedState(userList.map(user => user.id))
  syncSelectedDouyinAccountState(userList.map(user => user.id))
}

async function handleChannelSortEnd(event: { oldIndex?: number; newIndex?: number }) {
  if (sortingChannels.value || isChannelSortingByKeyword.value) {
    return
  }
  if (event.oldIndex === event.newIndex) {
    return
  }

  const previousChannels = channels.value.map(channel => ({ ...channel }))
  sortingChannels.value = true

  try {
    const reorderedChannels = await adminApi.reorderChannels(
      channels.value.map(channel => channel.id)
    )
    channels.value = reorderedChannels
    await sessionStore.loadSession()
    await apiConfigStore.loadFromStorage()
    message.success('渠道顺序已更新')
  } catch (error) {
    channels.value = previousChannels
    message.error(error instanceof Error ? error.message : '保存渠道顺序失败')
  } finally {
    sortingChannels.value = false
  }
}

function openUserModal(user?: adminApi.UserProfile) {
  editingUserId.value = user?.id || ''
  resetUserForm()
  if (user) {
    Object.assign(userForm, JSON.parse(JSON.stringify(user)))
    delete (userForm as Record<string, unknown>).materialPreview
    userForm.douyinAccounts = cloneDouyinAccounts(user.douyinAccounts)
    userForm.password = ''
  }
  syncUserChannelConfigs()
  showUserModal.value = true
}

function openChannelModal(channel?: adminApi.ChannelConfig) {
  editingChannelId.value = channel?.id || ''
  resetChannelForm()
  if (channel) {
    Object.assign(channelForm, JSON.parse(JSON.stringify(channel)))
  }
  showChannelModal.value = true
}

function openDownloadCenterModal(config?: adminApi.DownloadCenterConfig) {
  editingDownloadCenterId.value = config?.id || ''
  resetDownloadCenterForm()
  if (config) {
    Object.assign(downloadCenterForm, JSON.parse(JSON.stringify(config)))
  }
  showDownloadCenterModal.value = true
}

function updateDesktopPermission(
  permissions: adminApi.UserChannelBindingConfig['permissions']['desktopMenus'],
  key: DesktopPermissionKey,
  value: boolean
) {
  permissions[key] = value
}

function updateWebPermission(
  permissions: adminApi.UserChannelBindingConfig['permissions']['webMenus'],
  key: WebPermissionKey,
  value: boolean
) {
  permissions[key] = value
}

async function saveUser() {
  savingUser.value = true
  try {
    delete (userForm as Record<string, unknown>).materialPreview
    syncUserChannelConfigs()

    for (const channelId of userForm.channelIds) {
      const channelConfig = userForm.channelConfigs?.[channelId]
      const configuredMatchRefIds = new Set<string>()

      for (const match of channelConfig?.douyinMaterialMatches || []) {
        const hasRef = Boolean(String(match.douyinAccountRefId || '').trim())
        const hasRange = Boolean(String(match.materialRange || '').trim())

        if (!hasRef && !hasRange) {
          continue
        }

        if (!hasRef || !hasRange) {
          const channelName =
            channels.value.find(channel => channel.id === channelId)?.name || `渠道 ${channelId}`
          message.error(`【${channelName}】请为每条抖音号匹配素材规则同时选择抖音号并填写素材序号`)
          return
        }

        if (!getBoundDouyinAccount(match.douyinAccountRefId)) {
          const channelName =
            channels.value.find(channel => channel.id === channelId)?.name || `渠道 ${channelId}`
          message.error(`【${channelName}】存在未绑定的抖音号，请先到“抖音号配置”里维护后再保存`)
          return
        }

        if (configuredMatchRefIds.has(match.douyinAccountRefId)) {
          const channelName =
            channels.value.find(channel => channel.id === channelId)?.name || `渠道 ${channelId}`
          message.error(`【${channelName}】同一个抖音号只需要配置一条素材序号规则`)
          return
        }

        configuredMatchRefIds.add(match.douyinAccountRefId)
      }

      if (!channelConfig?.independentOrderStats?.enabled) {
        continue
      }

      const validMatchCount = countConfiguredMaterialMatches(channelConfig.douyinMaterialMatches)
      if (validMatchCount > 0) {
        continue
      }

      const channelName =
        channels.value.find(channel => channel.id === channelId)?.name || `渠道 ${channelId}`
      message.error(
        `【${channelName}】开启独立订单统计前，至少需要配置 1 条有效的抖音号匹配素材规则`
      )
      return
    }

    if (userForm.defaultChannelId && !userForm.channelIds.includes(userForm.defaultChannelId)) {
      message.error('默认渠道必须属于可访问渠道之一')
      return
    }
    if (editingUserId.value) {
      await adminApi.updateUser(editingUserId.value, userForm)
      message.success('用户已更新')
    } else {
      await adminApi.createUser(userForm)
      message.success('用户已创建')
    }
    showUserModal.value = false
    await loadData()
    await sessionStore.loadSession()
    await apiConfigStore.loadFromStorage()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存用户失败')
  } finally {
    savingUser.value = false
  }
}

async function saveChannel() {
  savingChannel.value = true
  try {
    channelForm.juliang.buildConfig.secretKey = channelForm.changdu.secretKey || ''
    if (editingChannelId.value) {
      await adminApi.updateChannel(editingChannelId.value, channelForm)
      message.success('渠道已更新')
    } else {
      await adminApi.createChannel(channelForm)
      message.success('渠道已创建')
    }
    showChannelModal.value = false
    await loadData()
    await sessionStore.loadSession()
    await apiConfigStore.loadFromStorage()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存渠道失败')
  } finally {
    savingChannel.value = false
  }
}

async function saveDownloadCenterConfig() {
  savingDownloadCenter.value = true
  try {
    if (!downloadCenterForm.name.trim() || !downloadCenterForm.owner.trim()) {
      message.error('常读名称和所属人为必填项')
      return
    }

    const payload = {
      ...downloadCenterForm,
      name: downloadCenterForm.name.trim(),
      owner: downloadCenterForm.owner.trim(),
      secretKey: downloadCenterForm.secretKey.trim(),
      appId: downloadCenterForm.appId.trim(),
      cookie: downloadCenterForm.cookie.trim(),
      distributorId: downloadCenterForm.distributorId.trim(),
      adUserId: downloadCenterForm.adUserId.trim(),
      rootAdUserId: downloadCenterForm.rootAdUserId.trim(),
    }

    if (editingDownloadCenterId.value) {
      await adminApi.updateDownloadCenterConfig(editingDownloadCenterId.value, payload)
      message.success('下载中心配置已更新')
    } else {
      await adminApi.createDownloadCenterConfig(payload)
      message.success('下载中心配置已创建')
    }

    showDownloadCenterModal.value = false
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存下载中心配置失败')
  } finally {
    savingDownloadCenter.value = false
  }
}

function confirmDeleteUser(user: adminApi.UserProfile) {
  dialog.warning({
    title: '删除用户',
    content: `确定删除用户「${user.nickname}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await adminApi.deleteUser(user.id)
        message.success('用户已删除')
        await loadData()
        await sessionStore.loadSession()
        await apiConfigStore.loadFromStorage()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除用户失败')
      }
    },
  })
}

function confirmDeleteChannel(channel: adminApi.ChannelConfig) {
  dialog.warning({
    title: '删除渠道',
    content: `确定删除渠道「${channel.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await adminApi.deleteChannel(channel.id)
        message.success('渠道已删除')
        await loadData()
        await sessionStore.loadSession()
        await apiConfigStore.loadFromStorage()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除渠道失败')
      }
    },
  })
}

function confirmDeleteDownloadCenterConfig(config: adminApi.DownloadCenterConfig) {
  dialog.warning({
    title: '删除下载中心配置',
    content: `确定删除常读配置「${config.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await adminApi.deleteDownloadCenterConfig(config.id)
        message.success('下载中心配置已删除')
        await loadData()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除下载中心配置失败')
      }
    },
  })
}

async function handleLogout() {
  await sessionStore.logout()
  await router.replace('/login')
}

async function handleBackToWorkspace() {
  await sessionStore.loadSession()
  await apiConfigStore.loadFromStorage()
  await router.push('/')
}

function syncViewportWidth() {
  if (typeof window === 'undefined') {
    return
  }

  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  syncViewportWidth()
  window.addEventListener('resize', syncViewportWidth)
  loadData().catch(error => {
    message.error(error instanceof Error ? error.message : '加载管理后台失败')
  })
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') {
    return
  }

  window.removeEventListener('resize', syncViewportWidth)
})

watch(
  () => userForm.channelIds,
  () => syncUserChannelConfigs(),
  { deep: true }
)

watch(
  () => filteredDouyinAccountUsers.value.map(user => user.id).join(','),
  () => {
    syncDouyinAccountExpandedState(users.value.map(user => user.id))
    syncSelectedDouyinAccountState(users.value.map(user => user.id))
    if (douyinAccountKeyword.value.trim()) {
      setAllDouyinAccountUsersExpanded(true)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
:deep(.admin-form-drawer .n-drawer-content) {
  display: flex;
  flex-direction: column;
}

:deep(.admin-form-drawer .n-drawer-body) {
  flex: 1;
  min-height: 0;
  background:
    radial-gradient(circle at top right, rgba(191, 219, 254, 0.24), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f8fafc 42%, #ffffff 100%);
}

:deep(.admin-form-drawer .n-drawer-header) {
  padding: 20px 24px 8px;
}

:deep(.admin-form-drawer .n-drawer-header__main) {
  width: 100%;
}

:deep(.admin-form-drawer .n-drawer-footer) {
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
}

:deep(.admin-form-drawer .n-input .n-input-wrapper),
:deep(.admin-form-drawer .n-input-number .n-input-wrapper),
:deep(.admin-form-drawer .n-base-selection) {
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.admin-form-drawer__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.admin-form-drawer__content {
  height: 100%;
  overflow-y: auto;
  padding: 4px 24px 24px;
}

.admin-form-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.drawer-hero {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.drawer-hero__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #2563eb;
  box-shadow: 0 18px 32px -24px rgba(37, 99, 235, 0.55);
}

.drawer-hero--channel .drawer-hero__icon {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
  color: #059669;
  box-shadow: 0 18px 32px -24px rgba(5, 150, 105, 0.45);
}

.drawer-hero__eyebrow {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2563eb;
}

.drawer-hero--channel .drawer-hero__eyebrow {
  color: #059669;
}

.drawer-hero__title {
  margin-top: 0.18rem;
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
}

.drawer-hero__desc {
  margin-top: 0.35rem;
  font-size: 0.92rem;
  line-height: 1.6;
  color: #64748b;
}

.drawer-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.8rem;
}

.drawer-hero__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
  padding: 0.38rem 0.72rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.92);
  color: #475569;
  font-size: 0.78rem;
  font-weight: 600;
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.drawer-panel {
  padding: 1.2rem;
  border-radius: 1.35rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 24px 44px -38px rgba(15, 23, 42, 0.28);
}

.drawer-panel--muted {
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(255, 255, 255, 0.96));
}

.drawer-panel--white {
  background: rgba(255, 255, 255, 0.96);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.panel-head__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.95rem;
  flex-shrink: 0;
}

.panel-head__icon--blue {
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #2563eb;
}

.panel-head__icon--emerald {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  color: #059669;
}

.panel-head__icon--violet {
  background: linear-gradient(135deg, #ede9fe, #ddd6fe);
  color: #7c3aed;
}

.panel-head__eyebrow {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.panel-head__title {
  margin-top: 0.16rem;
  font-size: 1.08rem;
  font-weight: 800;
  color: #0f172a;
}

.panel-head__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.16rem;
}

.panel-head__desc {
  margin-top: 0.32rem;
  font-size: 0.88rem;
  line-height: 1.65;
  color: #64748b;
}

.channel-sort-tip {
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  border: 1px dashed #cbd5e1;
  border-radius: 1rem;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.84rem;
}

.channel-sort-board {
  padding: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 1.2rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
}

.channel-sort-board__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.channel-sort-board__title {
  font-size: 0.96rem;
  font-weight: 700;
  color: #0f172a;
}

.channel-sort-board__desc,
.channel-sort-board__saving {
  font-size: 0.82rem;
  color: #64748b;
}

.channel-sort-board__saving {
  margin-top: 0.9rem;
}

.channel-sort-list {
  display: grid;
  gap: 0.8rem;
}

.channel-sort-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.05rem;
  border: 1px solid rgba(191, 219, 254, 0.72);
  border-radius: 1rem;
  background:
    radial-gradient(circle at top right, rgba(219, 234, 254, 0.55), transparent 36%),
    rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 34px -28px rgba(37, 99, 235, 0.28);
}

.channel-sort-card--ghost {
  opacity: 0.5;
}

.channel-sort-card--chosen {
  border-color: rgba(96, 165, 250, 0.96);
}

.channel-sort-card__main {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
  flex: 1;
}

.channel-sort-card__handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 0.85rem;
  background: rgba(219, 234, 254, 0.8);
  color: #2563eb;
  cursor: grab;
  flex-shrink: 0;
}

.channel-sort-card__handle:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.channel-sort-card__content {
  min-width: 0;
  flex: 1;
}

.channel-sort-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.channel-sort-card__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.7rem;
  height: 1.7rem;
  padding: 0 0.45rem;
  border-radius: 9999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.78rem;
  font-weight: 700;
}

.channel-sort-card__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.96rem;
  font-weight: 700;
  color: #0f172a;
}

.channel-sort-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.channel-sort-card__actions {
  display: flex;
  gap: 0.55rem;
  flex-shrink: 0;
}

.advance-config-block {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 1.15rem;
  border: 1px solid rgba(191, 219, 254, 0.65);
  background:
    radial-gradient(circle at top right, rgba(219, 234, 254, 0.7), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
  box-shadow: 0 18px 36px -32px rgba(37, 99, 235, 0.28);
}

.advance-config-block__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  margin-bottom: 0.95rem;
}

.advance-config-block__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.45rem;
}

.advance-config-block__summary {
  max-width: 22rem;
  text-align: right;
  font-size: 0.78rem;
  line-height: 1.6;
  color: #475569;
}

.advance-config-block__title {
  font-size: 0.96rem;
  font-weight: 700;
  color: #0f172a;
}

.advance-config-block__desc {
  margin-top: 0.3rem;
  font-size: 0.82rem;
  line-height: 1.65;
  color: #64748b;
}

.advance-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.advance-config-item {
  padding: 0.9rem 0.95rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.96);
  background: rgba(255, 255, 255, 0.88);
}

.advance-config-item__title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #1e293b;
}

.advance-config-item__desc {
  margin-top: 0.26rem;
  margin-bottom: 0.75rem;
  font-size: 0.78rem;
  line-height: 1.6;
  color: #64748b;
}

.advance-config-time-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  gap: 0.75rem;
}

.advance-config-time-field {
  display: grid;
  gap: 0.45rem;
}

.advance-config-time-field__label {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #64748b;
}

.advance-config-time-range__split {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding-bottom: 0.7rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: #64748b;
}

.advance-config-inline {
  display: grid;
  gap: 0.7rem;
}

.advance-config-inline__tip {
  font-size: 0.76rem;
  line-height: 1.6;
  color: #64748b;
}

.channel-config-card {
  padding: 1rem;
  border: 1px solid rgba(191, 219, 254, 0.55);
  border-radius: 1.2rem;
  background:
    radial-gradient(circle at top right, rgba(224, 231, 255, 0.34), transparent 34%),
    rgba(248, 250, 252, 0.9);
  box-shadow: 0 22px 40px -34px rgba(37, 99, 235, 0.3);
}

.channel-config-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
  cursor: pointer;
}

.channel-config-card__title {
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
}

.channel-config-card__desc {
  margin-top: 0.28rem;
  font-size: 0.84rem;
  line-height: 1.55;
  color: #64748b;
}

.channel-config-card__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

.channel-config-card__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.7rem;
  border: 1px solid rgba(191, 219, 254, 0.85);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.95);
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.channel-config-card__toggle:hover {
  background: rgba(239, 246, 255, 0.98);
  border-color: rgba(147, 197, 253, 0.95);
  color: #1e40af;
}

.channel-config-card__switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.2rem 0 1rem;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(191, 219, 254, 0.72);
}

.channel-config-card__switch-title {
  font-size: 0.86rem;
  font-weight: 700;
  color: #0f172a;
}

.channel-config-card__switch-desc {
  margin-top: 0.24rem;
  font-size: 0.8rem;
  line-height: 1.55;
  color: #64748b;
}

.channel-config-card__switch-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.channel-config-card__reuse-select {
  width: 9.5rem;
}

.channel-config-card__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.68rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(191, 219, 254, 0.8);
  color: #1e40af;
  font-size: 0.76rem;
  font-weight: 700;
}

.channel-config-card__pill--violet {
  border-color: rgba(221, 214, 254, 0.95);
  color: #7c3aed;
}

.channel-config-card__pill--success {
  border-color: rgba(187, 247, 208, 0.95);
  background: rgba(240, 253, 244, 0.96);
  color: #15803d;
}

.channel-config-card__pill--danger {
  border-color: rgba(254, 202, 202, 0.98);
  background: rgba(254, 242, 242, 0.98);
  color: #dc2626;
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.08);
}

.config-subpanel {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.96);
}

.config-subpanel + .config-subpanel {
  margin-top: 1rem;
}

.channel-config-card__empty {
  padding: 1rem 1.1rem;
  border-radius: 1rem;
  border: 1px dashed rgba(191, 219, 254, 0.95);
  background: rgba(255, 255, 255, 0.88);
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.7;
}

.config-subpanel--sky {
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.98), rgba(255, 255, 255, 0.98));
  border-color: rgba(186, 230, 253, 0.95);
}

.config-subpanel--violet {
  background: linear-gradient(180deg, rgba(245, 243, 255, 0.95), rgba(255, 255, 255, 0.98));
  border-color: rgba(221, 214, 254, 0.9);
}

.config-subpanel__head {
  margin-bottom: 0.9rem;
}

.config-subpanel__head--split {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.toggle-hero {
  display: inline-flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.72rem 0.9rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(186, 230, 253, 0.9);
}

.toggle-hero__title {
  font-size: 0.82rem;
  font-weight: 700;
  color: #0f172a;
}

.toggle-hero__desc {
  margin-top: 0.2rem;
  max-width: 18rem;
  font-size: 0.76rem;
  line-height: 1.5;
  color: #64748b;
}

.permission-groups {
  display: grid;
  gap: 1rem;
}

.permission-group {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  box-shadow: 0 16px 36px -30px rgba(15, 23, 42, 0.28);
}

.permission-group--web {
  border-color: #cbd5e1;
}

.permission-group--desktop {
  border-color: #fde68a;
  background: linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.98));
}

.permission-group__header {
  margin-bottom: 0.85rem;
}

.permission-group__eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #d97706;
}

.permission-group__title {
  margin-top: 0.2rem;
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
}

.permission-group__desc {
  margin-top: 0.3rem;
  font-size: 0.86rem;
  line-height: 1.6;
  color: #64748b;
}

.permission-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.75rem;
}

.permission-card {
  padding: 0.9rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.92);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.permission-card:hover {
  transform: translateY(-1px);
  border-color: #cbd5e1;
  box-shadow: 0 16px 30px -26px rgba(15, 23, 42, 0.4);
}

.permission-card--web {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.96));
}

.permission-card--recommended {
  border-color: #fcd34d;
  background: linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.98));
}

.permission-card__body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.permission-card__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.permission-card__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}

.permission-card__meta {
  margin-top: 0.32rem;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #64748b;
}

.permission-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.4rem;
  padding: 0.1rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.permission-card__badge--web {
  background: #e2e8f0;
  color: #475569;
}

.permission-card__badge--recommended {
  background: #fef3c7;
  color: #b45309;
}

.permission-card__badge--optional {
  background: #e2e8f0;
  color: #64748b;
}

.douyin-account-user-card {
  padding: 1rem 1.1rem;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 1.2rem;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), #ffffff);
  box-shadow: 0 16px 36px -30px rgba(15, 23, 42, 0.18);
}

.douyin-account-user-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
}

.douyin-account-user-card__title {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
}

.douyin-account-user-card__preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.7rem;
}

.douyin-account-user-card__preview-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.28rem 0.8rem;
  appearance: none;
  border: 1px solid rgba(191, 219, 254, 0.95);
  border-radius: 9999px;
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.98), rgba(248, 250, 252, 0.98));
  color: #1d4ed8;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  box-shadow: 0 10px 24px -20px rgba(37, 99, 235, 0.45);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.douyin-account-user-card__preview-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.98);
  box-shadow: 0 14px 28px -20px rgba(37, 99, 235, 0.35);
}

.douyin-account-user-card__preview-chip--active {
  border-color: rgba(29, 78, 216, 0.98);
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.98), rgba(59, 130, 246, 0.96));
  color: #eff6ff;
  box-shadow: 0 16px 32px -20px rgba(37, 99, 235, 0.55);
}

.douyin-account-user-card__preview-empty {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.28rem 0.8rem;
  border: 1px dashed rgba(203, 213, 225, 0.95);
  border-radius: 9999px;
  background: rgba(248, 250, 252, 0.88);
  color: #64748b;
  font-size: 0.8rem;
}

.douyin-account-user-card__list {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.douyin-account-row {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
  box-shadow: 0 18px 30px -26px rgba(15, 23, 42, 0.18);
}

.douyin-account-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.douyin-account-row__title {
  min-width: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
}

.douyin-account-user-card__empty {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px dashed #cbd5e1;
  border-radius: 1rem;
  background: rgba(248, 250, 252, 0.7);
  color: #64748b;
  font-size: 0.85rem;
}

.material-match-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.95rem;
}

.material-match-search {
  max-width: 28rem;
}

.material-match-toolbar__meta {
  font-size: 0.8rem;
  font-weight: 600;
  color: #7c3aed;
}

.material-match-empty-warning {
  margin-bottom: 0.9rem;
  padding: 0.8rem 0.95rem;
  border: 1px dashed rgba(251, 191, 36, 0.9);
  border-radius: 0.95rem;
  background: rgba(255, 251, 235, 0.92);
  color: #b45309;
  font-size: 0.82rem;
}

.material-match-list {
  display: grid;
  gap: 0.8rem;
}

.material-match-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.material-match-card {
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(221, 214, 254, 0.8);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 34px -30px rgba(91, 33, 182, 0.2);
}

.material-match-card__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.material-match-card__items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.material-match-card__item {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  min-width: 0;
  color: #334155;
}

.material-match-card__item--muted {
  font-size: 0.82rem;
  color: #64748b;
}

.material-match-card__item--range {
  color: #5b21b6;
}

.material-match-card__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.08rem 0.38rem;
  border-radius: 9999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
}

.material-match-card__name {
  font-weight: 700;
  color: #0f172a;
}

.material-match-card__range {
  font-family:
    ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 0.92rem;
  font-weight: 700;
}

.material-match-card__actions {
  display: flex;
  gap: 0.55rem;
  flex-shrink: 0;
}

.material-match-card__editor {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  border-top: 1px dashed rgba(221, 214, 254, 0.9);
}

.material-match-card__hint {
  grid-column: 1 / -1;
  font-size: 0.78rem;
  color: #64748b;
}

.order-usernames-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.order-username-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 140px;
  max-width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid #fbcfe8;
  border-radius: 9999px;
  background: linear-gradient(135deg, #fff1f2, #fff7ed);
  box-shadow: 0 10px 24px -20px rgba(190, 24, 93, 0.45);
  cursor: grab;
  user-select: none;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.order-username-chip:hover {
  transform: translateY(-1px);
  border-color: #f9a8d4;
  box-shadow: 0 14px 28px -18px rgba(190, 24, 93, 0.4);
}

.order-username-chip--dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.order-username-chip__handle {
  color: #db2777;
  font-size: 0.8rem;
  letter-spacing: -0.15rem;
}

.order-username-chip__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #831843;
  font-size: 0.88rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-username-chip__remove {
  flex-shrink: 0;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.72);
  color: #be123c;
  font-size: 0.75rem;
  line-height: 1.2;
}

.order-username-empty {
  padding: 0.75rem 0.9rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.9rem;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.85rem;
}

:deep(.admin-form-drawer .n-form-item-label) {
  font-weight: 600;
  color: #334155;
}

@media (max-width: 768px) {
  :deep(.admin-form-drawer .n-drawer-header) {
    padding: 18px 16px 8px;
  }

  .admin-form-drawer__content {
    padding: 4px 16px 16px;
  }

  .drawer-panel {
    padding: 1rem;
    border-radius: 1.1rem;
  }

  .drawer-hero,
  .panel-head,
  .advance-config-block__header,
  .channel-config-card__head,
  .douyin-account-user-card__head,
  .config-subpanel__head--split,
  .material-match-card__summary {
    flex-direction: column;
  }

  .advance-config-grid {
    grid-template-columns: 1fr;
  }

  .advance-config-block__meta {
    align-items: flex-start;
  }

  .advance-config-block__summary {
    max-width: none;
    text-align: left;
  }

  .advance-config-time-range {
    grid-template-columns: 1fr;
  }

  .advance-config-time-range__split {
    justify-content: flex-start;
    padding-bottom: 0;
  }

  .drawer-hero__icon,
  .panel-head__icon {
    width: 2.75rem;
    height: 2.75rem;
  }

  .channel-config-card__meta {
    justify-content: flex-start;
  }

  .channel-config-card__switch {
    flex-direction: column;
    align-items: flex-start;
  }

  .channel-config-card__switch-actions {
    width: 100%;
    justify-content: space-between;
  }

  .channel-config-card__reuse-select {
    width: 100%;
  }

  .toggle-hero {
    width: 100%;
    justify-content: space-between;
  }

  .permission-group {
    padding: 0.9rem;
  }

  .permission-card {
    padding: 0.85rem 0.9rem;
  }

  .permission-card__body {
    align-items: flex-start;
  }

  .material-match-search {
    max-width: none;
    width: 100%;
  }

  .material-match-card {
    padding: 0.85rem;
  }

  .material-match-actions {
    justify-content: stretch;
  }

  .material-match-actions :deep(.n-button) {
    width: 100%;
  }

  .material-match-card__actions {
    width: 100%;
  }

  .material-match-card__actions :deep(.n-button) {
    flex: 1;
  }
}

@media (min-width: 768px) {
  .douyin-account-user-card__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .permission-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .material-match-card__editor {
    grid-template-columns: 1.15fr 1fr;
  }
}
</style>
