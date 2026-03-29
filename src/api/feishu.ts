/**
 * 飞书多维表格 API 服务
 */
import { FEISHU_CONFIG, FEISHU_API_CONFIG } from '@/config/feishu'
import { ENV } from '@/config/env'
import { useApiConfigStore } from '@/stores/apiConfig'
import type {
  FeishuTokenRequest,
  FeishuTokenResponse,
  FeishuApiResponse,
  FeishuRecordsResponse,
  FeishuRecordRequest,
  FeishuBatchRecordRequest,
  FeishuFieldsResponse,
  FeishuErrorResponse,
  FeishuSearchRecordRequest,
  FeishuSearchRecordResponse,
  FeishuCreateRecordResponse,
} from '@/api/types/feishu'

class FeishuApiService {
  private tokenCache: {
    token: string | null
    expireTime: number
  } = {
    token: null,
    expireTime: 0,
  }

  /**
   * 获取 tenant_access_token (通过后端代理)
   */
  private async getTenantAccessToken(): Promise<string> {
    // 检查缓存是否有效
    if (this.tokenCache.token && Date.now() < this.tokenCache.expireTime) {
      return this.tokenCache.token
    }

    try {
      const response = await fetch(`${ENV.BASE_URL}/feishu/token`, {
        method: 'POST',
        headers: FEISHU_API_CONFIG.headers,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: FeishuTokenResponse = await response.json()

      if (result.code !== 0) {
        throw new Error(`Feishu API error: ${result.msg}`)
      }

      // 缓存 token，提前 5 分钟过期
      this.tokenCache.token = result.tenant_access_token
      this.tokenCache.expireTime = Date.now() + (result.expire - 300) * 1000

      return result.tenant_access_token
    } catch (error) {
      console.error('Failed to get tenant access token:', error)
      throw error
    }
  }

  /**
   * 获取请求头
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getTenantAccessToken()
    return {
      ...FEISHU_API_CONFIG.headers,
      Authorization: `Bearer ${token}`,
    }
  }

  private getDramaListTableId(): string {
    const apiConfigStore = useApiConfigStore()
    return apiConfigStore.config.dramaListTableId || FEISHU_CONFIG.table_ids.drama_list
  }

  private getDramaStatusTableId(): string {
    const apiConfigStore = useApiConfigStore()
    return apiConfigStore.config.dramaStatusTableId || FEISHU_CONFIG.table_ids.drama_status
  }

  private getAccountTableId(): string {
    const apiConfigStore = useApiConfigStore()
    return apiConfigStore.config.accountTableId || ''
  }

  /**
   * 通用请求方法
   */
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.getHeaders()

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuApiResponse<T> = await response.json()

    if (result.code !== 0) {
      throw new Error(`Feishu API error: ${result.msg}`)
    }

    return result.data
  }

  /**
   * 获取表格字段列表
   */
  async getTableFields(tableId: string): Promise<FeishuFieldsResponse> {
    const url = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.endpoints.bitable_base}/${FEISHU_CONFIG.app_token}/tables/${tableId}/fields`
    return this.request<FeishuFieldsResponse>(url)
  }

  /**
   * 获取记录列表
   */
  async getRecords(
    tableId: string,
    options: {
      pageSize?: number
      pageToken?: string
      filter?: string
      sort?: string
    } = {}
  ): Promise<FeishuRecordsResponse> {
    const params = new URLSearchParams()

    if (options.pageSize) params.append('page_size', options.pageSize.toString())
    if (options.pageToken) params.append('page_token', options.pageToken)
    if (options.filter) params.append('filter', options.filter)
    if (options.sort) params.append('sort', options.sort)

    const url = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.endpoints.bitable_base}/${FEISHU_CONFIG.app_token}/tables/${tableId}/records?${params}`
    return this.request<FeishuRecordsResponse>(url)
  }

  /**
   * 获取单条记录
   */
  async getRecord(tableId: string, recordId: string): Promise<{ record: any }> {
    const url = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.endpoints.bitable_base}/${FEISHU_CONFIG.app_token}/tables/${tableId}/records/${recordId}`
    return this.request<{ record: any }>(url)
  }

  /**
   * 创建记录 (通过后端代理)
   */
  async createRecord(tableId: string, data: FeishuRecordRequest): Promise<{ record: any }> {
    try {
      const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/create`, {
        method: 'POST',
        headers: FEISHU_API_CONFIG.headers,
        body: JSON.stringify({
          fields: data.fields,
          tableId: tableId,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to create record:', error)
      throw error
    }
  }

  /**
   * 更新记录
   */
  async updateRecord(
    tableId: string,
    recordId: string,
    data: FeishuRecordRequest
  ): Promise<{ record: any }> {
    const url = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.endpoints.bitable_base}/${FEISHU_CONFIG.app_token}/tables/${tableId}/records/${recordId}`
    return this.request<{ record: any }>(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  /**
   * 删除记录
   */
  async deleteRecord(tableId: string, recordId: string): Promise<void> {
    const url = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.endpoints.bitable_base}/${FEISHU_CONFIG.app_token}/tables/${tableId}/records/${recordId}`
    await this.request<void>(url, {
      method: 'DELETE',
    })
  }

  /**
   * 批量创建记录
   */
  async batchCreateRecords(
    tableId: string,
    data: FeishuBatchRecordRequest
  ): Promise<{ records: any[] }> {
    const url = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.endpoints.bitable_base}/${FEISHU_CONFIG.app_token}/tables/${tableId}/records/batch_create`
    return this.request<{ records: any[] }>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * 批量更新记录
   */
  async batchUpdateRecords(
    tableId: string,
    data: { records: Array<{ record_id: string; fields: Record<string, any> }> }
  ): Promise<{ records: any[] }> {
    const url = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.endpoints.bitable_base}/${FEISHU_CONFIG.app_token}/tables/${tableId}/records/batch_update`
    return this.request<{ records: any[] }>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * 批量删除记录
   */
  async batchDeleteRecords(tableId: string, recordIds: string[]): Promise<void> {
    const url = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.endpoints.bitable_base}/${FEISHU_CONFIG.app_token}/tables/${tableId}/records/batch_delete`
    await this.request<void>(url, {
      method: 'POST',
      body: JSON.stringify({ records: recordIds.map(id => ({ record_id: id })) }),
    })
  }

  /**
   * 搜索记录 (通过后端代理)
   */
  async searchRecords(
    tableId: string,
    data: FeishuSearchRecordRequest
  ): Promise<FeishuSearchRecordResponse> {
    try {
      const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/search`, {
        method: 'POST',
        headers: FEISHU_API_CONFIG.headers,
        body: JSON.stringify({
          searchValue: data.filter?.conditions?.[0]?.value?.[0] || '',
          tableId: tableId,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to search records:', error)
      throw error
    }
  }

  // 便捷方法：获取剧集清单数据
  async getDramaList(options?: Parameters<typeof this.getRecords>[1]) {
    return this.getRecords(this.getDramaListTableId(), options)
  }

  // 便捷方法：获取剧集状态数据
  async getDramaStatus(options?: Parameters<typeof this.getRecords>[1]) {
    return this.getRecords(this.getDramaStatusTableId(), options)
  }

  // 便捷方法：搜索剧集清单
  async searchDramaList(dramaName: string) {
    return this.searchRecords(this.getDramaListTableId(), {
      field_names: ['剧名'],
      filter: {
        conjunction: 'and',
        conditions: [
          {
            field_name: '剧名',
            operator: 'is',
            value: [dramaName],
          },
        ],
      },
      page_size: 1,
    })
  }

  /**
   * 新增剧集记录到飞书剧集清单表
   * @param dramaName 剧名
   * @param account 账户（可选）
   * @param publishTime 上架时间（可选）
   * @param bookId 短剧ID（可选）
   * @param rating 评级（可选，如"红标"、"绿标"、"黄标"）
   * @returns 新增结果
   */
  async createDramaRecord(
    dramaName: string,
    account?: string,
    publishTime?: string,
    bookId?: string,
    rating?: string
  ): Promise<FeishuCreateRecordResponse> {
    const tableId = this.getDramaListTableId()
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/records`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        dramaName,
        account: account || '',
        publishTime: publishTime || '',
        bookId: bookId || '',
        rating: rating || '',
        table_id: tableId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '新增剧集记录失败')
    }

    return result
  }

  /**
   * 检查账户表中是否有可用的账户
   * @param accountTableId 账户表 table_id（可选，默认使用当前渠道的账户表）
   * @returns 是否有可用账户
   */
  async checkAvailableChannelAccounts(accountTableId?: string): Promise<boolean> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/channel-accounts`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        accountTableId: accountTableId || this.getAccountTableId(),
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询账户失败')
    }

    // 检查是否有"是否已用"为"否"的记录
    const hasAvailableAccount = result.data.items.some(
      (item: any) => item.fields['是否已用'] === '否'
    )

    return hasAvailableAccount
  }

  /**
   * 查询账户表，获取未使用的账户
   * @param accountTableId 账户表 table_id（可选，默认使用当前渠道的账户表）
   * @returns 未使用的账户信息（account 字段即为巨量账户ID）
   */
  async getAvailableChannelAccount(
    accountTableId?: string
  ): Promise<{ account: string; recordId: string } | null> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/channel-accounts`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        accountTableId: accountTableId || this.getAccountTableId(),
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询账户失败')
    }

    // 查找第一个"是否已用"为"否"的记录
    const availableAccount = result.data.items.find((item: any) => item.fields['是否已用'] === '否')

    if (!availableAccount) {
      return null
    }
    console.log('查询到未使用账户', JSON.stringify(availableAccount))

    return {
      account: availableAccount.fields['账户'][0].text,
      recordId: availableAccount.record_id,
    }
  }

  /**
   * 查询账户表，获取多个未使用的账户（用于小程序验证重试）
   * @param count 需要获取的账户数量
   * @param accountTableId 账户表 table_id（可选，默认使用当前渠道的账户表）
   * @returns 未使用的账户信息数组（account 字段即为巨量账户ID）
   */
  async getAvailableChannelAccountCandidates(
    count: number = 5,
    accountTableId?: string
  ): Promise<Array<{ account: string; recordId: string }> | null> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/channel-accounts`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        accountTableId: accountTableId || this.getAccountTableId(),
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询账户失败')
    }

    // 查找"是否已用"为"否"的记录，最多返回 count 个
    const availableAccounts = result.data.items
      .filter((item: any) => item.fields['是否已用'] === '否')
      .slice(0, count)

    if (availableAccounts.length === 0) {
      return null
    }
    console.log(`查询到 ${availableAccounts.length} 个未使用账户`)

    return availableAccounts.map((item: any) => ({
      account: item.fields['账户'][0].text,
      recordId: item.record_id,
    }))
  }

  /**
   * 获取可用账户数量
   * @param accountTableId 账户表 table_id（可选，默认使用当前渠道的账户表）
   * @returns 可用账户数量
   */
  async getAvailableAccountCount(accountTableId?: string): Promise<number> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/channel-accounts`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        accountTableId: accountTableId || this.getAccountTableId(),
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询账户失败')
    }

    // 统计"是否已用"为"否"的记录数量
    const availableCount = result.data.items.filter(
      (item: any) => item.fields['是否已用'] === '否'
    ).length

    return availableCount
  }

  /**
   * 更新剧集记录的账户信息
   * @param recordId 记录ID
   * @param account 账户
   * @param publishTime 上架时间（可选）
   * @returns 更新结果
   */
  async updateDramaAccount(recordId: string, account: string, publishTime?: string): Promise<any> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/records/${recordId}/account`, {
      method: 'PUT',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        account: account,
        publishTime: publishTime,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '更新剧集账户失败')
    }

    return result
  }

  /**
   * 更新剧集记录的“文件md5”字段
   */
  async updateFileMd5(recordId: string, fileMd5: string): Promise<any> {
    const tableId = this.getDramaStatusTableId()
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/records/${recordId}/file-md5`, {
      method: 'PUT',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        fileMd5,
        table_id: tableId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '更新文件md5失败')
    }

    return result
  }

  /**
   * 更新账户的"是否已用"状态为"是"
   * @param recordId 账户记录ID
   * @param accountTableId 账户表 table_id（可选，默认使用当前渠道的账户表）
   * @returns 更新结果
   */
  async updateChannelAccountUsedStatus(recordId: string, accountTableId?: string): Promise<any> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(
      `${ENV.BASE_URL}/feishu/bitable/channel-accounts/${recordId}/used`,
      {
        method: 'PUT',
        headers: FEISHU_API_CONFIG.headers,
        body: JSON.stringify({
          accountTableId: accountTableId || this.getAccountTableId(),
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '更新账户状态失败')
    }

    return result
  }

  /**
   * 更新账户的"是否已用"状态为"否"
   * @param recordId 账户记录ID
   * @param accountTableId 账户表 table_id（可选，默认使用当前渠道的账户表）
   * @returns 更新结果
   */
  async updateChannelAccountUnusedStatus(recordId: string, accountTableId?: string): Promise<any> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(
      `${ENV.BASE_URL}/feishu/bitable/channel-accounts/${recordId}/unused`,
      {
        method: 'PUT',
        headers: FEISHU_API_CONFIG.headers,
        body: JSON.stringify({
          accountTableId: accountTableId || this.getAccountTableId(),
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '更新账户状态失败')
    }

    return result
  }

  /**
   * 根据账户名称查找对应的记录ID
   * @param accountName 账户名称
   * @param accountTableId 账户表 table_id（可选，默认使用当前渠道的账户表）
   * @returns 记录ID，如果未找到返回null
   */
  async findChannelAccountRecordId(
    accountName: string,
    accountTableId?: string
  ): Promise<string | null> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/channel-accounts`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        accountTableId: accountTableId || this.getAccountTableId(),
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询账户失败')
    }

    // 查找匹配的账户记录
    const matchedAccount = result.data.items.find((item: any) => {
      const accountText = item.fields['账户']?.[0]?.text
      return accountText === accountName
    })

    return matchedAccount ? matchedAccount.record_id : null
  }

  /**
   * 获取剧集清单数据 - 包含剧名和是否已下载状态
   * @returns 剧集清单数据
   */
  async getDramaListWithDownloadStatus(): Promise<any> {
    // 通过后端代理调用飞书API，避免CORS问题
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-list`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '获取剧集清单失败')
    }

    return result
  }

  /**
   * 创建剧集状态记录
   * @param dramaName 剧名
   * @param publishTime 首发时间 (格式: YYYY-MM-DD HH:mm:ss)
   * @param account 账户（可选）
   * @param status 当前状态（可选，默认为"待下载"）
   * @param douyinMaterial 抖音素材（可选）
   * @param rating 评级（可选，如"红标"、"绿标"、"黄标"）
   * @returns 创建结果
   */
  async createDramaStatusRecord(
    dramaName: string,
    publishTime: string,
    account?: string,
    status?: string,
    douyinMaterial?: string,
    rating?: string
  ): Promise<FeishuCreateRecordResponse> {
    const tableId = this.getDramaStatusTableId()
    // 将首发时间转换为当天00:00:00的13位时间戳
    const dateOnly = publishTime.split(' ')[0] // 提取日期部分 YYYY-MM-DD
    const publishDateAtMidnight = new Date(`${dateOnly} 00:00:00`)

    // 获取今天00:00:00的时间戳
    const today = new Date()
    today.setHours(0, 0, 0, 0) // 设置为今天00:00:00
    const todayTimestamp = today.getTime()

    // 如果首发时间早于今天00:00:00，则使用今天00:00:00的时间戳
    const timestamp =
      publishDateAtMidnight.getTime() < todayTimestamp
        ? todayTimestamp
        : publishDateAtMidnight.getTime()

    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        dramaName,
        timestamp,
        account,
        publishTime,
        status,
        douyinMaterial,
        rating,
        table_id: tableId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuCreateRecordResponse = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '创建剧集状态记录失败')
    }

    return result
  }

  /**
   * 查询剧集状态表 - 按剧名和日期查询
   * @param dramaName 剧名
   * @param timestamp 日期时间戳
   * @returns 查询结果
   */
  async searchDramaStatusRecord(
    dramaName: string,
    timestamp: number
  ): Promise<FeishuSearchRecordResponse> {
    const tableId = this.getDramaStatusTableId()
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/search`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        dramaName,
        timestamp,
        table_id: tableId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuSearchRecordResponse = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询剧集状态记录失败')
    }

    return result
  }

  /**
   * 根据日期和状态筛选剧集状态记录
   * @param date 日期字符串 (YYYY-MM-DD)
   * @param status 状态
   * @returns 查询结果
   */
  async filterDramaStatusByDateAndStatus(
    date: string,
    status: string | string[],
    fieldNames?: string[]
  ): Promise<FeishuSearchRecordResponse> {
    const statusList = Array.isArray(status) ? status : [status]
    const tableId = this.getDramaStatusTableId()

    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/filter`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        date,
        status: statusList,
        table_id: tableId,
        field_names: fieldNames,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuSearchRecordResponse = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '筛选剧集状态记录失败')
    }

    return result
  }

  /**
   * 查询待下载的剧集列表
   * @param includeBookId 是否包含短剧ID
   * @returns 待下载剧集列表
   */
  async getPendingDownloadDramas(
    includeBookId: boolean = true
  ): Promise<FeishuSearchRecordResponse> {
    const tableId = this.getDramaStatusTableId()
    const fieldNames = includeBookId ? ['剧名', '短剧ID'] : ['剧名']

    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/pending-download`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        table_id: tableId,
        field_names: fieldNames,
        page_size: 100,
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: '当前状态',
              operator: 'is',
              value: ['待下载'],
            },
          ],
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuSearchRecordResponse = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询待下载剧集失败')
    }

    return result
  }

  /**
   * 查询待上传的剧集列表
   * @returns 待上传剧集列表
   */
  async getPendingUploadDramas(): Promise<FeishuSearchRecordResponse> {
    const tableId = this.getDramaStatusTableId()
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/pending-upload`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        table_id: tableId,
        field_names: ['剧名', '日期', '当前状态'],
        page_size: 100,
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: '当前状态',
              operator: 'is',
              value: ['待上传'],
            },
          ],
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuSearchRecordResponse = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询待上传剧集失败')
    }

    return result
  }

  /**
   * 获取所有剧集清单数据 - 用于看板
   * @returns 所有剧集清单数据
   */
  async getAllDramaList(): Promise<any> {
    const tableId = this.getDramaListTableId()
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-list/all`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        table_id: tableId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '获取剧集清单失败')
    }

    return result
  }

  /**
   * 获取所有剧集状态数据 - 用于看板
   * @returns 所有剧集状态数据
   */
  async getAllDramaStatus(): Promise<any> {
    const tableId = this.getDramaStatusTableId()
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/all`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        table_id: tableId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '获取剧集状态失败')
    }

    return result
  }

  /**
   * 创建剪辑记录到剧集状态表
   * @param dramaName 剧名
   * @param timestamp 日期时间戳
   * @param account 账户（可选）
   * @param publishTime 上架时间（可选）
   * @param douyinMaterial 抖音素材（可选）
   * @param rating 评级（可选，如"红标"、"绿标"、"黄标"）
   * @param status 当前状态（可选，默认"待剪辑"）
   * @returns 创建结果
   */
  async createClipRecord(
    dramaName: string,
    timestamp: number,
    account?: string,
    publishTime?: string,
    douyinMaterial?: string,
    rating?: string,
    status?: string
  ): Promise<FeishuCreateRecordResponse> {
    const tableId = this.getDramaStatusTableId()
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/clip`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        dramaName,
        timestamp,
        account,
        publishTime,
        douyinMaterial,
        rating,
        status,
        table_id: tableId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuCreateRecordResponse = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '创建剪辑记录失败')
    }

    return result
  }

  /**
   * 根据记录ID获取剪辑记录详情
   * @param recordId 记录ID
   * @returns 记录详情
   */
  async getClipRecordById(recordId: string): Promise<any> {
    const tableId = this.getDramaStatusTableId()
    const response = await fetch(
      `${ENV.BASE_URL}/feishu/bitable/drama-status/clip/${recordId}?table_id=${tableId}`,
      {
        method: 'GET',
        headers: FEISHU_API_CONFIG.headers,
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '获取剪辑记录详情失败')
    }

    return result
  }

  /**
   * 删除剪辑记录
   * @param recordId 记录ID
   * @returns 删除结果
   */
  async deleteClipRecord(recordId: string): Promise<any> {
    const tableId = this.getDramaStatusTableId()
    const response = await fetch(
      `${ENV.BASE_URL}/feishu/bitable/drama-status/clip/${recordId}?table_id=${tableId}`,
      {
        method: 'DELETE',
        headers: FEISHU_API_CONFIG.headers,
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '删除剪辑记录失败')
    }

    return result
  }

  /**
   * 查询待资产化的剧集列表
   * @param tableId 表格 ID
   * @param date 日期（可选，格式：YYYY-MM-DD）
   * @param signal 可选的 AbortSignal，用于取消请求
   * @param includeBookId 是否包含短剧ID字段
   * @returns 待资产化剧集列表
   */
  async getPendingBuildDramas(
    tableId?: string,
    date?: string,
    signal?: AbortSignal,
    includeBookId: boolean = true
  ): Promise<FeishuSearchRecordResponse> {
    // 如果提供了日期，添加日期过滤条件
    const filter = date
      ? {
          conjunction: 'and',
          conditions: [
            {
              field_name: '当前状态',
              operator: 'is',
              value: ['待资产化'],
            },
            {
              field_name: '日期',
              operator: 'is',
              value: [date],
            },
          ],
        }
      : {
          conjunction: 'and',
          conditions: [
            {
              field_name: '当前状态',
              operator: 'is',
              value: ['待资产化'],
            },
          ],
        }

    const fieldNames = includeBookId ? ['剧名', '短剧ID', '账户', '日期'] : ['剧名', '账户', '日期']

    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/pending-build`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        table_id: tableId,
        field_names: fieldNames,
        page_size: 100,
        filter,
      }),
      signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuSearchRecordResponse = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询待资产化剧集失败')
    }

    return result
  }

  /**
   * 查询待搭建的剧集列表
   * @param tableId 表格 ID
   * @param date 日期（可选，格式：YYYY-MM-DD）
   * @param signal 可选的 AbortSignal，用于取消请求
   * @param includeBookId 是否包含短剧ID字段
   * @returns 待搭建剧集列表
   */
  async getPendingSetupDramas(
    tableId?: string,
    date?: string,
    signal?: AbortSignal,
    includeBookId: boolean = false
  ): Promise<FeishuSearchRecordResponse> {
    const conditions: Array<{ field_name: string; operator: string; value: string[] }> = [
      {
        field_name: '当前状态',
        operator: 'is',
        value: ['待搭建'],
      },
    ]

    // 注意：飞书的 DateTime 字段需要使用特殊格式 ['ExactDate', timestamp]
    if (date) {
      conditions.push({
        field_name: '日期',
        operator: 'is',
        value: ['ExactDate', new Date(`${date} 00:00:00`).getTime().toString()],
      })
    }

    const filter = {
      conjunction: 'and',
      conditions,
    }

    const fieldNames = includeBookId
      ? [
          '剧名',
          '短剧ID',
          '账户',
          '日期',
          '当前状态',
          '上架时间',
          '评级',
          '抖音素材',
          '备注',
        ]
      : ['剧名', '账户', '日期', '当前状态', '上架时间', '评级', '抖音素材', '备注']

    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/pending-build`, {
      method: 'POST',
      headers: FEISHU_API_CONFIG.headers,
      body: JSON.stringify({
        table_id: tableId,
        field_names: fieldNames,
        page_size: 100,
        filter,
      }),
      signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuSearchRecordResponse = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '查询待搭建剧集失败')
    }

    return result
  }

  /**
   * 更新剧集状态
   * @param recordId 记录ID
   * @param status 新状态
   * @param tableId 表格ID（可选）
   * @param buildTime 搭建时间（可选，13位时间戳）
   */
  async updateDramaStatus(
    recordId: string,
    status: string,
    tableId?: string,
    buildTime?: number
  ): Promise<FeishuApiResponse<any>> {
    const body: any = { status, table_id: tableId }
    if (buildTime) {
      body.build_time = buildTime
    }

    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/drama-status/${recordId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: FeishuApiResponse<any> = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '更新剧集状态失败')
    }

    return result
  }

  /**
   * 批量创建记录到账户表
   */
  async batchCreateAccounts(
    accounts: Array<{ account: string; isUsed: string }>
  ): Promise<FeishuApiResponse<any>> {
    const tableId = this.getAccountTableId()

    // 调用后端代理接口而不是直接调用飞书 API
    const response = await fetch(`${ENV.BASE_URL}/feishu/bitable/accounts/batch-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accounts, tableId }),
    })

    return await response.json()
  }
}

// 导出单例实例
export const feishuApi = new FeishuApiService()
export default feishuApi
