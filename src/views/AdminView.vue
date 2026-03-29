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

            <n-data-table
              :columns="channelColumns"
              :data="filteredChannels"
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
          <div>
            <p class="text-sm font-semibold text-blue-600">用户配置</p>
            <h2 class="mt-1 text-xl font-bold text-slate-900">
              {{ editingUserId ? '编辑用户' : '新增用户' }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">右侧抽屉会保留页面上下文，方便边看边改。</p>
          </div>
        </template>

        <div class="admin-form-drawer__body">
          <div class="admin-form-drawer__content space-y-5">
            <section class="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div class="mb-4">
                <p class="text-sm font-semibold text-blue-600">基础信息</p>
                <h3 class="mt-1 text-lg font-bold text-slate-900">账号与权限</h3>
                <p class="mt-1 text-sm text-slate-500">配置用户身份、登录账号和所属渠道。</p>
              </div>
              <n-form
                :model="userForm"
                label-placement="top"
                class="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                <n-form-item label="昵称">
                  <n-input v-model:value="userForm.nickname" placeholder="请输入昵称" />
                </n-form-item>
                <n-form-item label="账号">
                  <n-input v-model:value="userForm.account" placeholder="请输入账号" />
                </n-form-item>
                <n-form-item label="密码">
                  <n-input v-model:value="userForm.password" placeholder="请输入密码" />
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

            <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="mb-4">
                <p class="text-sm font-semibold text-emerald-600">飞书配置</p>
                <h3 class="mt-1 text-lg font-bold text-slate-900">按渠道绑定业务配置</h3>
                <p class="mt-1 text-sm text-slate-500">
                  同一个用户可以在不同渠道下分别配置飞书表和抖音匹配素材，运行时会跟随当前渠道切换。
                </p>
              </div>
              <div v-if="selectedUserChannelForms.length > 0" class="space-y-4">
                <div
                  v-for="item in selectedUserChannelForms"
                  :key="item.channel.id"
                  class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div class="mb-3 flex items-center gap-2">
                    <p class="text-base font-semibold text-slate-900">{{ item.channel.name }}</p>
                    <n-tag
                      v-if="userForm.defaultChannelId === item.channel.id"
                      size="small"
                      type="success"
                      bordered
                    >
                      默认渠道
                    </n-tag>
                  </div>
                  <div class="mt-1">
                    <div class="mb-3">
                      <p class="text-sm font-semibold text-emerald-600">飞书表格 ID</p>
                      <p class="mt-1 text-sm text-slate-500">
                        为当前渠道配置剧集清单、剧集状态和账户表的 table_id。
                      </p>
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

                  <div class="mt-5 border-t border-slate-200 pt-4">
                    <div class="mb-3">
                      <p class="text-sm font-semibold text-sky-600">素材预览</p>
                      <p class="mt-1 text-sm text-slate-500">
                        控制当前用户在当前渠道下的素材预览开关、轮询间隔和搭建时间窗口。
                      </p>
                    </div>
                    <n-form
                      :model="item.config.materialPreview"
                      label-placement="top"
                      class="grid grid-cols-1 gap-3 md:grid-cols-2"
                    >
                      <n-form-item label="启用素材预览">
                        <div class="flex h-[42px] items-center">
                          <n-switch v-model:value="item.config.materialPreview.enabled" />
                        </div>
                      </n-form-item>
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

                  <div class="mt-5 border-t border-slate-200 pt-4">
                    <div class="mb-3">
                      <p class="text-sm font-semibold text-amber-600">权限控制</p>
                      <p class="mt-1 text-sm text-slate-500">
                        控制当前用户在当前渠道下可访问哪些工作台入口。
                      </p>
                    </div>
                    <n-form
                      :model="item.config.permissions"
                      label-placement="top"
                      class="grid grid-cols-1 gap-3 md:grid-cols-2"
                    >
                      <n-form-item label="允许访问同步账户">
                        <div class="flex h-[42px] items-center">
                          <n-switch v-model:value="item.config.permissions.syncAccount" />
                        </div>
                      </n-form-item>
                      <n-form-item label="剧目下载">
                        <div class="flex h-[42px] items-center">
                          <n-switch v-model:value="item.config.permissions.desktopMenus.download" />
                        </div>
                      </n-form-item>
                      <n-form-item label="素材剪辑">
                        <div class="flex h-[42px] items-center">
                          <n-switch
                            v-model:value="item.config.permissions.desktopMenus.materialClip"
                          />
                        </div>
                      </n-form-item>
                      <n-form-item label="形天上传">
                        <div class="flex h-[42px] items-center">
                          <n-switch v-model:value="item.config.permissions.desktopMenus.upload" />
                        </div>
                      </n-form-item>
                      <n-form-item label="巨量上传">
                        <div class="flex h-[42px] items-center">
                          <n-switch
                            v-model:value="item.config.permissions.desktopMenus.juliangUpload"
                          />
                        </div>
                      </n-form-item>
                      <n-form-item label="上传搭建">
                        <div class="flex h-[42px] items-center">
                          <n-switch
                            v-model:value="item.config.permissions.desktopMenus.uploadBuild"
                          />
                        </div>
                      </n-form-item>
                      <n-form-item label="巨量搭建">
                        <div class="flex h-[42px] items-center">
                          <n-switch
                            v-model:value="item.config.permissions.desktopMenus.juliangBuild"
                          />
                        </div>
                      </n-form-item>
                    </n-form>
                  </div>

                  <div class="mt-5 border-t border-slate-200 pt-4">
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
                                  @click.stop="removeOrderUsername(item.channel.id, usernameIndex)"
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

                  <div class="mt-5 border-t border-slate-200 pt-4">
                    <div class="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <p class="text-sm font-semibold text-violet-600">抖音匹配素材</p>
                        <p class="mt-1 text-sm text-slate-500">
                          为当前渠道单独维护抖音号、抖音号 ID 和素材范围。
                        </p>
                      </div>
                      <n-button tertiary @click="addUserChannelMatch(item.channel.id)"
                        >新增匹配规则</n-button
                      >
                    </div>

                    <div class="space-y-3">
                      <div
                        v-for="match in item.config.douyinMaterialMatches"
                        :key="match.id"
                        class="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]"
                      >
                        <n-input
                          v-model:value="match.douyinAccount"
                          placeholder="请输入抖音号名称"
                        />
                        <n-input
                          v-model:value="match.douyinAccountId"
                          placeholder="请输入抖音号 ID"
                        />
                        <n-input
                          v-model:value="match.materialRange"
                          placeholder="请输入素材范围，如 01-04"
                        />
                        <n-button
                          tertiary
                          type="error"
                          @click="removeUserChannelMatch(item.channel.id, match.id)"
                        >
                          删除
                        </n-button>
                      </div>

                      <div
                        v-if="item.config.douyinMaterialMatches.length === 0"
                        class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500"
                      >
                        当前渠道暂无匹配规则，点击右上角“新增匹配规则”开始配置。
                      </div>
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
          <div>
            <p class="text-sm font-semibold text-emerald-600">渠道配置</p>
            <h2 class="mt-1 text-xl font-bold text-slate-900">
              {{ editingChannelId ? '编辑渠道' : '新增渠道' }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              从右侧集中维护渠道参数，切换记录时不打断当前视角。
            </p>
          </div>
        </template>

        <div class="admin-form-drawer__body">
          <div class="admin-form-drawer__content space-y-5">
            <section class="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div class="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-blue-600">基础信息</p>
                  <h3 class="mt-1 text-lg font-bold text-slate-900">渠道标识</h3>
                  <p class="mt-1 text-sm text-slate-500">
                    用于管理员后台、用户关联和运行时配置映射。
                  </p>
                </div>
              </div>
              <n-form :model="channelForm" label-placement="top">
                <n-form-item label="渠道名称" class="mb-0">
                  <n-input v-model:value="channelForm.name" placeholder="请输入渠道名称" />
                </n-form-item>
              </n-form>
            </section>

            <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="mb-4">
                  <p class="text-sm font-semibold text-emerald-600">巨量配置</p>
                  <h3 class="mt-1 text-lg font-bold text-slate-900">投放与搭建参数</h3>
                  <p class="mt-1 text-sm text-slate-500">这里保留巨量 Cookie 和搭建参数项。</p>
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
                  <n-form-item label="ccId">
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

              <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="mb-4">
                  <p class="text-sm font-semibold text-violet-600">常读配置</p>
                  <h3 class="mt-1 text-lg font-bold text-slate-900">渠道访问参数</h3>
                  <p class="mt-1 text-sm text-slate-500">
                    常读相关字段统一归到这里，包括 Secret Key。
                  </p>
                </div>
                <n-form
                  :model="channelForm"
                  label-placement="top"
                  class="grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                  <n-form-item label="Secret Key">
                    <n-input
                      v-model:value="channelForm.changdu.secretKey"
                      placeholder="请输入 Secret Key"
                    />
                  </n-form-item>
                  <n-form-item label="appId">
                    <n-input v-model:value="channelForm.changdu.appId" placeholder="请输入 appId" />
                  </n-form-item>
                  <n-form-item label="常读 Cookie" class="md:col-span-2">
                    <n-input
                      v-model:value="channelForm.changdu.cookie"
                      type="textarea"
                      :rows="3"
                      placeholder="请输入常读 Cookie"
                    />
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
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
  NSelect,
  NSwitch,
  NTabs,
  NTabPane,
  NTag,
  useDialog,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
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
const overview = ref({
  userCount: 0,
  channelCount: 0,
  adminCount: 0,
  normalCount: 0,
})
const userKeyword = ref('')
const channelKeyword = ref('')
const showUserModal = ref(false)
const showChannelModal = ref(false)
const editingUserId = ref('')
const editingChannelId = ref('')
const savingUser = ref(false)
const savingChannel = ref(false)
const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
const orderUsernameDrafts = reactive<Record<string, string>>({})
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
  password: string
  userType: 'admin' | 'normal'
  channelIds: string[]
  defaultChannelId: string
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

const userForm = reactive<UserFormModel>(createDefaultUserForm())
const channelForm = reactive<ChannelFormModel>(createDefaultChannelForm())

const userTypeOptions = [
  { label: '管理员', value: 'admin' },
  { label: '普通用户', value: 'normal' },
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
  { title: 'appId', key: 'changdu.appId', render: row => row.changdu.appId || '-' },
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

function createDefaultUserForm(): UserFormModel {
  return {
    nickname: '',
    account: '',
    password: '',
    userType: 'normal',
    channelIds: [],
    defaultChannelId: '',
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
    feishu: {
      dramaListTableId: '',
      dramaStatusTableId: '',
      accountTableId: '',
    },
    materialPreview: {
      enabled: false,
      intervalMinutes: 20,
      buildTimeWindowStart: 90,
      buildTimeWindowEnd: 20,
    },
    permissions: {
      syncAccount: false,
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
          douyinAccount: String(match?.douyinAccount || ''),
          douyinAccountId: String(match?.douyinAccountId || ''),
          materialRange: String(match?.materialRange || ''),
          createdAt: match?.createdAt,
          updatedAt: match?.updatedAt,
        }))
        .filter(match => match.douyinAccount || match.douyinAccountId || match.materialRange)
    : []

  return {
    ...defaultConfig,
    ...config,
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
    douyinMaterialMatches,
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
        microAppName: '',
        microAppId: '',
        ccId: '',
        rechargeTemplateId: '',
        adCallbackConfigId: '1845407746151576',
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
  cancelEditOrderUsername()
  resetOrderUsernameDrag()
}

function resetChannelForm() {
  Object.assign(channelForm, createDefaultChannelForm())
}

function addUserChannelMatch(channelId: string) {
  if (!userForm.channelConfigs[channelId]) {
    userForm.channelConfigs[channelId] = createDefaultUserChannelConfig()
  }

  userForm.channelConfigs[channelId].douyinMaterialMatches.push({
    id: crypto.randomUUID(),
    douyinAccount: '',
    douyinAccountId: '',
    materialRange: '',
  })
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

  if (userForm.defaultChannelId && !selectedChannelIds.includes(userForm.defaultChannelId)) {
    userForm.defaultChannelId = ''
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
}

async function loadData() {
  const [overviewData, userList, channelList] = await Promise.all([
    adminApi.getAdminOverview(),
    adminApi.listUsers(),
    adminApi.listChannels(),
  ])
  overview.value = overviewData
  users.value = userList
  channels.value = channelList
}

function openUserModal(user?: adminApi.UserProfile) {
  editingUserId.value = user?.id || ''
  resetUserForm()
  if (user) {
    Object.assign(userForm, JSON.parse(JSON.stringify(user)))
    delete (userForm as Record<string, unknown>).materialPreview
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

async function saveUser() {
  savingUser.value = true
  try {
    delete (userForm as Record<string, unknown>).materialPreview
    syncUserChannelConfigs()
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
</script>

<style scoped>
:deep(.admin-form-drawer .n-drawer-content) {
  display: flex;
  flex-direction: column;
}

:deep(.admin-form-drawer .n-drawer-body) {
  flex: 1;
  min-height: 0;
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
  .admin-form-drawer__content {
    padding: 4px 16px 16px;
  }
}
</style>
