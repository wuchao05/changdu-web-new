<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    title="同步账户"
    style="width: 900px"
    :mask-closable="false"
    :close-on-esc="false"
  >
    <div v-if="step === 1" class="space-y-4">
      <div v-if="availableAccountCount !== null" class="text-sm">
        <span class="text-gray-600">当前可用账户：</span>
        <span class="font-semibold text-blue-600">{{ availableAccountCount }}</span>
        <span class="text-gray-600"> 个</span>
      </div>
      <div v-else-if="loadingCount" class="text-sm text-gray-500">正在查询可用账户数量...</div>

      <div class="flex items-center gap-2">
        <span>需要拉取</span>
        <n-input-number v-model:value="accountCount" :min="1" :max="1000" style="width: 120px" />
        <span>个账户</span>
      </div>
      <n-button type="primary" :loading="loading" @click="fetchAccounts">开始拉取</n-button>
      <div v-if="progressText" class="text-sm text-gray-500">{{ progressText }}</div>
    </div>

    <div v-if="step === 2" class="space-y-4">
      <div class="text-sm text-gray-600">已找到 {{ matchedAccounts.length }} 个符合条件的账户</div>

      <n-data-table :columns="columns" :data="matchedAccounts" :max-height="400" size="small" />

      <div class="flex gap-2">
        <n-button
          type="primary"
          :loading="remarkLoading"
          :disabled="matchedAccounts.length === 0"
          @click="addRemarks"
        >
          添加备注
        </n-button>
        <n-button
          type="success"
          :loading="syncLoading"
          :disabled="!allAccountsHaveRemark"
          @click="syncToFeishu"
        >
          同步到飞书
        </n-button>
        <n-button @click="resetModal">重新开始</n-button>
      </div>

      <div v-if="remarkProgress" class="text-sm text-gray-500">{{ remarkProgress }}</div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NButton, NInputNumber, NDataTable, useMessage, type DataTableColumns } from 'naive-ui'
import { getJuliangAccountList, editJuliangAccountRemark, type JuliangAccountItem } from '@/api/juliang'
import { feishuApi } from '@/api/feishu'
import * as adminApi from '@/api/admin'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const message = useMessage()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const step = ref(1)
const accountCount = ref(10)
const loading = ref(false)
const remarkLoading = ref(false)
const syncLoading = ref(false)
const progressText = ref('')
const remarkProgress = ref('')
const matchedAccounts = ref<JuliangAccountItem[]>([])
const abortController = ref<AbortController | null>(null)
const availableAccountCount = ref<number | null>(null)
const loadingCount = ref(false)
const currentAccountTableId = ref('')
const currentChannelName = ref('')

const columns: DataTableColumns<JuliangAccountItem> = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    render: (_, index) => index + 1,
  },
  {
    title: '账户 ID',
    key: 'advertiser_id',
    width: 200,
  },
  {
    title: '账户名称',
    key: 'advertiser_name',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: '备注',
    key: 'advertiser_remark',
    width: 120,
    render: row => row.advertiser_remark || '-',
  },
]

const allAccountsHaveRemark = computed(() => {
  if (matchedAccounts.value.length === 0) return false
  return matchedAccounts.value.every(account => account.advertiser_remark === '小红')
})

async function fetchAvailableAccountCount() {
  loadingCount.value = true
  try {
    if (!currentAccountTableId.value) {
      availableAccountCount.value = null
      return
    }

    availableAccountCount.value = await feishuApi.getAvailableAccountCount(currentAccountTableId.value)
  } catch (error) {
    console.error('获取可用账户数量失败:', error)
    availableAccountCount.value = null
  } finally {
    loadingCount.value = false
  }
}

async function loadCurrentChannelAccountTableId() {
  const sessionData = await adminApi.getCurrentSession()
  currentAccountTableId.value = String(sessionData?.feishu?.accountTableId || '').trim()
  currentChannelName.value = String(sessionData?.channel?.name || '').trim()
}

function ensureCurrentAccountTableId() {
  if (currentAccountTableId.value) {
    return true
  }

  message.error(
    currentChannelName.value
      ? `当前渠道【${currentChannelName.value}】未配置账户表 table_id`
      : '当前渠道未配置账户表 table_id'
  )
  return false
}

async function fetchAccounts() {
  if (!ensureCurrentAccountTableId()) {
    return
  }

  loading.value = true
  matchedAccounts.value = []
  let offset = 1
  const targetCount = accountCount.value

  abortController.value = new AbortController()

  try {
    while (matchedAccounts.value.length < targetCount) {
      progressText.value = `正在拉取第 ${offset} 页，已找到 ${matchedAccounts.value.length} 个符合条件的账户...`

      const response = await getJuliangAccountList(
        { offset, limit: 100 },
        abortController.value.signal
      )

      if (response.code !== 0) {
        throw new Error(response.msg || '获取账户列表失败')
      }

      const filtered = response.data.data_list.filter((item: JuliangAccountItem) => {
        return (
          item.advertiser_name?.includes('山宥麦') &&
          item.advertiser_status_name === '审核通过' &&
          !item.advertiser_remark
        )
      })

      matchedAccounts.value.push(...filtered)

      if (!response.data.pagination.hasMore) {
        break
      }

      offset += 1
    }

    if (matchedAccounts.value.length > targetCount) {
      matchedAccounts.value = matchedAccounts.value.slice(0, targetCount)
    }

    if (matchedAccounts.value.length > 0) {
      message.success(`成功找到 ${matchedAccounts.value.length} 个符合条件的账户`)
      step.value = 2
    } else {
      message.warning('未找到符合条件的账户')
    }
  } catch (err) {
    const error = err as Error
    if (error.name === 'AbortError') {
      message.info('已取消拉取账户')
    } else {
      message.error(error.message || '拉取账户失败')
    }
  } finally {
    loading.value = false
    progressText.value = ''
    abortController.value = null
  }
}

async function addRemarks() {
  remarkLoading.value = true
  let successCount = 0
  const failedAccounts: number[] = []

  for (let index = 0; index < matchedAccounts.value.length; index += 1) {
    const account = matchedAccounts.value[index]
    remarkProgress.value = `正在添加备注 ${index + 1}/${matchedAccounts.value.length}...`

    let retryCount = 0
    let success = false

    while (retryCount < 3 && !success) {
      try {
        const result = await editJuliangAccountRemark({
          account_id: account.advertiser_id.toString(),
          remark: '小红',
        })

        if (result.code === 0) {
          success = true
          successCount += 1
          account.advertiser_remark = '小红'
        } else {
          retryCount += 1
        }
      } catch {
        retryCount += 1
      }

      if (retryCount < 3 && !success) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    if (!success) {
      failedAccounts.push(account.advertiser_id)
    }
  }

  remarkLoading.value = false
  remarkProgress.value = ''

  if (failedAccounts.length > 0) {
    message.warning(`成功 ${successCount} 个，失败 ${failedAccounts.length} 个`)
  } else {
    message.success(`全部 ${successCount} 个账户备注添加成功`)
  }
}

async function syncToFeishu() {
  if (!ensureCurrentAccountTableId()) {
    return
  }

  syncLoading.value = true

  try {
    const accounts = matchedAccounts.value.map(account => ({
      account: account.advertiser_id.toString(),
      isUsed: '否',
    }))

    const result = await feishuApi.batchCreateAccounts(accounts, currentAccountTableId.value)

    if (result.code === 0) {
      message.success(`成功添加 ${accounts.length} 个账户到飞书`)
      visible.value = false
      resetModal()
      await fetchAvailableAccountCount()
    } else {
      throw new Error(result.msg || '同步失败')
    }
  } catch (err) {
    const error = err as Error
    message.error(error.message || '同步到飞书失败')
  } finally {
    syncLoading.value = false
  }
}

function resetModal() {
  step.value = 1
  accountCount.value = 10
  matchedAccounts.value = []
  progressText.value = ''
  remarkProgress.value = ''
}

function cancelRequests() {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
}

watch(visible, newValue => {
  if (!newValue) {
    cancelRequests()
    resetModal()
  } else {
    loadCurrentChannelAccountTableId()
      .then(() => fetchAvailableAccountCount())
      .catch(error => {
        console.error('加载当前渠道账户表配置失败:', error)
        currentAccountTableId.value = ''
        currentChannelName.value = ''
        availableAccountCount.value = null
      })
  }
})
</script>

<style scoped>
.space-y-4 > * + * {
  margin-top: 1rem;
}

.gap-2 {
  gap: 0.5rem;
}
</style>
