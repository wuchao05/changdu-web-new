import httpInstance from './http'
import { feishuApi } from './feishu'
import type {
  OverviewData,
  ReportData,
  OrderData,
  OverviewParams,
  ReportParams,
  OrderParams,
  DramaRankingData,
  DramaRankingParams,
  DistributorData,
  NewDramaData,
  NewDramaParams,
  DownloadTaskResponse,
  DownloadTaskParams,
  DownloadUrlResponse,
  DramaDetailResponse,
  DramaDetailParams,
  DataOverviewV1Response,
  DataOverviewV1Params,
  MonthlyRechargeAnalyzeResponse,
  MonthlyRechargeAnalyzeParams,
} from './types'

/**
 * 获取数据报表
 */
export function getReport(params: ReportParams): Promise<ReportData> {
  return httpInstance
    .get('/novelsale/distributor/application_overview_list/v1', {
      params: {
        is_optimizer_view: false,
        date_type: 1,
        ...params,
      },
    })
    .then(res => res.data)
}

/**
 * 接口C - 获取订单统计
 */
export function getOrders(params: OrderParams): Promise<OrderData> {
  const finalParams = {
    promotion_type: 0,
    media_source: 0,
    display_type: 1,
    ...params,
  }
  console.log('📡 [API] getOrders 最终参数:', finalParams)
  console.log('📡 [API] 包含 channel_douyin_accounts:', 'channel_douyin_accounts' in finalParams)

  return httpInstance
    .get('/novelsale/distributor/promotion/detail/v2', {
      params: finalParams,
    })
    .then(res => res.data)
}

/**
 * 接口D - 获取短剧排行榜 (已禁用 - 减少Vercel函数数量)
 */
// export function getDramaRanking(params: DramaRankingParams): Promise<DramaRankingData> {
//   return httpInstance
//     .get('/novelsale/distributor/book_recharge/list/v1', {
//       params: {
//         ...params,
//       },
//     })
//     .then(res => res.data)
// }

/**
 * 接口E - 获取分销列表
 * 注意：此接口需要设置 Distributorid 为 0 来获取管理员权限
 */
export function getDistributors(): Promise<DistributorData> {
  return httpInstance
    .get('/novelsale/distributor/login/v1/', {
      params: {},
      headers: {
        // 重要：设置 Distributorid 为 0 表示管理员身份，可以获取所有分销信息
        Distributorid: '0',
      },
    })
    .then(res => res.data)
}


/**
 * 新剧抢跑 - 获取新剧列表（服务端转发常读内部接口）
 */
export function getNewDramaList(params: NewDramaParams = {}): Promise<NewDramaData> {
  return httpInstance
    .get('/novelsale/distributor/content/series/list/v1', {
      params: {
        permission_statuses: '3,4',
        sort_type: 1,
        sort_field: 3,
        page_index: 1,
        page_size: 100,
        ...params,
      },
    })
    .then(res => res.data)
}

/**
 * 新剧抢跑 - 搜索新剧列表（服务端转发常读内部接口）
 * 统一使用关键词查询，固定取前 10 条结果
 */
export function searchNewDramaList(params: NewDramaParams = {}): Promise<NewDramaData> {
  const queryValue = String(params.query || '').trim()
  const resolvedSearchType = /^\d+$/.test(queryValue) ? 1 : 2

  return httpInstance
    .get('/novelsale/distributor/content/series/list/v1', {
      params: {
        permission_statuses: '3,4',
        page_index: 0,
        page_size: 10,
        ...params,
        search_type: resolvedSearchType,
      },
    })
    .then(res => res.data)
}

/**
 * 获取下载任务列表
 */
export function getDownloadTaskList(
  params: DownloadTaskParams = {}
): Promise<DownloadTaskResponse> {
  const requestParams = {
    page_size: 1000,
    ...params,
  }
  console.log('download_center/task_list 请求参数:', requestParams)
  return httpInstance
    .get('/node/api/platform/distributor/download_center/task_list', {
      params: requestParams,
    })
    .then(res => res.data)
}

/**
 * 获取下载链接 - 返回下载URL
 */
export function getDownloadUrl(imagexUri: string): Promise<DownloadUrlResponse> {
  return httpInstance
    .get('/node/api/platform/distributor/download_center/get_url/', {
      params: {
        imagex_uri: imagexUri,
      },
    })
    .then(res => res.data)
}

/**
 * 获取剧集详情 - 用于查看剧集简介
 */
export function getDramaDetail(params: DramaDetailParams): Promise<DramaDetailResponse> {
  return httpInstance
    .get('/novelsale/distributor/content/series/detail/v1', {
      params,
    })
    .then(res => res.data)
}

/**
 * 新API - 获取数据概览v1（今日数据和累计数据）
 */
export function getDataOverviewV1(params: DataOverviewV1Params): Promise<DataOverviewV1Response> {
  return httpInstance
    .get('/novelsale/distributor/dashboard/data_overview/v1', {
      params: {
        is_today: params.is_today,
        app_type: params.app_type,
      },
    })
    .then(res => res.data)
}

/**
 * 本月充值分析接口 - 获取本月充值数据
 */
export function getMonthlyRechargeAnalyze(
  params: MonthlyRechargeAnalyzeParams
): Promise<MonthlyRechargeAnalyzeResponse> {
  return httpInstance
    .get('/novelsale/distributor/dashboard/recharge_analyze/v1', {
      params: {
        begin: params.begin,
        end: params.end,
        analyze_type: params.analyze_type,
        app_type: params.app_type,
      },
    })
    .then(res => res.data)
}

/**
 * 批量提交待下载（服务端处理）
 */
export interface BatchSubmitItem {
  book_id: string
  series_name: string
  publish_time: string
  manualRedFlag?: boolean
}

export interface BatchSubmitResponse {
  code: number
  message: string
  data: {
    taskId: string
    status: string
    total: number
    message: string
  }
}

export function batchSubmitDownload(items: BatchSubmitItem[]): Promise<BatchSubmitResponse> {
  return httpInstance.post('/auto-submit/batch-submit', { items }).then(res => res.data)
}

/**
 * 导出飞书 API 服务
 */
export { feishuApi }
