<template>
  <n-select
    v-model:value="selectedRange"
    :options="dateRangeOptions"
    placeholder="选择时间范围"
    @update:value="handleRangeChange"
    :class="className"
    clearable
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

// 配置 dayjs 插件
dayjs.extend(utc)
dayjs.extend(timezone)

interface Props {
  modelValue?: [string, string] | null
  className?: string
  options?: Array<{ label: string; value: string }> // 自定义选项
}

interface Emits {
  (e: 'update:modelValue', value: [string, string] | null): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  className: 'w-40',
  options: undefined,
})

const emit = defineEmits<Emits>()

const selectedRange = ref<string | null>(null)

// 默认日期范围选项
const defaultDateRangeOptions = [
  { label: '今日', value: 'today' },
  { label: '近3日', value: '3days' },
  { label: '近7日', value: '7days' },
  { label: '近15日', value: '15days' },
  { label: '近30日', value: '30days' },
  { label: '本月', value: 'month' },
  { label: '至今', value: 'all' },
]

// 使用自定义选项或默认选项
const dateRangeOptions = computed(() => {
  return props.options || defaultDateRangeOptions
})

// 计算日期范围的函数
function calculateDateRange(rangeType: string): [string, string] {
  const now = dayjs().tz('Asia/Shanghai')

  switch (rangeType) {
    case 'today':
      return [now.format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case '3days':
      return [now.subtract(2, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case '7days':
      return [now.subtract(6, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case '15days':
      return [now.subtract(14, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case '30days':
      return [now.subtract(29, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case 'month':
      return [now.startOf('month').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]

    case 'all':
      return [
        '2025-09-01', // 从2025年9月1日开始
        now.format('YYYY-MM-DD'),
      ]

    default:
      return [now.format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]
  }
}

// 处理范围变化
function handleRangeChange(value: string | null) {
  if (value) {
    const dateRange = calculateDateRange(value)
    emit('update:modelValue', dateRange)
  } else {
    emit('update:modelValue', null)
  }
}

// 监听外部值变化，同步到内部状态
watch(
  () => props.modelValue,
  newValue => {
    if (!newValue) {
      selectedRange.value = null
      return
    }

    // 根据日期范围反推选项
    const [start, end] = newValue
    const now = dayjs().tz('Asia/Shanghai')

    // 检查是否是预设的日期范围
    if (start === end && start === now.format('YYYY-MM-DD')) {
      selectedRange.value = 'today'
    } else if (
      start === now.subtract(2, 'day').format('YYYY-MM-DD') &&
      end === now.format('YYYY-MM-DD')
    ) {
      selectedRange.value = '3days'
    } else if (
      start === now.subtract(6, 'day').format('YYYY-MM-DD') &&
      end === now.format('YYYY-MM-DD')
    ) {
      selectedRange.value = '7days'
    } else if (
      start === now.subtract(14, 'day').format('YYYY-MM-DD') &&
      end === now.format('YYYY-MM-DD')
    ) {
      selectedRange.value = '15days'
    } else if (
      start === now.subtract(29, 'day').format('YYYY-MM-DD') &&
      end === now.format('YYYY-MM-DD')
    ) {
      selectedRange.value = '30days'
    } else if (
      start === now.startOf('month').format('YYYY-MM-DD') &&
      end === now.format('YYYY-MM-DD')
    ) {
      selectedRange.value = 'month'
    } else if (start === '2025-09-01' && end === now.format('YYYY-MM-DD')) {
      selectedRange.value = 'all'
    } else {
      // 自定义范围，清空选择
      selectedRange.value = null
    }
  },
  { immediate: true }
)

// 暴露方法给父组件
defineExpose({
  calculateDateRange,
})
</script>

<style scoped>
/* 可以添加自定义样式 */
</style>
