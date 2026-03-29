<template>
  <div
    :class="tagClasses"
    class="status-tag inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer group relative"
    @click="$emit('click', $event)"
  >
    <!-- 状态图标 -->
    <Icon v-if="statusIcon" :icon="statusIcon" :class="iconClasses" class="w-3 h-3 flex-shrink-0" />

    <!-- 状态文本 -->
    <span class="truncate">{{ displayText }}</span>

    <!-- 数量徽章 -->
    <span
      v-if="showCount && count !== undefined"
      :class="countBadgeClasses"
      class="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-xs font-semibold"
    >
      {{ count }}
    </span>

    <!-- 选中状态指示器 -->
    <Icon
      v-if="isSelected"
      icon="mdi:check"
      class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  status: string
  count?: number
  showCount?: boolean
  isSelected?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'solid'
}

const props = withDefaults(defineProps<Props>(), {
  showCount: true,
  isSelected: false,
  size: 'md',
  variant: 'default',
})

defineEmits<{
  click: [event: MouseEvent]
}>()

// 状态配置
const statusConfig = {
  已完成: {
    icon: 'mdi:check-circle',
    colors: {
      default: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
      outline: 'bg-white text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-50',
      solid: 'bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600',
    },
    countColors: 'bg-emerald-100 text-emerald-800',
    text: '已完成',
  },
  已下载: {
    icon: 'mdi:check-circle',
    colors: {
      default: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
      outline: 'bg-white text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-50',
      solid: 'bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600',
    },
    countColors: 'bg-emerald-100 text-emerald-800',
    text: '已下载',
  },
  待下载: {
    icon: 'mdi:clock-outline',
    colors: {
      default: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
      outline: 'bg-white text-amber-700 border-2 border-amber-300 hover:bg-amber-50',
      solid: 'bg-amber-500 text-white border border-amber-500 hover:bg-amber-600',
    },
    countColors: 'bg-amber-100 text-amber-800',
    text: '待下载',
  },
  待搭建: {
    icon: 'mdi:hammer-wrench',
    colors: {
      default: 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100',
      outline: 'bg-white text-orange-700 border-2 border-orange-300 hover:bg-orange-50',
      solid: 'bg-orange-500 text-white border border-orange-500 hover:bg-orange-600',
    },
    countColors: 'bg-orange-100 text-orange-800',
    text: '待搭建',
  },
  待上传: {
    icon: 'mdi:upload',
    colors: {
      default: 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100',
      outline: 'bg-white text-violet-700 border-2 border-violet-300 hover:bg-violet-50',
      solid: 'bg-violet-500 text-white border border-violet-500 hover:bg-violet-600',
    },
    countColors: 'bg-violet-100 text-violet-800',
    text: '待上传',
  },
  上传中: {
    icon: 'mdi:upload-outline',
    colors: {
      default: 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100',
      outline: 'bg-white text-violet-700 border-2 border-violet-300 hover:bg-violet-50',
      solid: 'bg-violet-500 text-white border border-violet-500 hover:bg-violet-600',
    },
    countColors: 'bg-violet-100 text-violet-800',
    text: '上传中',
  },
  待剪辑: {
    icon: 'mdi:video',
    colors: {
      default: 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100',
      outline: 'bg-white text-indigo-700 border-2 border-indigo-300 hover:bg-indigo-50',
      solid: 'bg-indigo-500 text-white border border-indigo-500 hover:bg-indigo-600',
    },
    countColors: 'bg-indigo-100 text-indigo-800',
    text: '待剪辑',
  },
  剪辑中: {
    icon: 'mdi:video-outline',
    colors: {
      default: 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100',
      outline: 'bg-white text-indigo-700 border-2 border-indigo-300 hover:bg-indigo-50',
      solid: 'bg-indigo-500 text-white border border-indigo-500 hover:bg-indigo-600',
    },
    countColors: 'bg-indigo-100 text-indigo-800',
    text: '剪辑中',
  },
  下载中: {
    icon: 'mdi:download',
    colors: {
      default: 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100',
      outline: 'bg-white text-blue-700 border-2 border-blue-300 hover:bg-blue-50',
      solid: 'bg-blue-500 text-white border border-blue-500 hover:bg-blue-600',
    },
    countColors: 'bg-blue-100 text-blue-800',
    text: '下载中',
  },
  下载失败: {
    icon: 'mdi:alert-circle',
    colors: {
      default: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
      outline: 'bg-white text-red-700 border-2 border-red-300 hover:bg-red-50',
      solid: 'bg-red-500 text-white border border-red-500 hover:bg-red-600',
    },
    countColors: 'bg-red-100 text-red-800',
    text: '失败',
  },
  '—': {
    icon: null,
    colors: {
      default: 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100',
      outline: 'bg-white text-gray-500 border-2 border-gray-300 hover:bg-gray-50',
      solid: 'bg-gray-500 text-white border border-gray-500 hover:bg-gray-600',
    },
    countColors: 'bg-gray-100 text-gray-600',
    text: '—',
  },
} as const

// 计算属性
const statusInfo = computed(() => {
  if (!props.status || props.status.trim() === '') {
    return {
      icon: null,
      colors: statusConfig['—'].colors,
      countColors: statusConfig['—'].countColors,
      text: '',
    }
  }

  return statusConfig[props.status as keyof typeof statusConfig] || statusConfig['—']
})

const tagClasses = computed(() => {
  const baseClasses = statusInfo.value.colors[props.variant]
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-xs',
    lg: 'px-3 py-2 text-sm',
  }

  return [baseClasses, sizeClasses[props.size]].filter(Boolean).join(' ')
})

const iconClasses = computed(() => {
  return ''
})

const countBadgeClasses = computed(() => {
  return statusInfo.value.countColors
})

const statusIcon = computed(() => statusInfo.value.icon)
const displayText = computed(() => statusInfo.value.text)
</script>

<style scoped>
.status-tag {
  @apply select-none;
}

.status-tag:hover {
  @apply transform scale-105 shadow-sm;
}

.status-tag:active {
  @apply transform scale-95;
}

/* 数量徽章的动画效果 */
.status-tag:hover .inline-flex {
  @apply transform scale-110;
}
</style>
