<template>
  <n-drawer v-model:show="visible" :width="400" placement="right">
    <n-drawer-content title="列设置" closable>
      <div class="column-manager">
        <!-- 列配置列表 -->
        <div class="column-list">
          <draggable
            v-model="localConfig"
            item-key="key"
            handle=".drag-handle"
            class="drag-container"
          >
            <template #item="{ element: column, index }">
              <div class="column-item">
                <div class="column-info">
                  <div class="drag-handle">
                    <svg
                      class="drag-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 6h16M4 12h16M4 18h16"
                      ></path>
                    </svg>
                  </div>
                  <n-checkbox
                    v-model:checked="column.visible"
                    @update:checked="handleVisibilityChange(index, $event)"
                    class="column-checkbox"
                  >
                    <span class="column-title">{{ column.title }}</span>
                  </n-checkbox>
                </div>
              </div>
            </template>
          </draggable>
        </div>

        <!-- 操作按钮 -->
        <div class="actions">
          <n-space>
            <n-button @click="resetToDefault">重置默认</n-button>
            <n-button @click="handleCancel">取消</n-button>
            <n-button type="primary" @click="applyConfig">确定</n-button>
          </n-space>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import draggable from 'vuedraggable'

export interface ColumnConfig {
  key: string
  title: string
  visible: boolean
}

interface Props {
  show: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: DataTableColumns<any>
  config: ColumnConfig[]
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'update:config', value: ColumnConfig[]): void
  (e: 'apply', value: ColumnConfig[]): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isApplying = ref(false) // 标记是否正在应用配置

const visible = computed({
  get: () => props.show,
  set: value => {
    emit('update:show', value)
    if (!value && !isApplying.value) {
      // 只有在非应用状态下关闭抽屉时才还原到原始配置
      emit('update:config', [...originalConfig.value])
      emit('cancel')
    }
    if (!value) {
      isApplying.value = false // 重置标记
    }
  },
})

const localConfig = ref<ColumnConfig[]>([])
const originalConfig = ref<ColumnConfig[]>([]) // 保存原始配置用于还原

// 初始化本地配置
function initLocalConfig() {
  if (props.config.length > 0) {
    localConfig.value = [...props.config]
    originalConfig.value = [...props.config] // 保存原始配置
  } else {
    // 基于原始列配置创建默认配置
    const defaultConfig = props.columns
      .filter(col => 'key' in col && 'title' in col)
      .map(col => {
        const column = col as { key: string; title: string }
        return {
          key: column.key as string,
          title: column.title as string,
          visible: true,
        }
      })
    localConfig.value = [...defaultConfig]
    originalConfig.value = [...defaultConfig] // 保存原始配置
  }
}

// 处理可见性变化
function handleVisibilityChange(index: number, visible: boolean) {
  localConfig.value[index].visible = visible
  // 立即应用变化
  emit('update:config', [...localConfig.value])
}

// 重置为默认配置
function resetToDefault() {
  const defaultConfig = props.columns
    .filter(col => 'key' in col && 'title' in col)
    .map(col => {
      const column = col as { key: string; title: string }
      return {
        key: column.key as string,
        title: column.title as string,
        visible: true,
      }
    })
  localConfig.value = [...defaultConfig]
  // 立即应用变化
  emit('update:config', [...localConfig.value])
}

// 应用配置
function applyConfig() {
  isApplying.value = true // 设置应用标记
  // 更新原始配置为当前配置，这样下次打开时不会还原
  originalConfig.value = [...localConfig.value]
  emit('apply', [...localConfig.value])
  visible.value = false
}

// 取消配置
function handleCancel() {
  visible.value = false
}

// 监听显示状态变化
watch(
  () => props.show,
  show => {
    if (show) {
      initLocalConfig()
    }
  }
)

// 监听原始列配置变化
watch(
  () => props.columns,
  () => {
    if (visible.value) {
      initLocalConfig()
    }
  },
  { deep: true }
)

// 监听本地配置变化，实时应用到表格
watch(
  localConfig,
  newConfig => {
    if (visible.value) {
      emit('update:config', [...newConfig])
    }
  },
  { deep: true }
)
</script>

<style scoped>
.column-manager {
  @apply flex flex-col h-full;
}

.column-list {
  @apply flex-1 overflow-y-auto mb-6;
}

.drag-container {
  @apply space-y-3;
}

.column-item {
  @apply p-3 border border-gray-200 rounded-lg bg-gray-50 transition-all duration-200;
}

.column-item:hover {
  @apply bg-gray-100 border-gray-300;
}

.column-item.sortable-ghost {
  @apply opacity-50 bg-blue-50 border-blue-200;
}

.column-item.sortable-chosen {
  @apply bg-blue-50 border-blue-300;
}

.column-info {
  @apply flex items-center gap-3;
}

.drag-handle {
  @apply cursor-move p-1 rounded hover:bg-gray-200 transition-colors duration-200;
}

.drag-icon {
  @apply w-4 h-4 text-gray-400;
}

.drag-handle:hover .drag-icon {
  @apply text-gray-600;
}

.column-checkbox {
  @apply flex-1;
}

.column-title {
  @apply text-sm font-medium text-gray-700;
}

.actions {
  @apply flex justify-end gap-2 pt-4 border-t border-gray-200 mt-auto;
}

/* 抽屉内容样式优化 */
:deep(.n-drawer-content) {
  @apply flex flex-col;
}

:deep(.n-drawer-content .n-drawer-body) {
  @apply flex-1 flex flex-col;
}
</style>
