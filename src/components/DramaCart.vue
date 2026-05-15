<template>
  <div class="drama-cart-container" :class="{ 'is-inline': inline }">
    <!-- 购物车图标按钮 -->
    <button
      ref="cartTriggerRef"
      type="button"
      class="cart-trigger"
      :class="{ 'has-items': cartItems.length > 0 }"
      aria-label="打开待提交剧集"
      @click="toggleCart"
    >
      <Icon icon="mdi:playlist-plus" class="cart-icon" />
      <span v-if="cartItems.length > 0" class="cart-badge">{{ cartItems.length }}</span>
    </button>

    <!-- 购物车面板 -->
    <transition name="slide-fade">
      <div
        v-if="isOpen"
        ref="cartPanelRef"
        class="cart-panel"
        :style="{ '--cart-panel-max-height': `${panelMaxHeight}px` }"
      >
        <div class="cart-header">
          <h3 class="cart-title">待提交剧集</h3>
          <div class="cart-header-actions">
            <button @click="clearAll" class="clear-btn" v-if="cartItems.length > 0">
              <Icon icon="mdi:delete-outline" class="w-4 h-4" />
              清空
            </button>
            <button
              type="button"
              class="cart-close-btn"
              aria-label="关闭待提交剧集"
              @click="closeCart"
            >
              <Icon icon="mdi:close" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="cart-body">
          <div v-if="cartItems.length === 0" class="empty-cart">
            <Icon icon="mdi:cart-outline" class="empty-icon" />
            <p class="empty-text">暂无待提交剧集</p>
            <p class="empty-hint">点击剧集的"新增待下载"按钮添加</p>
          </div>

          <div v-else class="cart-list">
            <div
              v-for="item in cartItems"
              :key="item.book_id"
              class="cart-item"
              :class="{ submitting: submittingIds.has(item.book_id) }"
            >
              <div class="item-content">
                <div class="item-name">{{ item.series_name }}</div>
                <div class="item-meta">
                  <span class="item-date">{{ item.publish_time.split(' ')[0] }}</span>
                  <span v-if="item.manualRedFlag || item.autoRedFlag" class="item-red-flag"
                    >红标</span
                  >
                  <span v-if="item.feishuTableGroupName" class="item-date">
                    {{ item.feishuTableGroupName }}
                  </span>
                </div>
              </div>
              <button
                @click="removeItem(item.book_id)"
                class="remove-btn"
                :disabled="submittingIds.has(item.book_id)"
              >
                <Icon icon="mdi:close" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div class="cart-footer" v-if="cartItems.length > 0">
          <div class="footer-info">
            <div class="footer-counts">
              <span class="total-count">共 {{ cartItems.length }} 部剧</span>
              <span v-if="submittingCount > 0" class="submitting-count">
                提交中: {{ submittingCount }}/{{ cartItems.length }}
              </span>
            </div>
            <button
              type="button"
              @click="clearAll"
              class="footer-clear-btn"
              :disabled="isSubmitting"
            >
              <Icon icon="mdi:delete-outline" class="w-4 h-4" />
              清空
            </button>
          </div>
          <button
            @click="submitAll"
            class="submit-btn"
            :disabled="isSubmitting || cartItems.length === 0"
          >
            <Icon v-if="isSubmitting" icon="mdi:loading" class="w-4 h-4 animate-spin mr-1" />
            {{ isSubmitting ? '提交中...' : '批量提交' }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { useMessage } from 'naive-ui'
import { batchSubmitDownload } from '@/api/index'

const message = useMessage()

const props = defineProps<{
  inline?: boolean
  scopeKey?: string
}>()

// 购物车项类型
export interface CartItem {
  book_id: string
  series_name: string
  publish_time: string
  manualRedFlag?: boolean // 是否手动开启红标
  autoRedFlag?: boolean // 是否命中首发时间自动红标
  fromSearchResult?: boolean // 是否来自搜索结果
  feishuTableGroupId?: string
  feishuTableGroupName?: string
}

// 定义 emits
const emit = defineEmits<{
  'batch-submitted': [bookIds: string[], scopeKey: string]
  'items-changed': [bookIds: string[]]
}>()

// 状态
const isOpen = ref(false)
const cartItems = ref<CartItem[]>([])
const submittingIds = ref<Set<string>>(new Set())
const isSubmitting = ref(false)
const cartTriggerRef = ref<HTMLElement | null>(null)
const cartPanelRef = ref<HTMLElement | null>(null)
const panelMaxHeight = ref(400)

// 计算属性
const submittingCount = computed(() => submittingIds.value.size)

function emitItemsChanged() {
  emit(
    'items-changed',
    cartItems.value.map(item => item.book_id)
  )
}

// 切换购物车显示
function toggleCart() {
  const nextOpen = !isOpen.value
  isOpen.value = nextOpen
  if (nextOpen) {
    nextTick(updatePanelMaxHeight)
  }
}

function closeCart() {
  isOpen.value = false
}

function updatePanelMaxHeight() {
  if (!isOpen.value || !cartTriggerRef.value) return

  const triggerRect = cartTriggerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const panelGap = 8
  const viewportPadding = 16
  const availableHeight = props.inline
    ? viewportHeight - triggerRect.bottom - panelGap - viewportPadding
    : triggerRect.top - panelGap - viewportPadding

  panelMaxHeight.value = Math.max(220, Math.min(400, Math.floor(availableHeight)))
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value || !(event.target instanceof Node)) return

  const target = event.target
  if (cartTriggerRef.value?.contains(target) || cartPanelRef.value?.contains(target)) {
    return
  }

  closeCart()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('resize', updatePanelMaxHeight)
  window.addEventListener('scroll', updatePanelMaxHeight, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', updatePanelMaxHeight)
  window.removeEventListener('scroll', updatePanelMaxHeight, true)
})

// 添加剧集到购物车（带抛物线动画）
function addItem(item: CartItem) {
  // 检查是否已存在
  if (cartItems.value.some(i => i.book_id === item.book_id)) {
    message.warning('该剧集已在待提交列表中')
    return
  }

  // 添加到购物车
  cartItems.value.push(item)
  emitItemsChanged()
  message.success(`已添加: ${item.series_name}`)
}

function addItems(items: CartItem[]) {
  if (items.length === 0) {
    message.info('暂无可加入的剧集')
    return { addedCount: 0, skippedCount: 0 }
  }

  const existingBookIds = new Set(cartItems.value.map(item => item.book_id))
  const nextItems = items.filter(item => !existingBookIds.has(item.book_id))
  const skippedCount = items.length - nextItems.length

  if (nextItems.length === 0) {
    message.info('当前日期可加入的剧集已全部在购物车中')
    return { addedCount: 0, skippedCount }
  }

  cartItems.value.push(...nextItems)
  emitItemsChanged()
  message.success(
    skippedCount > 0
      ? `已加入 ${nextItems.length} 部，跳过 ${skippedCount} 部已在购物车中的剧`
      : `已加入 ${nextItems.length} 部剧`
  )

  return { addedCount: nextItems.length, skippedCount }
}

// 移除单个剧集
function removeItem(bookId: string) {
  const index = cartItems.value.findIndex(item => item.book_id === bookId)
  if (index > -1) {
    const item = cartItems.value[index]
    cartItems.value.splice(index, 1)
    emitItemsChanged()
    message.info(`已移除: ${item.series_name}`)
  }
}

// 更新购物车中剧集的红标状态
function updateItemRedFlag(bookId: string, manualRedFlag: boolean) {
  const targetItem = cartItems.value.find(item => item.book_id === bookId)
  if (!targetItem) {
    return
  }

  targetItem.manualRedFlag = manualRedFlag
}

function hasItem(bookId: string) {
  return cartItems.value.some(item => item.book_id === bookId)
}

// 清空购物车
function clearAll() {
  if (isSubmitting.value) {
    message.warning('提交进行中，无法清空')
    return
  }
  cartItems.value = []
  emitItemsChanged()
  message.info('已清空待提交列表')
}

function resetForScopeChange() {
  cartItems.value = []
  submittingIds.value.clear()
  isSubmitting.value = false
  closeCart()
  emitItemsChanged()
}

// 批量提交
async function submitAll() {
  if (cartItems.value.length === 0) return

  isSubmitting.value = true
  submittingIds.value.clear()

  try {
    message.info(`正在提交 ${cartItems.value.length} 部剧集到服务端...`)

    // 保存提交的 book_id 列表
    const submittedBookIds = cartItems.value.map(item => item.book_id)
    const submitScopeKey = props.scopeKey || ''

    // 调用服务端批量提交接口（立即返回，后台异步执行）
    const response = await batchSubmitDownload(cartItems.value)

    if (response.code === 0) {
      const { taskId, total } = response.data

      message.success(`已提交 ${total} 部剧集，任务ID: ${taskId}，服务端正在后台处理`)
      console.log(`[批量提交] 任务已提交到服务端，任务ID: ${taskId}`)
      console.log(`[批量提交] 可在服务端日志中查看处理进度: ~/.pm2/logs/changdu-web-out.log`)

      // 触发事件，通知父组件更新已提交状态
      emit('batch-submitted', submittedBookIds, submitScopeKey)

      // 清空购物车
      cartItems.value = []
      submittingIds.value.clear()
      emitItemsChanged()
      closeCart()
    } else {
      throw new Error(response.message || '批量提交失败')
    }
  } catch (error) {
    console.error('批量提交失败:', error)
    const errorMessage = error instanceof Error ? error.message : '批量提交失败，请重试'
    message.error(errorMessage)
  } finally {
    isSubmitting.value = false
  }
}

// 开始提交（由父组件调用）
function startSubmitting() {
  isSubmitting.value = true
  submittingIds.value.clear()
}

// 标记某个剧集正在提交（由父组件调用）
function markSubmitting(bookId: string) {
  submittingIds.value.add(bookId)
}

// 提交完成（由父组件调用）
function finishSubmitting(success: boolean, successCount?: number, failedCount?: number) {
  isSubmitting.value = false

  if (success) {
    // 清空购物车
    cartItems.value = []
    submittingIds.value.clear()
    emitItemsChanged()
    closeCart()

    if (successCount !== undefined) {
      if (failedCount && failedCount > 0) {
        message.warning(`提交完成: 成功 ${successCount} 部，失败 ${failedCount} 部`)
      } else {
        message.success(`成功提交 ${successCount} 部剧集`)
      }
    }
  } else {
    submittingIds.value.clear()
  }
}

// 暴露方法给父组件
defineExpose({
  addItem,
  addItems,
  removeItem,
  hasItem,
  updateItemRedFlag,
  clearAll,
  resetForScopeChange,
  closeCart,
  startSubmitting,
  markSubmitting,
  finishSubmitting,
})
</script>

<style scoped>
.drama-cart-container {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 1000;
}

.drama-cart-container.is-inline {
  position: relative;
  right: auto;
  bottom: auto;
  z-index: 1000;
  margin-left: auto;
}

/* 购物车触发按钮 */
.cart-trigger {
  position: relative;
  width: 46px;
  height: 46px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 10px 28px -18px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
  backdrop-filter: blur(12px);
}

.cart-trigger:hover {
  transform: translateY(-2px);
  border-color: rgba(14, 165, 233, 0.35);
  background: #fff;
  box-shadow:
    0 16px 34px -20px rgba(14, 165, 233, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.cart-trigger.has-items {
  animation: bounce 0.5s ease;
  border-color: rgba(14, 165, 233, 0.32);
  background: linear-gradient(135deg, #f0f9ff 0%, #ecfeff 100%);
}

@keyframes bounce {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.cart-icon {
  width: 22px;
  height: 22px;
  color: #0284c7;
}

.cart-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f97316;
  color: white;
  font-size: 12px;
  font-weight: bold;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  box-shadow: 0 6px 14px rgba(249, 115, 22, 0.3);
}

/* 购物车面板 */
.cart-panel {
  position: absolute;
  bottom: 58px;
  right: 0;
  width: 300px;
  max-height: min(400px, var(--cart-panel-max-height, calc(100dvh - 120px)));
  background: white;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
}

.drama-cart-container.is-inline .cart-panel {
  top: 54px;
  bottom: auto;
}

@media (max-width: 640px) {
  .drama-cart-container.is-inline {
    margin-left: 8px;
  }

  .cart-trigger {
    width: 40px;
    height: 40px;
    border-radius: 14px;
  }

  .cart-icon {
    width: 20px;
    height: 20px;
  }

  .drama-cart-container.is-inline .cart-panel {
    position: fixed;
    top: auto;
    left: 12px;
    right: 12px;
    bottom: 12px;
    width: auto;
    height: min(64dvh, 440px);
    max-height: calc(100dvh - 24px);
    border-radius: 20px;
  }

  .drama-cart-container.is-inline .cart-body {
    min-height: 0;
    max-height: none;
  }
}

/* 头部 */
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%);
}

.cart-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  min-width: 0;
}

.cart-header-actions {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #fff;
  color: #64748b;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #fff7ed;
  color: #ea580c;
}

.cart-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.cart-close-btn:hover {
  border-color: rgba(14, 165, 233, 0.28);
  background: #f8fafc;
  color: #0f172a;
}

/* 内容区 */
.cart-body {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}

.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #9ca3af;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 4px 0;
}

.empty-hint {
  font-size: 12px;
  margin: 0;
  text-align: center;
}

/* 列表 */
.cart-list {
  padding: 8px;
}

.cart-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  background: #f9fafb;
  border-radius: 8px;
  transition: all 0.2s;
}

.cart-item:hover {
  background: #f3f4f6;
}

.cart-item.submitting {
  opacity: 0.6;
  pointer-events: none;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.item-date {
  color: #6b7280;
}

.item-red-flag {
  padding: 2px 8px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}

.remove-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #6b7280;
}

.remove-btn:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.remove-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 底部 */
.cart-footer {
  flex-shrink: 0;
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.footer-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 13px;
}

.footer-counts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.total-count {
  color: #1f2937;
  font-weight: 500;
}

.submitting-count {
  color: #3b82f6;
  font-size: 12px;
}

.footer-clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 4px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
}

.footer-clear-btn:hover:not(:disabled) {
  background: #fff7ed;
  color: #ea580c;
}

.footer-clear-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.submit-btn {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.28);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 过渡动画 */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
