<template>
  <span
    v-if="displayText"
    :class="badgeClasses"
    class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all duration-200"
  >
    <Icon v-if="statusIcon" :icon="statusIcon" class="w-3 h-3 mr-1" />
    {{ displayText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  status: string
}

const props = defineProps<Props>()

// 状态配置
const statusConfig = {
  已完成: {
    icon: 'mdi:check-circle',
    classes: 'bg-green-100 text-green-800 border border-green-200',
    text: '已完成',
  },
  已下载: {
    icon: 'mdi:check-circle',
    classes: 'bg-green-100 text-green-800 border border-green-200',
    text: '已下载',
  },
  待下载: {
    icon: 'mdi:clock-outline',
    classes: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    text: '待下载',
  },
  待搭建: {
    icon: 'mdi:hammer-wrench',
    classes: 'bg-orange-100 text-orange-800 border border-orange-200',
    text: '待搭建',
  },
  待上传: {
    icon: 'mdi:upload',
    classes: 'bg-purple-100 text-purple-800 border border-purple-200',
    text: '待上传',
  },
  上传中: {
    icon: 'mdi:upload-outline',
    classes: 'bg-purple-100 text-purple-800 border border-purple-200',
    text: '上传中',
  },
  待剪辑: {
    icon: 'mdi:video',
    classes: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    text: '待剪辑',
  },
  剪辑中: {
    icon: 'mdi:video-outline',
    classes: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    text: '剪辑中',
  },
  下载中: {
    icon: 'mdi:download',
    classes: 'bg-blue-100 text-blue-800 border border-blue-200',
    text: '下载中',
  },
  下载失败: {
    icon: 'mdi:alert-circle',
    classes: 'bg-red-100 text-red-800 border border-red-200',
    text: '失败',
  },
  '—': {
    icon: null,
    classes: 'bg-gray-100 text-gray-500 border border-gray-200',
    text: '—',
  },
} as const

// 计算属性
const statusInfo = computed(() => {
  // 如果状态为空字符串，返回空状态配置
  if (!props.status || props.status.trim() === '') {
    return {
      icon: null,
      classes: '',
      text: '',
    }
  }

  // 调试：打印状态值
  if (props.status.includes('上传') || props.status.includes('待上传')) {
    console.log('Debug - StatusBadge received status:', props.status)
  }

  return statusConfig[props.status as keyof typeof statusConfig] || statusConfig['—']
})

const badgeClasses = computed(() => statusInfo.value.classes)
const statusIcon = computed(() => statusInfo.value.icon)
const displayText = computed(() => statusInfo.value.text)
</script>

<style scoped>
/* 状态徽章悬停效果 */
.status-badge:hover {
  @apply transform scale-105 shadow-sm;
}

/* 动画效果 */
.status-badge {
  @apply transition-all duration-200;
}
</style>
