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
        <span>从第</span>
        <n-input-number v-model:value="startPage" :min="1" :max="10000" style="width: 120px" />
        <span>页开始</span>
      </div>

      <div class="flex items-center gap-2">
        <span>每页拉取</span>
        <n-select v-model:value="pageSize" :options="pageSizeOptions" style="width: 120px" />
        <span>条</span>
      </div>

      <div class="flex items-center gap-2">
        <span>需要拉取</span>
        <n-input-number v-model:value="accountCount" :min="1" :max="1000" style="width: 120px" />
        <span>个账户</span>
      </div>
      <div class="flex gap-2">
        <n-button type="primary" :loading="loading" @click="fetchAccounts">开始拉取</n-button>
        <n-button v-if="loading" type="warning" secondary @click="confirmAbortFetch"
          >中断拉取</n-button
        >
      </div>
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
import {
  NModal,
  NButton,
  NInputNumber,
  NSelect,
  NDataTable,
  useDialog,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  getJuliangAccountList,
  editJuliangAccountRemark,
  type JuliangAccountItem,
} from '@/api/juliang'
import { feishuApi } from '@/api/feishu'
import * as adminApi from '@/api/admin'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const message = useMessage()
const dialog = useDialog()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const step = ref(1)
const startPage = ref(1)
const pageSize = ref(100)
const accountCount = ref(10)
const loading = ref(false)
const remarkLoading = ref(false)
const syncLoading = ref(false)
const progressText = ref('')
const remarkProgress = ref('')
const matchedAccounts = ref<JuliangAccountItem[]>([])
const abortController = ref<AbortController | null>(null)
const usePartialAccountsAfterAbort = ref(false)
const availableAccountCount = ref<number | null>(null)
const loadingCount = ref(false)
const currentAccountTableId = ref('')
const currentChannelName = ref('')
const currentAdvertiserName = ref('')
const currentBrandName = ref('小红')
const pageSizeValues = [10, 20, 50, 100]
const pageSizeOptions = pageSizeValues.map(value => ({
  label: String(value),
  value,
}))

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
  return matchedAccounts.value.every(
    account => account.advertiser_remark === currentBrandName.value
  )
})

async function fetchAvailableAccountCount() {
  loadingCount.value = true
  try {
    if (!currentAccountTableId.value) {
      availableAccountCount.value = null
      return
    }

    availableAccountCount.value = await feishuApi.getAvailableAccountCount(
      currentAccountTableId.value
    )
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
  currentAdvertiserName.value = String(sessionData?.buildConfig?.advertiserName || '').trim()
  currentBrandName.value =
    String(sessionData?.runtimeUser?.brandName || sessionData?.user?.brandName || '小红').trim() ||
    '小红'
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

function normalizeTargetCount() {
  return Math.max(1, Number(accountCount.value) || 1)
}

function showMatchedAccountsResult(targetCount: number, interrupted = false) {
  if (matchedAccounts.value.length > targetCount) {
    matchedAccounts.value = matchedAccounts.value.slice(0, targetCount)
  }

  const foundCount = matchedAccounts.value.length

  if (foundCount > 0) {
    if (interrupted) {
      message.info(`已中断拉取，将使用当前找到的 ${foundCount} 个账户`)
    } else if (foundCount < targetCount) {
      message.warning(`已拉到最后一页，仅找到 ${foundCount} 个符合条件的账户`)
    } else {
      message.success(`成功找到 ${foundCount} 个符合条件的账户`)
    }
    step.value = 2
    return
  }

  message.warning(interrupted ? '已中断拉取，当前未找到符合条件的账户' : '未找到符合条件的账户')
}

function confirmAbortFetch() {
  if (!loading.value || !abortController.value) {
    return
  }

  const foundCount = matchedAccounts.value.length
  const targetCount = normalizeTargetCount()
  const missingCount = Math.max(targetCount - foundCount, 0)

  dialog.warning({
    title: '确认中断拉取',
    content: `当前已找到符合条件的账户 ${foundCount} 个，还缺 ${missingCount} 个。是否中断拉取并使用已拉取账户？`,
    positiveText: '中断并使用',
    negativeText: '继续拉取',
    onPositiveClick: () => {
      usePartialAccountsAfterAbort.value = true
      abortController.value?.abort()
    },
  })
}

async function fetchAccounts() {
  if (!ensureCurrentAccountTableId()) {
    return
  }

  loading.value = true
  matchedAccounts.value = []
  usePartialAccountsAfterAbort.value = false
  let offset = Math.max(1, Number(startPage.value) || 1)
  const targetCount = normalizeTargetCount()
  const selectedPageSize = Number(pageSize.value)
  const limit = pageSizeValues.includes(selectedPageSize) ? selectedPageSize : 100

  abortController.value = new AbortController()

  try {
    while (matchedAccounts.value.length < targetCount) {
      progressText.value = `正在拉取第 ${offset} 页（每页 ${limit} 条），已找到 ${matchedAccounts.value.length} 个符合条件的账户...`

      const response = await getJuliangAccountList({ offset, limit }, abortController.value.signal)

      if (response.code !== 0) {
        throw new Error(response.msg || '获取账户列表失败')
      }

      const filtered = response.data.data_list.filter((item: JuliangAccountItem) => {
        const matchesAdvertiserName = currentAdvertiserName.value
          ? item.advertiser_name?.includes(currentAdvertiserName.value)
          : true
        return (
          matchesAdvertiserName &&
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

    showMatchedAccountsResult(targetCount)
  } catch (err) {
    const error = err as Error
    if (error.name === 'AbortError') {
      if (usePartialAccountsAfterAbort.value) {
        showMatchedAccountsResult(targetCount, true)
      } else {
        message.info('已取消拉取账户')
      }
    } else {
      message.error(error.message || '拉取账户失败')
    }
  } finally {
    loading.value = false
    progressText.value = ''
    abortController.value = null
    usePartialAccountsAfterAbort.value = false
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
          remark: currentBrandName.value,
        })

        if (result.code === 0) {
          success = true
          successCount += 1
          account.advertiser_remark = currentBrandName.value
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
  startPage.value = 1
  pageSize.value = 100
  accountCount.value = 10
  matchedAccounts.value = []
  progressText.value = ''
  remarkProgress.value = ''
}

function cancelRequests() {
  usePartialAccountsAfterAbort.value = false
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
