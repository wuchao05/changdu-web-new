<script setup lang="ts">
import { NDataTable, NTag, NTooltip, NProgress, type DataTableColumns } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { h, computed } from 'vue'
import dayjs from 'dayjs'

export interface BuildDramaRecord {
  id: string
  index: number
  dramaName: string
  accountId: string
  rating?: string // 评级（红标/绿标）
  date?: number // 日期（时间戳）
  publishTime?: number // 上架时间（时间戳）
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  totalBatches: number // 总批次数（抖音号数量）
  completedBatches: number // 已完成的批次数
  skippedBatches?: Array<{ account: string; reason: string }> // 跳过的批次（素材问题或名称重复）
  failedStep?: string
  errorCode?: string | number
  errorMessage?: string
  failedDrama?: any // 保存失败的剧集数据（预留字段，暂未使用）
}

interface Props {
  records: BuildDramaRecord[]
}

defineProps<Props>()

// 列定义
const columns: DataTableColumns<BuildDramaRecord> = [
  {
    title: '剧名',
    key: 'dramaName',
    minWidth: 180,
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: '账户',
    key: 'accountId',
    width: 180,
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: '评级',
    key: 'rating',
    width: 80,
    align: 'center',
    render(row) {
      return renderRating(row)
    },
  },
  {
    title: '日期',
    key: 'date',
    width: 110,
    align: 'center',
    render(row) {
      if (!row.date) return '-'
      return dayjs(row.date).format('YYYY-MM-DD')
    },
  },
  {
    title: '上架时间',
    key: 'publishTime',
    width: 140,
    align: 'center',
    render(row) {
      if (!row.publishTime) return '-'
      return dayjs(row.publishTime).format('YYYY-MM-DD HH:mm')
    },
  },
  {
    title: '搭建进度',
    key: 'progress',
    width: 200,
    align: 'center',
    render(row) {
      return renderProgress(row)
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 150,
    align: 'center',
    render(row) {
      return renderStatus(row)
    },
  },
]

// 渲染评级标签
function renderRating(record: BuildDramaRecord) {
  const rating = record.rating || '绿标' // 默认为绿标
  return h(
    NTag,
    {
      type: rating === '红标' ? 'error' : rating === '黄标' ? 'warning' : 'success',
      size: 'small',
      round: true,
    },
    { default: () => rating }
  )
}

// 渲染进度条
function renderProgress(record: BuildDramaRecord) {
  const percentage = computed(() => {
    if (record.totalBatches === 0) return 0
    return Math.round((record.completedBatches / record.totalBatches) * 100)
  })

  let status: 'default' | 'success' | 'error' | 'warning' | 'info' = 'default'

  if (record.status === 'success') {
    status = 'success'
  } else if (record.status === 'failed') {
    status = 'error'
  } else if (record.status === 'running') {
    status = 'info'
  }

  return h('div', { class: 'flex items-center gap-2 w-full' }, [
    h(NProgress, {
      type: 'line',
      percentage: percentage.value,
      status,
      height: 18,
      borderRadius: 9,
      processing: record.status === 'running',
      showIndicator: false, // 不显示默认的 indicator
    }),
    // 自定义指示器
    record.status === 'running'
      ? h(Icon, { icon: 'mdi:loading', class: 'animate-spin text-blue-500 w-5 h-5 flex-shrink-0' })
      : h(
          'span',
          { class: 'text-sm text-gray-600 min-w-[40px] text-right' },
          `${percentage.value}%`
        ),
  ])
}

// 渲染状态
function renderStatus(record: BuildDramaRecord) {
  switch (record.status) {
    case 'pending':
      return h(
        NTag,
        { type: 'default', size: 'small' },
        {
          default: () => '等待中',
          icon: () => h(Icon, { icon: 'mdi:circle-outline' }),
        }
      )
    case 'running':
      return h(
        NTag,
        { type: 'info', size: 'small' },
        {
          default: () => '搭建中...',
          icon: () => h(Icon, { icon: 'mdi:loading', class: 'animate-spin' }),
        }
      )
    case 'success':
      // 如果有跳过的批次，显示警告图标和提示
      if (record.skippedBatches && record.skippedBatches.length > 0) {
        return h(
          NTooltip,
          {},
          {
            trigger: () =>
              h(
                NTag,
                { type: 'success', size: 'small' },
                {
                  default: () => '搭建成功',
                  icon: () =>
                    h('div', { class: 'flex items-center gap-1' }, [
                      h(Icon, { icon: 'mdi:check-circle' }),
                      h(Icon, { icon: 'mdi:alert', class: 'text-yellow-500' }),
                    ]),
                }
              ),
            default: () =>
              h('div', { class: 'max-w-xs' }, [
                h('p', { class: 'font-medium mb-2' }, '部分批次被跳过：'),
                ...record.skippedBatches!.map(batch =>
                  h('p', { class: 'text-xs mb-1' }, `• ${batch.account}: ${batch.reason}`)
                ),
              ]),
          }
        )
      } else {
        return h(
          NTag,
          { type: 'success', size: 'small' },
          {
            default: () => '搭建成功',
            icon: () => h(Icon, { icon: 'mdi:check-circle' }),
          }
        )
      }
    case 'failed':
      // 如果有错误信息，使用 Tooltip 显示详情
      if (record.errorMessage) {
        return h(
          NTooltip,
          {},
          {
            trigger: () =>
              h(
                NTag,
                { type: 'error', size: 'small' },
                {
                  default: () => '搭建失败',
                  icon: () => h(Icon, { icon: 'mdi:alert-circle' }),
                }
              ),
            default: () =>
              h('div', { class: 'max-w-xs' }, [
                h('p', { class: 'font-medium mb-1' }, `失败步骤: ${record.failedStep || '未知'}`),
                record.errorCode
                  ? h('p', { class: 'text-xs mb-1' }, `错误代码: ${record.errorCode}`)
                  : null,
                h('p', { class: 'text-xs' }, `错误信息: ${record.errorMessage}`),
              ]),
          }
        )
      } else {
        return h(
          NTag,
          { type: 'error', size: 'small' },
          {
            default: () => '搭建失败',
            icon: () => h(Icon, { icon: 'mdi:alert-circle' }),
          }
        )
      }
    case 'skipped':
      // 跳过的剧集，显示警告
      return h(
        NTag,
        { type: 'warning', size: 'small' },
        {
          default: () => '已跳过',
          icon: () => h(Icon, { icon: 'mdi:skip-next-circle' }),
        }
      )
  }
}
</script>

<template>
  <div class="build-progress-table">
    <n-data-table :columns="columns" :data="records" :bordered="false" />
  </div>
</template>

<style scoped>
.build-progress-table {
  width: 100%;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
