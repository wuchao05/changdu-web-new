<template>
  <div class="date-range-picker flex items-center gap-2">
    <!-- 模式切换按钮 -->
    <n-button-group>
      <n-button
        :type="mode === 'preset' ? 'primary' : 'default'"
        size="small"
        @click="switchMode('preset')"
      >
        <template #icon>
          <Icon icon="mdi:calendar-clock" />
        </template>
        快捷
      </n-button>
      <n-button
        :type="mode === 'custom' ? 'primary' : 'default'"
        size="small"
        @click="switchMode('custom')"
      >
        <template #icon>
          <Icon icon="mdi:calendar-range" />
        </template>
        自定义
      </n-button>
    </n-button-group>

    <!-- 快捷日期选择 -->
    <n-select
      v-if="mode === 'preset'"
      v-model:value="selectedPreset"
      :options="effectivePresetOptions"
      placeholder="选择时间范围"
      @update:value="handlePresetChange"
      :class="selectClassName"
      clearable
    />

    <!-- 自定义日期选择 -->
    <n-date-picker
      v-else
      v-model:value="customDateRange"
      type="daterange"
      clearable
      :placeholder="['开始日期', '结束日期']"
      @update:value="handleCustomDateChange"
      :class="selectClassName"
      format="yyyy-MM-dd"
      :actions="['clear', 'confirm']"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

// 配置 dayjs 插件
dayjs.extend(utc)
dayjs.extend(timezone)

interface Props {
  modelValue?: [string, string] | null
  className?: string
  selectClassName?: string
  // 自定义快捷选项
  presetOptions?: Array<{ label: string; value: string }>
}

interface Emits {
  (e: 'update:modelValue', value: [string, string] | null): void
  (e: 'update:presetLabel', label: string | null): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  className: '',
  selectClassName: 'w-40',
  presetOptions: undefined,
})

const emit = defineEmits<Emits>()

// 日期模式：preset(快捷) 或 custom(自定义)
const mode = ref<'preset' | 'custom'>('preset')

// 快捷日期选择的值
const selectedPreset = ref<string | null>(null)

// 自定义日期范围的值 (timestamp)
const customDateRange = ref<[number, number] | null>(null)

// 默认快捷日期选项
const defaultPresetOptions = [
  { label: '今日', value: 'today' },
  { label: '近3日', value: '3days' },
  { label: '近7日', value: '7days' },
  { label: '本月', value: 'month' },
  { label: '上个月', value: 'lastMonth' },
  { label: '至今', value: 'all' },
]

// 使用自定义选项或默认选项
const effectivePresetOptions = computed(() => {
  return props.presetOptions || defaultPresetOptions
})

// 切换模式
function switchMode(newMode: 'preset' | 'custom') {
  mode.value = newMode

  // 切换模式时，如果当前有值，尝试转换
  if (newMode === 'custom' && props.modelValue) {
    const [start, end] = props.modelValue
    customDateRange.value = [dayjs(start).valueOf(), dayjs(end).valueOf()]
    emit('update:presetLabel', null) // 切换到自定义，清空快捷标签
  } else if (newMode === 'preset' && props.modelValue) {
    // 尝试匹配预设选项
    const matchedPreset = findMatchingPreset(props.modelValue)
    selectedPreset.value = matchedPreset
    if (matchedPreset) {
      const option = effectivePresetOptions.value.find(opt => opt.value === matchedPreset)
      emit('update:presetLabel', option?.label || null)
    }
  }
}

// 计算快捷日期范围
function calculatePresetRange(presetType: string): [string, string] {
  const now = dayjs().tz('Asia/Shanghai')

  switch (presetType) {
    case 'today':
      return [now.format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case '3days':
      return [now.subtract(2, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case '7days':
      return [now.subtract(6, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case 'month':
      return [now.startOf('month').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case 'lastMonth':
      return [
        now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
      ]

    case 'all':
      return ['2025-09-01', now.format('YYYY-MM-DD')]

    default:
      return [now.format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]
  }
}

// 查找匹配的预设选项
function findMatchingPreset(dateRange: [string, string]): string | null {
  const [start, end] = dateRange
  const now = dayjs().tz('Asia/Shanghai')

  // 检查是否匹配预设日期范围
  if (start === end && start === now.format('YYYY-MM-DD')) {
    return 'today'
  } else if (
    start === now.subtract(2, 'day').format('YYYY-MM-DD') &&
    end === now.format('YYYY-MM-DD')
  ) {
    return '3days'
  } else if (
    start === now.subtract(6, 'day').format('YYYY-MM-DD') &&
    end === now.format('YYYY-MM-DD')
  ) {
    return '7days'
  } else if (
    start === now.startOf('month').format('YYYY-MM-DD') &&
    end === now.format('YYYY-MM-DD')
  ) {
    return 'month'
  } else if (
    start === now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD') &&
    end === now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
  ) {
    return 'lastMonth'
  } else if (start === '2025-09-01' && end === now.format('YYYY-MM-DD')) {
    return 'all'
  }

  return null
}

// 处理快捷日期变化
function handlePresetChange(value: string | null) {
  if (value) {
    const dateRange = calculatePresetRange(value)
    emit('update:modelValue', dateRange)
    // 发送快捷日期标签
    const option = effectivePresetOptions.value.find(opt => opt.value === value)
    emit('update:presetLabel', option?.label || null)
  } else {
    emit('update:modelValue', null)
    emit('update:presetLabel', null)
  }
}

// 处理自定义日期变化
function handleCustomDateChange(value: [number, number] | null) {
  if (value) {
    const [start, end] = value
    const dateRange: [string, string] = [
      dayjs(start).format('YYYY-MM-DD'),
      dayjs(end).format('YYYY-MM-DD'),
    ]
    emit('update:modelValue', dateRange)
    emit('update:presetLabel', null) // 自定义日期，清空快捷标签
  } else {
    emit('update:modelValue', null)
    emit('update:presetLabel', null)
  }
}

// 监听外部值变化
watch(
  () => props.modelValue,
  newValue => {
    if (!newValue) {
      selectedPreset.value = null
      customDateRange.value = null
      emit('update:presetLabel', null)
      return
    }

    // 尝试匹配预设选项
    const matchedPreset = findMatchingPreset(newValue)

    if (matchedPreset && mode.value === 'preset') {
      selectedPreset.value = matchedPreset
      const option = effectivePresetOptions.value.find(opt => opt.value === matchedPreset)
      emit('update:presetLabel', option?.label || null)
    } else if (mode.value === 'custom') {
      const [start, end] = newValue
      customDateRange.value = [dayjs(start).valueOf(), dayjs(end).valueOf()]
      emit('update:presetLabel', null)
    }
  },
  { immediate: true }
)

// 暴露方法
defineExpose({
  calculatePresetRange,
  switchMode,
})
</script>

<style scoped>
.date-range-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

:deep(.n-date-picker) {
  min-width: 280px;
}
</style>
