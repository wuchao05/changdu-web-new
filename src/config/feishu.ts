/**
 * 飞书多维表格配置
 */
export const FEISHU_CONFIG = {
  // 应用配置
  app_id: import.meta.env.VITE_FEISHU_APP_ID,
  app_secret: import.meta.env.VITE_FEISHU_APP_SECRET,
  app_token: import.meta.env.VITE_FEISHU_APP_TOKEN,

  // API 端点
  api_base_url: 'https://open.feishu.cn/open-apis',

  table_ids: {
    drama_list: 'tblvuZhBd4drW26n',
    drama_status: 'tblDOyi2Lzs80sv0',
    account: 'tblh9obuLh1g7hOS',
  },

  // API 路径
  endpoints: {
    // 获取 app_access_token
    get_app_access_token: '/auth/v3/app_access_token/internal',
    // 多维表格 API 基础路径
    bitable_base: '/bitable/v1/apps',
  },
} as const

/**
 * 飞书 API 请求配置
 */
export const FEISHU_API_CONFIG = {
  // 请求头配置
  headers: {
    'Content-Type': 'application/json',
  },

  // 超时时间（毫秒）
  timeout: 10000,

  // 重试次数
  retry_count: 3,
} as const
