<template>
  <div class="drama-card" :class="{ 'is-new-drama': isNewDrama }">
    <!-- 排名徽章 -->
    <div v-if="showRanking && ranking" class="ranking-badge">
      <div :class="getRankingClass(ranking)" class="ranking-number">{{ ranking }}</div>
    </div>

    <!-- 增剧标识 -->
    <div v-if="isNewDrama" class="new-drama-badge">
      <Icon icon="mdi:fire" class="badge-icon" />
      <span class="badge-text">红标剧·优先剪辑</span>
    </div>

    <div class="drama-content">
      <!-- 封面图片 -->
      <div class="drama-poster">
        <div class="poster-container group" @click="emitShowImage(drama)">
          <img
            :src="drama.original_thumb_url"
            :alt="drama.series_name || drama.book_name"
            class="poster-image"
            @error="handleImageError"
          />
        </div>
      </div>

      <!-- 内容信息 -->
      <div class="drama-info">
        <div class="drama-main">
          <div class="drama-details">
            <!-- 短剧名称 -->
            <div class="drama-title-section">
              <div class="drama-title-row">
                <h3
                  @click="emitCopyName(drama.series_name || drama.book_name || '未知剧名')"
                  class="drama-title"
                  :title="`点击复制剧名: ${drama.series_name || drama.book_name}`"
                >
                  {{ drama.series_name || drama.book_name }}
                </h3>
              </div>
            </div>

            <!-- 分类标签 -->
            <div class="category-tags">
              <span v-for="category in getCategoryTags(drama)" :key="category" class="category-tag">
                {{ category }}
              </span>
            </div>

            <!-- 剧集信息 -->
            <div class="episode-info">
              <div class="episode-item">
                <Icon icon="mdi:play-circle-outline" class="episode-icon" />
                <span class="episode-text">{{ drama.episode_amount }}集</span>
              </div>
            </div>

            <!-- 首发时间 -->
            <div class="publish-time">
              <Icon icon="mdi:clock-outline" class="time-icon" />
              <span class="time-label">首发时间：</span>
              <span class="time-value">
                {{ formatPublishTime(drama.publish_time) }}
              </span>
            </div>
          </div>

          <!-- 状态标识和操作按钮 -->
          <div class="drama-actions">
            <div class="drama-status-row">
              <button
                type="button"
                class="manual-red-flag-toggle"
                :class="{
                  active: isManualRedFlag,
                  disabled: isSyncing || isProcessing,
                }"
                :disabled="isSyncing || isProcessing"
                :title="
                  isManualRedFlag
                    ? `取消红标: ${drama.series_name || drama.book_name}`
                    : `设为红标: ${drama.series_name || drama.book_name}`
                "
                @click.stop="toggleManualRedFlag"
              >
                <span class="manual-red-flag-badge">
                  <Icon icon="mdi:flag-variant" class="manual-red-flag-icon" />
                  <span class="manual-red-flag-label">红标</span>
                </span>
                <span class="manual-red-flag-switch">
                  <span class="manual-red-flag-thumb"></span>
                </span>
              </button>

              <!-- 下载状态标签 -->
              <div v-if="downloadData" class="status-label-wrapper">
                <div :class="['status-label', getDownloadStatusClass(downloadData.task_status)]">
                  <Icon
                    :icon="getDownloadStatusIcon(downloadData.task_status)"
                    class="status-icon"
                  />
                  <span>{{ getDownloadStatusText(downloadData.task_status) }}</span>
                </div>
              </div>
            </div>

            <!-- ID信息 -->
            <div class="drama-id">ID: {{ drama.book_id }}</div>

            <!-- 操作按钮区域 -->
            <div class="action-buttons action-buttons-stack">
              <!-- 下载按钮 - 只在状态为完成(2)时显示，且飞书未显示已下载状态时显示 -->
              <template v-if="downloadData?.task_status === 2 && !drama.feishu_downloaded">
                <button
                  @click="handleDownload"
                  :disabled="isDownloaded || isDownloadTriggered"
                  :class="[
                    'action-button',
                    isDownloaded || isDownloadTriggered
                      ? 'action-button-downloaded'
                      : 'action-button-download',
                  ]"
                  :title="
                    isDownloaded
                      ? `已下载: ${drama.series_name}`
                      : isDownloadTriggered
                        ? '已触发下载'
                        : `下载: ${drama.series_name}`
                  "
                >
                  <Icon
                    :icon="
                      isDownloaded || isDownloadTriggered ? 'mdi:check-circle' : 'mdi:download'
                    "
                    class="button-icon"
                  />
                  <span>{{
                    isDownloaded ? '已下载' : isDownloadTriggered ? '已触发下载' : '下载'
                  }}</span>
                </button>
              </template>

              <!-- 新增待下载按钮 - 只有当飞书剧集清单表中不存在这部剧时才显示 -->
              <!-- 已提交待下载状态 -->
              <div
                v-if="canAddDownload && isSubmittedForDownload"
                class="status-badge status-submitted"
              >
                <Icon icon="mdi:check-circle" class="status-icon" />
                <span>已提交待下载</span>
              </div>

              <!-- 新增待下载按钮 -->
              <div
                v-else-if="canAddDownload"
                ref="productConfigWrapperRef"
                class="product-config-wrapper"
              >
                <div class="action-button-group">
                  <!-- 加入购物车按钮 -->
                  <button
                    @click="handleAddToCart"
                    :disabled="isSyncing || isProcessing"
                    class="action-button action-button-cart"
                    :title="`加入购物车: ${drama.series_name}`"
                  >
                    <Icon icon="mdi:cart-plus" class="button-icon" />
                  </button>

                  <!-- 新增待下载按钮 -->
                  <button
                    @click="handleSyncClick"
                    :disabled="isSyncing || isProcessing"
                    class="action-button action-button-sync action-button-sync-download"
                    :class="{
                      'opacity-50 cursor-not-allowed': isAnySyncing && !isSyncing,
                    }"
                    :title="
                      isAnySyncing && !isSyncing
                        ? '其他剧集正在同步中，请稍候...'
                        : `新增待下载: ${drama.series_name}`
                    "
                  >
                    <Icon
                      :icon="isSyncing || isProcessing ? 'mdi:loading' : 'mdi:cloud-sync'"
                      :class="['button-icon', isSyncing || isProcessing ? 'animate-spin' : '']"
                    />
                    <span>{{
                      isSyncing ? '同步中...' : isProcessing ? '处理中...' : '新增待下载'
                    }}</span>
                  </button>
                </div>

                <transition name="fade-scale">
                  <div v-if="showProductConfig && !isMobile" class="product-popover" @click.stop>
                    <div class="product-popover-header">
                      <div>
                        <p class="popover-title">新增商品配置</p>
                        <p class="popover-subtitle">选择分类并填写男女频后提交</p>
                      </div>
                    </div>

                    <div class="product-popover-section">
                      <p class="section-title">商品分类</p>
                      <div class="space-y-3">
                        <div class="field-group">
                          <label class="field-label">剧集标签</label>
                          <div class="product-tags">
                            <span
                              v-for="tag in getCategoryTags(drama)"
                              :key="tag"
                              class="product-tag"
                            >
                              {{ tag }}
                            </span>
                            <span v-if="!getCategoryTags(drama).length" class="product-tag muted">
                              暂无标签
                            </span>
                          </div>
                        </div>
                        <div class="field-group">
                          <label class="field-label">请选择二级 / 三级分类</label>
                          <NCascader
                            v-model:value="productForm.categoryValue"
                            :options="cascaderOptions"
                            :show-path="true"
                            :expand-trigger="'hover'"
                            :clearable="false"
                            size="small"
                            placeholder="请选择二级 / 三级分类"
                            @update:value="handleCategoryValueChange"
                            class="product-cascader"
                          />
                        </div>
                      </div>
                    </div>

                    <div class="product-popover-section">
                      <p class="section-title">男女频</p>
                      <div class="gender-options">
                        <label
                          v-for="option in genderOptions"
                          :key="option.value"
                          :class="[
                            'gender-option',
                            productForm.playletGender === option.value ? 'active' : '',
                          ]"
                        >
                          <input
                            v-model="productForm.playletGender"
                            type="radio"
                            class="sr-only"
                            :value="option.value"
                          />
                          {{ option.label }}
                        </label>
                      </div>
                    </div>

                    <p v-if="productFormError" class="product-form-error">
                      {{ productFormError }}
                    </p>

                    <div class="popover-actions">
                      <button
                        type="button"
                        class="popover-button muted"
                        @click="cancelProductSelection"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        class="popover-button primary"
                        @click="confirmProductSelection"
                      >
                        确认
                      </button>
                    </div>
                  </div>
                </transition>

                <!-- 移动端弹窗 -->
                <div
                  v-if="showProductConfig && isMobile"
                  class="product-modal-overlay"
                  @click="closeProductConfig"
                >
                  <div class="product-modal" @click.stop>
                    <div class="product-popover-header">
                      <div>
                        <p class="popover-title">新增商品配置</p>
                        <p class="popover-subtitle">选择分类并填写男女频后提交</p>
                      </div>
                      <button class="modal-close" @click="closeProductConfig">×</button>
                    </div>

                    <div class="product-popover-section">
                      <p class="section-title">商品分类</p>
                      <div class="space-y-3">
                        <div class="field-group">
                          <label class="field-label">剧集标签</label>
                          <div class="product-tags">
                            <span
                              v-for="tag in getCategoryTags(drama)"
                              :key="tag"
                              class="product-tag"
                            >
                              {{ tag }}
                            </span>
                            <span v-if="!getCategoryTags(drama).length" class="product-tag muted">
                              暂无标签
                            </span>
                          </div>
                        </div>
                        <div class="field-group">
                          <label class="field-label">请选择二级 / 三级分类</label>
                          <NCascader
                            v-model:value="productForm.categoryValue"
                            :options="cascaderOptions"
                            :show-path="true"
                            :expand-trigger="'click'"
                            :clearable="false"
                            size="medium"
                            placeholder="请选择二级 / 三级分类"
                            @update:value="handleCategoryValueChange"
                            class="product-cascader"
                          />
                        </div>
                      </div>
                    </div>

                    <div class="product-popover-section">
                      <p class="section-title">男女频</p>
                      <div class="gender-options">
                        <label
                          v-for="option in genderOptions"
                          :key="option.value"
                          :class="[
                            'gender-option',
                            productForm.playletGender === option.value ? 'active' : '',
                          ]"
                        >
                          <input
                            v-model="productForm.playletGender"
                            type="radio"
                            class="sr-only"
                            :value="option.value"
                          />
                          {{ option.label }}
                        </label>
                      </div>
                    </div>

                    <div v-if="productFormError" class="product-form-error">
                      {{ productFormError }}
                    </div>

                    <div class="product-popover-actions modal-actions">
                      <button class="btn-cancel" @click.stop="cancelProductSelection">取消</button>
                      <button class="btn-confirm" @click.stop="confirmProductSelection">
                        确认
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 新增待剪辑按钮 - 不受feishu_exists限制 -->
              <!-- 已提交待剪辑状态 -->
              <div
                v-if="drama.feishu_downloaded && isSubmittedForClip"
                class="status-badge status-submitted"
              >
                <Icon icon="mdi:check-circle" class="status-icon" />
                <span>已提交待剪辑</span>
              </div>

              <!-- 新增待剪辑按钮 -->
              <button
                v-else-if="drama.feishu_downloaded"
                @click="handleDirectSync"
                :disabled="isSyncing || isProcessing"
                class="action-button action-button-sync action-button-sync-clip"
                :class="{
                  'opacity-50 cursor-not-allowed': isAnySyncing && !isSyncing,
                }"
                :title="
                  isAnySyncing && !isSyncing
                    ? '其他剧集正在同步中，请稍候...'
                    : `同步到飞书: ${drama.series_name}`
                "
              >
                <Icon
                  :icon="isSyncing || isProcessing ? 'mdi:loading' : 'mdi:cloud-sync'"
                  :class="['button-icon', isSyncing || isProcessing ? 'animate-spin' : '']"
                />
                <span>{{
                  isSyncing ? '同步中...' : isProcessing ? '处理中...' : '新增待剪辑'
                }}</span>
              </button>

              <!-- 提示文案 - 当剧集已下载时显示 -->
              <div
                v-if="drama.feishu_downloaded"
                class="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200"
              >
                <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  ></path>
                </svg>
                <span class="font-medium">该剧已下载</span>
              </div>

              <!-- 提示文案 - 当剧集已存在但未下载时显示 -->
              <div
                v-if="!drama.feishu_downloaded && drama.feishu_exists"
                class="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200"
              >
                <svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clip-rule="evenodd"
                  ></path>
                </svg>
                <span class="font-medium">该剧已在飞书清单中</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { NCascader } from 'naive-ui'
import type { NewDramaItem, DownloadTask } from '@/api/types'
import {
  PRODUCT_CATEGORY_TREE,
  type PlayletGender,
  type ProductSelectionResult,
  type ProductCategoryNode,
} from '@/constants/productCategories'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// 扩展类型定义以支持排行榜数据
interface RankingDramaItem {
  book_id: string
  book_name: string
  series_name?: string // 为了兼容性
  category?: string
  category_text?: string // 为了兼容性
  category_tags?: string[]
  original_thumb_url: string
  episode_amount?: number
  publish_time?: string
  feishu_downloaded?: boolean
  [key: string]: unknown
}

type DramaItem = NewDramaItem & Partial<RankingDramaItem>

// 配置dayjs插件
dayjs.extend(utc)
dayjs.extend(timezone)

// Props定义
interface Props {
  drama: DramaItem
  downloadData?: DownloadTask | null
  isSyncing?: boolean
  isProcessing?: boolean
  isAnySyncing?: boolean
  isDownloaded?: boolean
  isDownloadTriggered?: boolean
  isSubmittedForDownload?: boolean // 是否已提交待下载
  isSubmittedForClip?: boolean // 是否已提交待剪辑
  ranking?: number // 排名，从1开始
  showRanking?: boolean // 是否显示排名
  isNewDrama?: boolean // 是否为增剧（红标剧）
  isManualRedFlag?: boolean // 是否手动开启红标
}

const props = withDefaults(defineProps<Props>(), {
  downloadData: null,
  isSyncing: false,
  isProcessing: false,
  isAnySyncing: false,
  isDownloaded: false,
  isDownloadTriggered: false,
  isSubmittedForDownload: false,
  isSubmittedForClip: false,
  ranking: undefined,
  showRanking: false,
  isNewDrama: false,
  isManualRedFlag: false,
})

// 事件定义
const emit = defineEmits<{
  'show-image': [drama: DramaItem]
  'copy-name': [dramaName: string]
  'sync-to-feishu': [{ drama: DramaItem; productConfig?: ProductSelectionResult }]
  'add-to-cart': [{ drama: DramaItem; sourceElement: HTMLElement }]
  'red-flag-change': [{ drama: DramaItem; value: boolean }]
  download: [downloadData: DownloadTask]
}>()

// 类型安全的 emit 函数
const emitCopyName = (dramaName: string) => emit('copy-name', dramaName)
const emitShowImage = (drama: DramaItem) => emit('show-image', drama)
const emitSyncToFeishu = (payload: { drama: DramaItem; productConfig?: ProductSelectionResult }) =>
  emit('sync-to-feishu', payload)

// 商品分类弹窗状态
const productConfigWrapperRef = ref<HTMLElement | null>(null)
const showProductConfig = ref(false)
const firstCategory = PRODUCT_CATEGORY_TREE
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const DEFAULT_SUB_CATEGORY_ID = '201901'
const DEFAULT_THIRD_CATEGORY_ID = '20190133'
const DEFAULT_PLAYLET_GENDER: PlayletGender = '3'
const defaultCategoryPath = [firstCategory.id, DEFAULT_SUB_CATEGORY_ID, DEFAULT_THIRD_CATEGORY_ID]

const productForm = reactive<{
  categoryPath: string[]
  categoryValue: string | null
  selectedSubCategory: ProductCategoryNode | null
  selectedThirdCategory: ProductCategoryNode | null
  playletGender: '' | PlayletGender
}>({
  categoryPath: [...defaultCategoryPath],
  categoryValue: DEFAULT_THIRD_CATEGORY_ID,
  selectedSubCategory: null,
  selectedThirdCategory: null,
  playletGender: DEFAULT_PLAYLET_GENDER,
})
const productFormError = ref('')
const cascaderOptions = computed(() => {
  const mapNode = (node: ProductCategoryNode): any => {
    const option: Record<string, any> = {
      label: node.name,
      value: node.id,
      isLeaf: !node.children || node.children.length === 0,
    }
    if (node.children && node.children.length > 0) {
      option.children = node.children.map(child => mapNode(child))
    }
    return option
  }
  return (firstCategory.children || []).map(child => mapNode(child))
})

function findNodeByPath(path: string[]): ProductCategoryNode[] {
  const nodes: ProductCategoryNode[] = []
  let currentNode: ProductCategoryNode | undefined = firstCategory

  if (!path.length || path[0] !== firstCategory.id) {
    return nodes
  }

  nodes.push(firstCategory)

  for (let i = 1; i < path.length; i += 1) {
    currentNode = currentNode?.children?.find(child => child.id === path[i])
    if (currentNode) {
      nodes.push(currentNode)
    } else {
      break
    }
  }

  return nodes
}

function updateCategorySelection(path: string[]) {
  if (path.length < 3) {
    productForm.selectedSubCategory = null
    productForm.selectedThirdCategory = null
    return
  }

  const nodes = findNodeByPath(path)
  productForm.selectedSubCategory = nodes[1] ?? null
  productForm.selectedThirdCategory = nodes[2] ?? null
}

updateCategorySelection(productForm.categoryPath)

const genderOptions: Array<{ label: string; value: PlayletGender }> = [
  { label: '男频', value: '1' },
  { label: '女频', value: '2' },
  { label: '其他', value: '3' },
]

function closeProductConfig() {
  showProductConfig.value = false
}

function handleAddToCart(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  const isDisabled =
    props.isSyncing || props.isProcessing || (props.isAnySyncing && !props.isSyncing)

  if (isDisabled) {
    return
  }

  // 获取按钮元素用于动画
  const sourceElement = event.currentTarget as HTMLElement
  emit('add-to-cart', { drama: props.drama, sourceElement })
}

function handleSyncClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  const isDisabled =
    props.isSyncing || props.isProcessing || (props.isAnySyncing && !props.isSyncing)

  if (isDisabled) {
    return
  }

  const selection = buildFixedProductSelection()
  emitSyncToFeishu({ drama: props.drama, productConfig: selection })
}

function handleDirectSync() {
  emitSyncToFeishu({ drama: props.drama })
}

function toggleManualRedFlag() {
  if (props.isSyncing || props.isProcessing) {
    return
  }

  emit('red-flag-change', {
    drama: props.drama,
    value: !props.isManualRedFlag,
  })
}

function cancelProductSelection() {
  closeProductConfig()
  productFormError.value = ''
}

function buildProductSelection(): ProductSelectionResult | null {
  console.log('productForm', productForm)

  if (
    !productForm.selectedSubCategory ||
    !productForm.selectedThirdCategory ||
    !productForm.playletGender
  ) {
    productFormError.value = '请选择完整的分类和男女频'
    return null
  }

  return {
    firstCategoryId: firstCategory.id,
    firstCategoryName: firstCategory.name,
    subCategoryId: productForm.selectedSubCategory.id,
    subCategoryName: productForm.selectedSubCategory.name,
    thirdCategoryId: productForm.selectedThirdCategory.id,
    thirdCategoryName: productForm.selectedThirdCategory.name,
    playletGender: productForm.playletGender,
  }
}

function buildFixedProductSelection(): ProductSelectionResult {
  const nodes = findNodeByPath(defaultCategoryPath)
  const subCategory = nodes[1]
  const thirdCategory = nodes[2]

  return {
    firstCategoryId: firstCategory.id,
    firstCategoryName: firstCategory.name,
    subCategoryId: subCategory?.id ?? DEFAULT_SUB_CATEGORY_ID,
    subCategoryName: subCategory?.name ?? '都市',
    thirdCategoryId: thirdCategory?.id ?? DEFAULT_THIRD_CATEGORY_ID,
    thirdCategoryName: thirdCategory?.name ?? '其他',
    playletGender: DEFAULT_PLAYLET_GENDER,
  }
}

function confirmProductSelection() {
  const selection = buildProductSelection()
  if (!selection) {
    return
  }

  productFormError.value = ''
  emitSyncToFeishu({ drama: props.drama, productConfig: selection })
  closeProductConfig()
}

function handleDocumentClick(event: MouseEvent) {
  if (!showProductConfig.value) return
  const target = event.target as HTMLElement | null
  if (!target) return

  // 忽略级联选择器弹层的点击
  if (target.closest('.n-base-select-menu') || target.closest('.n-cascader-menu')) {
    return
  }

  if (productConfigWrapperRef.value && !productConfigWrapperRef.value.contains(target)) {
    closeProductConfig()
  }
}

function normalizePathValue(item: unknown): string | null {
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item)
  }
  if (item && typeof item === 'object') {
    const maybeValue =
      (item as any).value ?? (item as any).id ?? (item as any).key ?? (item as any).rawNode?.id
    if (maybeValue !== undefined && maybeValue !== null) {
      return String(maybeValue)
    }
  }
  return null
}

function handleCategoryValueChange(
  value: string | null,
  option: any,
  pathValues: Array<string | number | Record<string, unknown>> | null
) {
  productForm.categoryValue = value

  const deriveFromArray = (arr: Array<any> | null | undefined) => {
    if (!Array.isArray(arr)) return []
    return arr.map(normalizePathValue).filter((v): v is string => Boolean(v))
  }

  let derivedPath = deriveFromArray(pathValues)

  if (!derivedPath.length && option?.path) {
    derivedPath = deriveFromArray(option.path)
  }

  if (!derivedPath.length) {
    const singleValue = normalizePathValue(option?.value ?? option?.id ?? option)
    if (singleValue) {
      derivedPath = [singleValue]
    }
  }

  if (derivedPath.length) {
    const trimmedPath = derivedPath.slice(-2)
    const fullPath = [firstCategory.id, ...trimmedPath]
    productForm.categoryPath = fullPath
    updateCategorySelection(fullPath)
    return
  }

  if (value) {
    const fullPath = [firstCategory.id, String(value)]
    productForm.categoryPath = fullPath
    updateCategorySelection(fullPath)
    return
  }

  productForm.categoryPath = []
  productForm.selectedSubCategory = null
  productForm.selectedThirdCategory = null
}

watch(
  () => [productForm.categoryPath.join('>'), productForm.playletGender],
  () => {
    if (productFormError.value) {
      productFormError.value = ''
    }
  }
)

watch(
  () => props.isSyncing,
  value => {
    if (value) {
      closeProductConfig()
    }
  }
)

// 计算按钮显示状态
const canAddDownload = computed(() => {
  return !props.drama.feishu_downloaded && !props.drama.feishu_exists
})

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

// 工具函数
function formatPublishTime(publishTime: string | undefined): string {
  if (!publishTime || publishTime === '0000-00-00 00:00:00') {
    return '待定'
  }

  const date = dayjs.tz(publishTime, 'Asia/Shanghai')
  if (!date.isValid()) {
    return '待定'
  }

  return date.format('YYYY-MM-DD HH:mm')
}

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement
  target.src = '/placeholder-cover.svg' // 设置默认封面
}

// 下载状态相关函数
function getDownloadStatusText(taskStatus?: number): string {
  switch (taskStatus) {
    case 1:
      return '压缩中'
    case 2:
      return '完成'
    case 3:
      return '失败'
    case 4:
      return '加密中'
    default:
      return '未知'
  }
}

function getDownloadStatusIcon(taskStatus?: number): string {
  switch (taskStatus) {
    case 1:
      return 'mdi:package-variant'
    case 2:
      return 'mdi:check-circle'
    case 3:
      return 'mdi:alert-circle'
    case 4:
      return 'mdi:lock'
    default:
      return 'mdi:help-circle'
  }
}

function getDownloadStatusClass(taskStatus?: number): string {
  switch (taskStatus) {
    case 1:
      return 'status-compressing'
    case 2:
      return 'status-completed'
    case 3:
      return 'status-failed'
    case 4:
      return 'status-encrypting'
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200'
  }
}

// 获取分类标签
function getCategoryTags(drama: DramaItem): string[] {
  // 优先使用 category_tags（排行榜数据），然后是 category_text（新剧抢跑数据）
  if (drama.category_tags && Array.isArray(drama.category_tags)) {
    return drama.category_tags
  }
  if (drama.category_text) {
    return drama.category_text.split(',').map((tag: string) => tag.trim())
  }
  if (drama.category) {
    return drama.category.split(',').map((tag: string) => tag.trim())
  }
  return []
}

// 获取排名样式类
function getRankingClass(ranking: number): string {
  switch (ranking) {
    case 1:
      return 'ranking-first'
    case 2:
      return 'ranking-second'
    case 3:
      return 'ranking-third'
    default:
      return 'ranking-default'
  }
}

// 处理下载
async function handleDownload() {
  if (props.downloadData) {
    // 先复制剧名到剪贴板
    const dramaName = props.downloadData.book_name || props.downloadData.task_name || '未知剧名'
    try {
      await navigator.clipboard.writeText(dramaName)
      // 可以在这里添加复制成功的提示，但为了不干扰下载流程，我们静默处理
      console.log(`已复制剧名: ${dramaName}`)
    } catch (err) {
      console.error('复制剧名失败:', err)
      // 降级方案：使用传统的复制方法
      try {
        const textArea = document.createElement('textarea')
        textArea.value = dramaName
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        console.log(`已复制剧名: ${dramaName}`)
      } catch (fallbackErr) {
        console.error('降级复制也失败:', fallbackErr)
      }
    }

    // 然后触发下载
    emit('download', props.downloadData)
  }
}
</script>

<style scoped>
/* 短剧卡片样式 */
.drama-card {
  @apply bg-white rounded-xl border border-gray-200 p-5 hover:shadow-xl transition-all duration-300 hover:border-blue-300;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  box-shadow:
    0 2px 4px -1px rgba(0, 0, 0, 0.1),
    0 1px 2px -1px rgba(0, 0, 0, 0.06);
}

/* 增剧样式 */
.drama-card.is-new-drama {
  @apply border-red-400;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe4e6 100%);
  box-shadow:
    0 4px 12px -1px rgba(239, 68, 68, 0.2),
    0 2px 6px -1px rgba(239, 68, 68, 0.1);
}

.drama-card.is-new-drama:hover {
  @apply border-red-500 shadow-2xl;
  box-shadow:
    0 8px 20px -2px rgba(239, 68, 68, 0.25),
    0 4px 8px -2px rgba(239, 68, 68, 0.15);
}

/* 增剧标识 */
.new-drama-badge {
  @apply absolute -top-3 -right-3 z-20 bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5;
  animation: pulse-glow 2s ease-in-out infinite;
}

.badge-icon {
  @apply w-4 h-4;
  animation: fire-flicker 1.5s ease-in-out infinite;
}

.badge-text {
  @apply text-xs font-bold tracking-wide;
}

.manual-red-flag-toggle {
  @apply inline-flex items-center gap-2 rounded-full pl-2.5 pr-2 py-1.5 text-xs font-semibold transition-all duration-300;
  border: 1px solid #f5d0d6;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 245, 245, 0.92) 100%);
  color: #be123c;
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.manual-red-flag-toggle:hover:not(.disabled) {
  border-color: #fda4af;
  color: #9f1239;
  transform: translateY(-1px);
  box-shadow:
    0 14px 28px rgba(244, 63, 94, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.manual-red-flag-toggle.active {
  border-color: #fda4af;
  background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 55%, #ffeef2 100%);
  color: #9f1239;
  box-shadow:
    0 14px 30px rgba(244, 63, 94, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.manual-red-flag-toggle.disabled {
  @apply cursor-not-allowed opacity-60;
}

.manual-red-flag-badge {
  @apply inline-flex items-center gap-1.5;
}

.manual-red-flag-icon {
  @apply w-3.5 h-3.5;
}

.manual-red-flag-label {
  @apply leading-none;
  letter-spacing: 0.01em;
}

.manual-red-flag-switch {
  @apply relative inline-flex h-5 w-9 items-center rounded-full px-0.5 transition-all duration-300;
  background: linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%);
  box-shadow:
    inset 0 1px 2px rgba(15, 23, 42, 0.12),
    inset 0 -1px 1px rgba(255, 255, 255, 0.7);
}

.manual-red-flag-toggle.active .manual-red-flag-switch {
  background: linear-gradient(135deg, #fb7185 0%, #ef4444 100%);
  box-shadow:
    inset 0 1px 2px rgba(190, 24, 93, 0.22),
    0 6px 14px rgba(244, 63, 94, 0.24);
}

.manual-red-flag-thumb {
  @apply block h-4 w-4 rounded-full transition-transform duration-300;
  background: linear-gradient(135deg, #ffffff 0%, #fff1f2 100%);
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  transform: translateX(0);
}

.manual-red-flag-toggle.active .manual-red-flag-thumb {
  transform: translateX(16px);
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow:
      0 0 15px rgba(239, 68, 68, 0.6),
      0 0 30px rgba(239, 68, 68, 0.3);
  }
  50% {
    box-shadow:
      0 0 25px rgba(239, 68, 68, 0.8),
      0 0 45px rgba(239, 68, 68, 0.5);
  }
}

@keyframes fire-flicker {
  0%,
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.1);
    filter: brightness(1.3);
  }
}

/* 排名徽章样式 */
.ranking-badge {
  @apply absolute -top-2 -left-2 z-10;
}

.ranking-number {
  @apply w-8 h-8 text-white font-bold text-sm rounded-full flex items-center justify-center shadow-lg border-2 border-white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* 排名样式类 */
.ranking-first {
  @apply bg-gradient-to-br from-yellow-400 to-yellow-500;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
}

.ranking-second {
  @apply bg-gradient-to-br from-gray-300 to-gray-400;
  background: linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%);
}

.ranking-third {
  @apply bg-gradient-to-br from-amber-600 to-amber-700;
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

.ranking-default {
  @apply bg-gradient-to-br from-blue-500 to-blue-600;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.drama-content {
  @apply flex space-x-4;
}

/* 封面图片 */
.drama-poster {
  @apply flex-shrink-0;
}

.poster-container {
  @apply relative cursor-pointer;
}

.poster-image {
  @apply w-24 h-32 object-cover rounded-xl shadow-lg;
  transition: transform 0.3s ease;
}

.poster-container:hover .poster-image {
  @apply transform scale-105;
}

/* 短剧信息 */
.drama-info {
  @apply flex-1 min-w-0;
}

.drama-main {
  @apply flex items-start justify-between;
}

.drama-details {
  @apply flex-1;
}

.drama-title-section {
  @apply mb-3;
}

.drama-title-row {
  @apply flex items-start;
}

.drama-title {
  @apply text-lg font-bold text-gray-900 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors duration-300;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.abstract-button {
  @apply flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs rounded-md border border-blue-200 font-medium hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 flex-shrink-0;
}

.abstract-button:hover {
  @apply shadow-lg;
}

.abstract-icon {
  @apply w-3 h-3;
}

/* 分类标签 */
.category-tags {
  @apply flex flex-wrap gap-1.5 mb-3;
}

.category-tag {
  @apply px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs rounded-full border border-blue-200 font-medium;
  background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
  transition: all 0.3s ease;
}

.category-tag:hover {
  @apply transform scale-105 shadow-md;
}

/* 剧集信息 */
.episode-info {
  @apply mb-3;
}

.episode-item {
  @apply flex items-center space-x-2;
}

.episode-icon {
  @apply w-3.5 h-3.5 text-gray-500;
}

.episode-text {
  @apply text-xs text-gray-600 font-medium;
}

/* 发布时间 */
.publish-time {
  @apply flex items-center text-xs;
}

.time-icon {
  @apply w-3.5 h-3.5 mr-1.5 text-green-500;
}

.time-label {
  @apply text-gray-600;
}

.time-value {
  @apply font-semibold text-green-600 ml-1;
}

/* 状态和操作区域 */
.drama-actions {
  @apply flex flex-col items-end space-y-3;
}

.drama-status-row {
  @apply flex items-center justify-end gap-2 flex-wrap;
}

.status-label {
  @apply flex items-center px-3 py-1.5 text-xs rounded-full font-semibold border shadow-sm;
  transition: all 0.3s ease;
}

.status-submitting {
  @apply bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border-orange-200;
  background: linear-gradient(135deg, #fed7aa 0%, #fde68a 100%);
}

.status-label-wrapper {
  @apply flex items-center;
}

.status-icon {
  @apply w-3 h-3 mr-1.5;
}

.drama-id {
  @apply text-xs text-gray-500 font-mono bg-gray-100 px-2.5 py-1 rounded-md;
}

/* 操作按钮 */
.action-buttons {
  @apply flex flex-col items-end space-y-2;
}

/* 当仅有单个按钮时下移一点，避免贴顶 */
.action-buttons-stack {
  @apply mt-2;
}

.action-button {
  @apply flex items-center space-x-2 px-4 py-2 text-xs rounded-lg transition-all duration-300 font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5;
}

.action-button-download {
  @apply bg-gradient-to-r from-sky-500 to-sky-600 text-white hover:from-sky-600 hover:to-sky-700;
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.35);
}

.action-button-downloaded {
  @apply bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-300 cursor-not-allowed;
  background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%);
}

.action-button-submit {
  /* 天青色渐变，柔和一些 */
  background: linear-gradient(135deg, #7ec8d6 0%, #5aa9c9 100%);
  @apply text-white hover:shadow-lg;
  box-shadow: 0 10px 22px rgba(90, 169, 201, 0.28);
}

/* 合并提交按钮弱化色：低饱和天青色 */
.action-button-submit-muted {
  background: linear-gradient(135deg, #6aa8b8 0%, #4e8ba5 100%);
  @apply text-white hover:shadow-lg;
  box-shadow: 0 8px 18px rgba(78, 139, 165, 0.32);
}

.action-button-submitted {
  @apply bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-300 cursor-not-allowed;
  background: linear-gradient(135deg, #fed7aa 0%, #fde68a 100%);
}

.action-button-pending {
  @apply bg-gradient-to-r from-gray-100 to-slate-100 text-gray-600 border border-gray-300 cursor-not-allowed;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
}

.action-button-sync {
  @apply text-white;
}

.action-button-sync-download {
  @apply bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700;
  box-shadow: 0 10px 25px rgba(249, 115, 22, 0.35);
}

.action-button-sync-clip {
  @apply bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700;
  box-shadow: 0 10px 25px rgba(59, 130, 246, 0.35);
}

/* 按钮组 */
.action-button-group {
  @apply flex items-center gap-2;
}

/* 购物车按钮 */
.action-button-cart {
  @apply bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white;
  @apply px-3 py-2 rounded-lg;
  box-shadow: 0 10px 25px rgba(124, 58, 237, 0.35);
  transition: all 0.3s ease;
}

.action-button-cart:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(124, 58, 237, 0.45);
}

.action-button-cart:disabled {
  @apply opacity-50 cursor-not-allowed;
  transform: none;
}

/* 已提交状态徽章 */
.status-badge {
  @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm;
  transition: all 0.3s ease;
}

.status-submitted {
  @apply bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200;
}

.status-submitted .status-icon {
  @apply text-green-600 text-lg;
}

.button-icon {
  @apply w-3.5 h-3.5;
}

.product-config-wrapper {
  @apply relative flex flex-col items-end;
}

.product-popover {
  @apply absolute left-full top-0 ml-4 bg-white border border-gray-200 rounded-2xl shadow-2xl w-72 p-4;
  /* z-index: 9999; */
}

.product-popover-header {
  @apply flex items-center justify-between;
}

.popover-title {
  @apply text-base font-semibold text-gray-900;
}

.popover-subtitle {
  @apply text-xs text-gray-500;
}

.product-popover-section {
  @apply mt-4;
}

.section-title {
  @apply text-sm font-semibold text-gray-700 mb-2;
}

.field-group {
  @apply flex flex-col space-y-1;
}

.field-label {
  @apply text-xs text-gray-500;
}

.product-select {
  @apply w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white;
}

.category-pill {
  @apply inline-flex items-center px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium;
}

.product-cascader {
  @apply w-full;
}

.product-cascader :deep(.n-input) {
  @apply border border-gray-200 rounded-lg text-sm bg-white;
}

.product-tags {
  @apply flex flex-wrap gap-2;
}

.product-tag {
  @apply inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100;
}

.product-tag.muted {
  @apply bg-gray-100 text-gray-500 border-transparent;
}

.gender-options {
  @apply flex items-center gap-3;
}

.gender-option {
  @apply px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 cursor-pointer transition-colors duration-200 select-none;
}

.gender-option.active {
  @apply border-purple-500 text-purple-600 bg-purple-50;
}

.product-form-error {
  @apply text-xs text-red-500 mt-3;
}

.popover-actions {
  @apply mt-4 flex items-center justify-end gap-3;
}

.popover-button {
  @apply px-4 py-1.5 text-sm rounded-lg font-medium transition-colors duration-200;
}

.popover-button.muted {
  @apply border border-gray-200 text-gray-600 hover:bg-gray-50;
}

.popover-button.primary {
  @apply bg-purple-600 text-white hover:bg-purple-700;
}

.modal-actions {
  @apply mt-5 flex justify-end gap-3;
}

.product-popover :deep(.n-cascader-menu),
.product-modal :deep(.n-cascader-menu),
.product-popover :deep(.n-base-select-menu),
.product-modal :deep(.n-base-select-menu) {
  overscroll-behavior: contain;
}

.product-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 9999;
}

.product-modal {
  @apply bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-4;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-close {
  @apply text-gray-500 text-xl leading-none px-2;
}

.modal-close:hover {
  @apply text-gray-700;
}

.btn-cancel {
  @apply px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white transition-colors duration-200;
}

.btn-cancel:hover {
  @apply border-gray-300 text-gray-900;
}

.btn-confirm {
  @apply px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-500 shadow-md transition-transform duration-200;
}

.btn-confirm:hover {
  @apply from-purple-600 to-indigo-600;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

/* 下载状态样式 */
.status-compressing {
  @apply bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-800 border-yellow-200;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.status-completed {
  @apply bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-green-200;
  background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%);
}

.status-failed {
  @apply bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border-red-200;
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
}

.status-encrypting {
  @apply bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border-blue-200;
  background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .drama-content {
    @apply flex-col space-x-0 space-y-4;
  }

  .drama-poster {
    @apply self-center;
  }

  .drama-actions {
    @apply items-center;
  }

  .drama-status-row {
    @apply justify-center;
  }
}

/* 悬停效果增强 */
.drama-card:hover {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.category-tag:hover {
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  @apply text-white;
}
</style>
