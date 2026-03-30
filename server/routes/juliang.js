/**
 * 巨量引擎 API 代理路由
 */
import Router from '@koa/router'
import { createSessionRuntimeContextMiddleware } from '../utils/runtimeContextMiddleware.js'

const router = new Router()

router.use(createSessionRuntimeContextMiddleware('juliangContext'))

function extractCsrfToken(cookie = '') {
  const match = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

async function getRuntimeJuliangConfig(ctx) {
  const cookie = String(ctx.state.channelRuntime?.juliang?.cookie || '').trim()
  const buildConfig = ctx.state.channelRuntime?.buildConfig || {}

  return {
    cookie,
    csrfToken: extractCsrfToken(cookie),
    buildConfig,
  }
}

function buildLegacyAccountListPayload(params = {}) {
  return { ...params }
}

function buildEbpAccountListPayload(params = {}) {
  const startTime = String(params.startTime || params.start_time || '').trim()
  const endTime = String(params.endTime || params.end_time || '').trim()

  return {
    startTime,
    endTime,
    cascadeMetrics: [
      'advertiser_name',
      'advertiser_id',
      'advertiser_followed',
      'advertiser_status',
      'advertiser_status_name',
      'group_name_full_path',
      'sub_shared_wallet_id',
      'sub_shared_wallet_name',
      'share_sub_wallet_balance',
      'sub_shared_wallet_total_budget',
      'sub_shared_wallet_consume_percent',
      'sub_shared_wallet_budget_mode',
    ],
    fields: ['stat_total_balance', 'show_cnt', 'convert_cnt', 'conversion_cost', 'conversion_rate'],
    orderField: 'stat_cost',
    orderType: 1,
    offset: Number(params.offset || 1),
    limit: Number(params.limit || 100),
    accountType: 0,
    filter: {
      pricingCategory: [2],
      advertiser: {},
      campaign: {},
      isActive: true,
    },
    platformVersion: '2',
    refer: 'ebp,7460463278641119259,7436302986713841691,ebp_promotion_ad_bidding_account',
  }
}

function normalizeEbpAccountListResponse(result = {}) {
  const list = Array.isArray(result?.data?.list) ? result.data.list : []
  const pagination = result?.data?.pagination || {}
  const totalMetrics = result?.data?.totalMetrics || {}

  return {
    code: Number(result.code || 0),
    msg: result.msg || '',
    data: {
      data_list: list.map(item => ({
        advertiser_id: item.advertiser_id,
        advertiser_name: item.advertiser_name || '',
        advertiser_status: item.advertiser_status,
        advertiser_status_name: item.advertiser_status_name || '',
        advertiser_remark: item.advertiser_remark || '',
        advertiser_balance: item?.metrics?.stat_total_balance || item.stat_total_balance || '',
        advertiser_followed: item.advertiser_followed,
        group_name: item.group_name || item.group_name_full_path || '',
        group_id: item.group_id,
        stat_cost: item?.metrics?.stat_cost || '',
        show_cnt: item?.metrics?.show_cnt || '',
        convert_cnt: item?.metrics?.convert_cnt || '',
        conversion_cost: item?.metrics?.conversion_cost || '',
        conversion_rate: item?.metrics?.conversion_rate || '',
      })),
      pagination: {
        page: Number(pagination.page || 0),
        limit: Number(pagination.limit || 0),
        total: Number(pagination.total || 0),
        hasMore: Boolean(pagination.hasMore),
      },
      total_metrics: {
        stat_total_balance: totalMetrics.stat_total_balance || '',
        show_cnt: totalMetrics.show_cnt || '',
        convert_cnt: totalMetrics.convert_cnt || '',
        conversion_cost: totalMetrics.conversion_cost || '',
        conversion_rate: totalMetrics.conversion_rate || '',
        stat_cost: totalMetrics.stat_cost || '',
      },
    },
    request_id: result.logid || result.request_id || '',
  }
}

// 获取账户列表
router.post('/api/juliang/get_account_list', async ctx => {
  try {
    // 从请求体中获取参数（不再需要前端传配置）
    const params = ctx.request.body
    const juliangConfig = await getRuntimeJuliangConfig(ctx)
    const useNewJuliangFlow = Boolean(juliangConfig.buildConfig?.useNewMicroAppAssetFlow)
    const ebpid = String(juliangConfig.buildConfig?.ebpid || '').trim()
    const requestHeaders = useNewJuliangFlow
      ? {
          priority: 'u=1, i',
          'x-csrftoken': juliangConfig.csrfToken,
          Cookie: juliangConfig.cookie,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
          Cookie: juliangConfig.cookie,
          'X-CSRFToken': juliangConfig.csrfToken,
        }
    const requestUrl = useNewJuliangFlow
      ? `https://business.oceanengine.com/api/ebp/promotion/ad/get_account_list?ebpid=${ebpid}`
      : 'https://business.oceanengine.com/nbs/api/bm/promotion/ad/get_account_list'
    const requestBody = useNewJuliangFlow
      ? buildEbpAccountListPayload(params)
      : buildLegacyAccountListPayload(params)

    if (useNewJuliangFlow && !ebpid) {
      throw new Error('当前渠道已启用新版巨量，但未配置 ebpid')
    }

    console.log('========== 拉取巨量账户列表 ==========')
    console.log('请求 URL:', requestUrl)
    console.log('请求头:', JSON.stringify(requestHeaders, null, 2))
    console.log('请求参数:', JSON.stringify(requestBody, null, 2))

    // 调用巨量引擎 API，使用后端配置
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    ctx.body = useNewJuliangFlow ? normalizeEbpAccountListResponse(data) : data
  } catch (error) {
    console.error('获取巨量账户列表失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      msg: error.message || '获取账户列表失败',
    }
  }
})

// 编辑账户备注
router.post('/api/juliang/edit_account_remark', async ctx => {
  try {
    // 从请求体中获取参数（不再需要前端传配置）
    const { account_id, remark } = ctx.request.body
    const juliangConfig = await getRuntimeJuliangConfig(ctx)
    const useNewJuliangFlow = Boolean(juliangConfig.buildConfig?.useNewMicroAppAssetFlow)
    const ebpid = String(juliangConfig.buildConfig?.ebpid || '').trim()
    const requestUrl = useNewJuliangFlow
      ? `https://business.oceanengine.com/api/ebp/promotion/common/edit_account_remark?ebpid=${ebpid}`
      : 'https://business.oceanengine.com/nbs/api/bm/promotion/edit_account_remark'
    const requestHeaders = useNewJuliangFlow
      ? {
          Cookie: juliangConfig.cookie,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
          Cookie: juliangConfig.cookie,
          'X-CSRFToken': juliangConfig.csrfToken,
        }
    const requestBody = useNewJuliangFlow
      ? { accountId: account_id, remark }
      : { account_id, remark }

    if (useNewJuliangFlow && !ebpid) {
      throw new Error('当前渠道已启用新版巨量，但未配置 ebpid')
    }

    // 调用巨量引擎 API，使用后端配置
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    ctx.body = data
  } catch (error) {
    console.error('编辑账户备注失败:', error)
    ctx.status = 500
    ctx.body = {
      code: -1,
      msg: error.message || '编辑账户备注失败',
    }
  }
})

export default router
