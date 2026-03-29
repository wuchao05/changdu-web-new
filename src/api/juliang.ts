/**
 * 巨量引擎 API 相关接口
 * 用于调用字节跳动巨量引擎广告平台的 API
 * 配置统一在后端管理（server/config/juliang.js）
 */

import axios, { type AxiosInstance } from 'axios'
import { buildSessionHeaders } from '@/utils/sessionToken'

/**
 * 账户列表响应类型（基于真实返回结构）
 */
export interface JuliangAccountItem {
  advertiser_id: number
  advertiser_name: string
  advertiser_status: number
  advertiser_status_name: string
  advertiser_remark: string
  advertiser_balance?: string
  advertiser_valid_balance?: string
  stat_cost?: string
  show_cnt?: string
  convert_cnt?: string
  conversion_cost?: string
  conversion_rate?: string
  group_name?: string
  group_id?: number
}

export interface JuliangAccountListResponse {
  code: number
  msg: string
  data: {
    data_list: JuliangAccountItem[]
    pagination: {
      page: number
      limit: number
      total: number
      hasMore: boolean
    }
    total_metrics?: any
  }
  request_id: string
}

/**
 * 编辑备注响应类型
 */
export interface JuliangEditRemarkResponse {
  code: number
  msg: string
  data: {}
  request_id: string
}

/**
 * 创建巨量引擎专用的 axios 实例
 */
export const createJuliangHttpInstance = (): AxiosInstance => {
  return axios.create({
    timeout: 30 * 60 * 1000,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * 获取巨量引擎的请求头配置
 * @deprecated 配置已移至后端，前端无需再调用此方法
 */
export function getJuliangHeaders() {
  console.warn('getJuliangHeaders 已废弃，配置已移至后端')
  return {
    Cookie: '',
    'X-CSRFToken': '',
  }
}

/**
 * 获取账户列表（通过后端代理，配置在后端）
 */
export async function getJuliangAccountList(
  params: {
    offset: number
    limit?: number
  },
  signal?: AbortSignal
): Promise<JuliangAccountListResponse> {
  const today = new Date()
  const todayStart = new Date(today.setHours(0, 0, 0, 0))
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const response = await fetch('/api/juliang/get_account_list', {
    method: 'POST',
    headers: {
      ...buildSessionHeaders({
        'Content-Type': 'application/json',
      }),
    },
    signal, // 传递 AbortSignal
    body: JSON.stringify({
      start_time: Math.floor(todayStart.getTime() / 1000).toString(),
      end_time: Math.floor(tomorrowStart.getTime() / 1000).toString(),
      cascade_metrics: [
        'advertiser_name',
        'advertiser_id',
        'advertiser_status',
        'advertiser_remark',
        'advertiser_balance',
        'advertiser_followed',
      ],
      fields: ['stat_cost', 'show_cnt', 'convert_cnt', 'conversion_cost', 'conversion_rate'],
      order_field: 'stat_cost',
      order_type: 1,
      offset: params.offset,
      limit: params.limit || 100,
      account_type: 0,
      filter: {
        advertiser: {},
        group: {},
        pricingCategory: [2],
        campaign: {},
      },
      platform_version: '2.0',
      ocean_white: true,
      is_active: true,
    }),
  })

  return await response.json()
}

/**
 * 添加账户备注（通过后端代理，配置在后端）
 */
export async function editJuliangAccountRemark(params: {
  account_id: string
  remark: string
}): Promise<JuliangEditRemarkResponse> {
  const response = await fetch('/api/juliang/edit_account_remark', {
    method: 'POST',
    headers: {
      ...buildSessionHeaders({
        'Content-Type': 'application/json',
      }),
    },
    body: JSON.stringify({
      account_id: params.account_id,
      remark: params.remark,
    }),
  })

  return await response.json()
}

/**
 * 示例：调用巨量引擎 API
 * @param url - API 路径
 * @param method - 请求方法
 * @param data - 请求数据
 */
export async function callJuliangApi<T = any>(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  data?: any
): Promise<T> {
  const httpInstance = createJuliangHttpInstance()
  const headers = getJuliangHeaders()

  // 请求拦截器：添加巨量引擎专用的请求头
  httpInstance.interceptors.request.use(config => {
    Object.assign(config.headers, headers)
    return config
  })

  const response = await httpInstance.request<T>({
    url,
    method,
    data,
  })

  return response.data
}

// 导出实例供外部使用
export const juliangHttp = createJuliangHttpInstance()
