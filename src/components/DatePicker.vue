<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      @click.self="handleCancel"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl p-6 w-[32rem] max-w-2xl mx-4 transform transition-all duration-300"
      >
        <!-- 头部 -->
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">选择剪辑日期</h3>
            <p class="text-xs text-gray-500 mt-1">为剧集选择剪辑日期</p>
          </div>
          <button
            @click="handleCancel"
            class="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <!-- 剧集信息 -->
        <div
          class="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100"
        >
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Icon icon="mdi:video" class="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p class="text-xs text-gray-600">剧集名称</p>
              <p class="text-sm font-medium text-gray-900 truncate">{{ dramaName }}</p>
            </div>
          </div>
        </div>

        <!-- 未来10天日期选择 -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-gray-800">选择日期</p>
            <div class="flex items-center space-x-1 text-xs text-gray-500">
              <Icon icon="mdi:calendar-clock" class="w-4 h-4" />
              <span>未来10天</span>
            </div>
          </div>
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="dateOption in futureDates"
              :key="dateOption.value"
              @click="selectDate(dateOption.value)"
              :class="[
                'flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-200 text-center group relative overflow-hidden w-20 h-16',
                selectedDate === dateOption.value
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md transform scale-105'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100 hover:shadow-sm hover:scale-102',
              ]"
            >
              <!-- 背景装饰 -->
              <div
                v-if="selectedDate === dateOption.value"
                class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10 rounded-lg"
              ></div>

              <!-- 内容 -->
              <div class="relative z-10 flex flex-col items-center">
                <Icon
                  :icon="dateOption.icon"
                  :class="[
                    'w-3 h-3 mb-1 transition-colors duration-200',
                    selectedDate === dateOption.value ? 'text-blue-600' : dateOption.colorClass,
                  ]"
                />
                <span
                  :class="[
                    'text-sm font-semibold mb-0.5 transition-colors duration-200',
                    selectedDate === dateOption.value ? 'text-blue-700' : 'text-gray-800',
                  ]"
                >
                  {{ dateOption.date }}
                </span>
                <span
                  :class="[
                    'text-xs transition-colors duration-200',
                    selectedDate === dateOption.value ? 'text-blue-600' : 'text-gray-500',
                  ]"
                >
                  {{ dateOption.label }}
                </span>
              </div>

              <!-- 选中状态指示器 -->
              <div
                v-if="selectedDate === dateOption.value"
                class="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full"
              ></div>
            </button>
          </div>
        </div>

        <!-- 选中的日期显示 -->
        <div
          v-if="selectedDate"
          class="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm"
        >
          <div class="flex items-center space-x-3">
            <div
              class="w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center shadow-sm"
            >
              <Icon icon="mdi:check-circle" class="w-4 h-4 text-green-600" />
            </div>
            <div class="flex-1">
              <p class="text-xs text-green-600 font-semibold mb-1">已选择日期</p>
              <p class="text-sm font-bold text-green-800">
                {{ formatSelectedDate }}
              </p>
            </div>
            <div class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-end space-x-3 pt-2">
          <button
            @click="handleCancel"
            class="px-6 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            取消
          </button>
          <button
            @click="handleConfirm"
            :disabled="!selectedDate || loading"
            class="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 border border-transparent rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
          >
            <Icon v-if="loading" icon="mdi:loading" class="w-4 h-4 animate-spin" />
            <Icon v-else icon="mdi:check" class="w-4 h-4" />
            <span>{{ loading ? '处理中...' : '确认' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
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
  show: boolean
  dramaName: string
  loading?: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'confirm', date: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<Emits>()

// 当前日期
const today = dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD')

// 选中的日期
const selectedDate = ref('')

// 未来10天的日期选项
const futureDates = computed(() => {
  const dates = []
  const now = dayjs().tz('Asia/Shanghai')

  // 中文星期映射
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

  for (let i = 0; i < 10; i++) {
    const date = now.add(i, 'day')
    const dateStr = date.format('YYYY-MM-DD')
    const dayOfWeek = weekdays[date.day()]

    let label = ''
    let icon = 'mdi:calendar'
    let colorClass = 'text-gray-600'

    if (i === 0) {
      label = '今天'
      icon = 'mdi:calendar-today'
      colorClass = 'text-blue-600'
    } else if (i === 1) {
      label = '明天'
      icon = 'mdi:calendar-plus'
      colorClass = 'text-green-600'
    } else if (i === 2) {
      label = '后天'
      icon = 'mdi:clock-outline'
      colorClass = 'text-orange-600'
    } else {
      label = dayOfWeek
      icon = 'mdi:calendar'
      colorClass = 'text-gray-600'
    }

    dates.push({
      value: dateStr,
      label,
      date: date.format('MM-DD'),
      icon,
      colorClass,
    })
  }

  return dates
})

// 监听 show 变化，重置选中日期
watch(
  () => props.show,
  newShow => {
    if (newShow) {
      selectedDate.value = today // 默认选择今天
    }
  }
)

// 格式化选中的日期显示
const formatSelectedDate = computed(() => {
  if (!selectedDate.value) return ''

  const date = dayjs(selectedDate.value).tz('Asia/Shanghai')
  const today = dayjs().tz('Asia/Shanghai')
  const tomorrow = today.add(1, 'day')

  if (date.isSame(today, 'day')) {
    return `今天 (${date.format('YYYY年MM月DD日')})`
  } else if (date.isSame(tomorrow, 'day')) {
    return `明天 (${date.format('YYYY年MM月DD日')})`
  } else {
    // 使用中文星期显示
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const weekday = weekdays[date.day()]
    return `${date.format('YYYY年MM月DD日')} ${weekday}`
  }
})

// 选择日期
const selectDate = (date: string) => {
  selectedDate.value = date
}

// 确认选择
const handleConfirm = () => {
  if (selectedDate.value) {
    emit('confirm', selectedDate.value)
  }
}

// 取消选择
const handleCancel = () => {
  emit('cancel')
  emit('update:show', false)
}
</script>

<style scoped>
/* 模态框动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 按钮悬停效果 */
button {
  position: relative;
  overflow: hidden;
}

button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

button:hover::before {
  left: 100%;
}

/* 自定义滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 日期选项动画 */
.date-option {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.date-option:hover {
  transform: translateY(-2px);
}

/* 选中状态动画 */
.date-option.selected {
  animation: selectedPulse 0.3s ease-out;
}

@keyframes selectedPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1.05);
  }
}
</style>
