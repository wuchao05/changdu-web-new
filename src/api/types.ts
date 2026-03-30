// 通用响应类型
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}

// 接口A - 数据概览
export interface OverviewData {
  all_data: number // 累计金额（分）
  month_data: number // 本月金额（分）
  today_data: number // 今日金额（分）
  today_wx_vc_hot_data: number
  today_wx_vc_nature_data: number
  update_ts: string // 更新时间
}

// 新API - 数据概览v1接口
export interface DataOverviewV1Response {
  code: number
  message: string
  data: DataOverviewV1Data
  update_ts: number
}

export interface DataOverviewV1Data {
  add_desktop_user_num: number // 新增桌面用户数
  add_desktop_user_num_diff: number // 新增桌面用户数较昨日变化
  add_desktop_user_rate: number // 新增桌面用户率
  add_desktop_user_rate_diff: number // 新增桌面用户率较昨日变化
  income_amount: number // 收入金额（分）
  income_amount_diff: number // 收入金额较昨日变化（分）
  order_num: number // 订单数
  order_num_diff: number // 订单数较昨日变化
  recharge_amount: number // 充值金额（分）
  recharge_amount_diff: number // 充值金额较昨日变化（分）
  recharge_order_num: number // 充值订单数
  recharge_order_num_diff: number // 充值订单数较昨日变化
  recharge_user_num: number // 充值用户数
  recharge_user_num_diff: number // 充值用户数较昨日变化
  user_num: number // 用户数
  user_num_diff: number // 用户数较昨日变化
  wx_vc_hot_recharge_amount: number // 微信视频号热门充值金额（分）
  wx_vc_hot_recharge_amount_diff: number // 微信视频号热门充值金额较昨日变化（分）
  wx_vc_natural_recharge_amount: number // 微信视频号自然充值金额（分）
  wx_vc_natural_recharge_amount_diff: number // 微信视频号自然充值金额较昨日变化（分）
}

// 数据概览v1接口参数
export interface DataOverviewV1Params {
  is_today: boolean // true=今日数据，false=累计数据
  app_type: number // 应用类型，固定为7
}

// 本月充值分析接口
export interface MonthlyRechargeAnalyzeResponse {
  code: number
  message: string
  data: MonthlyRechargeData[]
  total: number // 本月充值总额（分）
}

export interface MonthlyRechargeData {
  timestamp: number // 时间戳（秒）
  value: number // 充值金额（分）
}

export interface MonthlyRechargeAnalyzeParams {
  begin: string // 开始日期 YYYY-MM-DD
  end: string // 结束日期 YYYY-MM-DD
  analyze_type: number // 分析类型，固定为1
  app_type: number // 应用类型，固定为7
}

// 接口C - 订单统计
export interface OrderData {
  code: number
  message: string
  total: number
  total_amount?: number // 总充值金额（单位：分，仅抖音号过滤时返回）
  all_total?: number // 全部订单数量（启用按用户统计时返回）
  all_total_amount?: number // 全部订单总充值金额（单位：分，启用按用户统计时返回）
  active_promotion_user_name?: string // 当前选中的推广用户名
  promotion_user_stats_enabled?: boolean // 是否启用按用户统计订单
  independent_order_stats_enabled?: boolean // 是否启用独立订单统计
  promotion_user_summaries?: PromotionUserSummary[]
  order_fetch_limit_hit?: boolean // 是否命中常读平台 1w 条订单限制
  data: OrderItem[]
}

export interface OrderItem {
  device_id: string // 用户ID
  order_create_time: string // 订单创建时间（格式: YYYY-MM-DD HH:mm:ss）
  order_paid_time: string // 订单支付时间（格式: YYYY-MM-DD HH:mm:ss）
  pay_amount: number // 支付金额（分）
  pay_status: number // 支付状态 0=成功 1=未支付
  pay_way: string // 支付方式
  promotion_name: string // 推广链来源
}

export interface PromotionUserSummary {
  username: string
  total: number // 命中的订单数
  total_amount: number // 充值总金额（分）
  paid_order_count: number // 支付成功订单数
}

// 查询参数类型
export interface OverviewParams {
  [key: string]: unknown
}

export interface ReportParams {
  begin: string // YYYYMMDD
  end: string // YYYYMMDD
  is_optimizer_view?: boolean
  date_type?: number
  page_index: number
  page_size: number
  channel_douyin_accounts?: string // 抖音号过滤（逗号分隔）
}

export interface OrderParams {
  begin_time: number // 秒级时间戳
  end_time: number // 秒级时间戳
  pay_status?: number // 0=成功 1=未支付 不传=全部
  promotion_type?: number
  media_source?: number
  display_type?: number
  page_index: number
  page_size: number
  channel_douyin_accounts?: string // 抖音号过滤（逗号分隔）
  promotion_user_name?: string // 推广链来源用户名过滤
}

export interface ReportRow {
  date: string | number
  total_amount: number
  paid_user: number
  paid_order: number
  paid_order_rate: number
  new_user_cnt: number
  new_user_amount: number
  paid_new_user_rate: number
  paid_new_user: number
  paid_new_order: number
  paid_new_order_rate: number
}

export interface ReportData {
  code: number
  message: string
  total: number
  data?: ReportRow[]
  report_data?: ReportRow[]
  rows?: ReportRow[]
}

// 短剧排行榜相关类型
export interface DramaRankingData {
  code: number
  message: string
  total: number
  data: DramaRankingItem[]
  log_id: string
}

export interface DramaRankingItem {
  book_id: string // 剧ID
  book_name: string // 剧名
  book_reader_num: number // 阅读人数
  category: string // 分类标签
  consumer_num: number // 消费人数
  date: number // 日期（YYYYMMDD格式）
  date_string: string // 日期字符串（YYYY-MM-DD格式）
  ecpm_cost: number // ECPM成本
  first_recharge_order_amount: number // 首充订单数
  free_chapter_finish_read_rate: number // 免费章节完读率
  free_chapter_read_amount_avg: number // 免费章节平均阅读量
  free_chapter_reader_num: number // 免费章节阅读人数
  order_number: number // 充值订单数
  paid_chapter_read_amount_avg: number // 付费章节平均阅读量
  paid_chapter_reader_num: number // 付费章节阅读人数
  purchase: {
    pay_fee: number // 支付费用
    ticket_fee: number // 票券费用
  }
  recharge_amount: number // 充值金额（分）
  recharge_arpu: number // 充值ARPU（分）
  recharge_order_avg: number // 平均充值订单
  recharge_page_arrive_rate: number // 充值页面到达率
  recharge_rate: number // 充值率（需要乘以100转换为百分比）
  recharge_user: number // 充值人数
  sale_chapter_arrive_rate: number // 付费章节到达率
  turn_page_amount_avg: number // 平均翻页量
  turn_page_user_num: number // 翻页用户数
  wx_vc_hot_order_number: number // 微信视频号热门订单数
  wx_vc_hot_recharge_amount: number // 微信视频号热门充值金额
  wx_vc_hot_recharge_user: number // 微信视频号热门充值用户
  wx_vc_nature_order_number: number // 微信视频号自然订单数
  wx_vc_nature_recharge_amount: number // 微信视频号自然充值金额
  wx_vc_nature_recharge_user: number // 微信视频号自然充值用户
}

export interface DramaRankingParams {
  begin: string // 开始日期 YYYY-MM-DD
  end: string // 结束日期 YYYY-MM-DD
  user_type: number // 用户类型，固定为1
  date_type: number // 数据类型：1=分日，3=累计
  page_index: number // 页码，从0开始
  page_size: number // 每页大小
  book_name?: string // 短剧名称筛选（可选）
}

// 分销列表相关类型
export interface DistributorData {
  code: number
  message: string
  distributor_info_list: DistributorInfo[]
  screen_name: string
  avatar_url: string
}

export interface DistributorInfo {
  account_id: number
  ad_params: {
    media_source_ad_params: {
      [key: string]: {
        callback_num_type: number
      }
    }
  }
  ad_user_id: number
  ad_user_id_str: string
  app_id: number
  app_name: string
  app_type: number
  channel: number
  company_name: string
  create_time: string
  distributor_id: number
  mail: string
  modify_time: string
  nick_name: string
  parent_distributor_id: number
  register: string
  release_status: number
  role: number
  root_distributor_id: number
  secret_key: string
  status: number
}

// 账号类型定义
export type AccountType = 'channel'

export interface AccountConfig {
  id: AccountType
  name: string
  description: string
  apiConfig: {
    cookie: string
    appid: string
    apptype: string
    distributorId?: string
  }
}

// 新剧抢跑 - 新剧列表
export interface NewDramaData {
  code: number
  message: string
  data: {
    data: NewDramaItem[]
    total?: number
  }
}

export interface NewDramaItem {
  album_id_dy: string
  amount_limit_status: number
  book_id: string
  book_pool: number
  category: string
  category_text: string
  creation_status: number
  delivery_status: number
  dy_audit_status: number
  episode_amount: number
  episode_price: number
  free_episode_count: number
  latest_update_time: string
  need_show_publish_tag: boolean
  on_shelf_time: string
  original_thumb_url: string
  permission_status: number
  price_changed: boolean
  publish_time: string
  series_name: string
  thumb_url: string
  // 飞书剧集清单中的下载状态
  feishu_downloaded?: boolean
  // 是否在飞书剧集清单中存在
  feishu_exists?: boolean
}

// 剧集详情接口
export interface DramaDetailResponse {
  code: number
  message: string
  data: {
    abstract: string
    album_id_dy: string
    author: string
    book_id: string
    book_name: string
    creation_status: number
    delivery_status: number
    episode_amount: number
    original_thumb_url: string
    price: number
    recommended_reason: string
    root_book_id: string
    series_audit_status: number
    start_chapter: number
    thumb_uri: string
    thumb_url: string
  }
}

export interface DramaDetailParams {
  book_id: string
}

export interface NewDramaParams {
  permission_statuses?: string // 授权类型筛选（可多选，逗号分隔），例如 "3,4"
  search_type?: number // 搜索类型
  sort_type?: number // 排序方式
  sort_field?: number // 排序字段
  page_index?: number // 页码，不允许超过 1000
  page_size?: number // 每页数量大小，不允许超过 100
  query?: string // 搜索关键词
  gender?: number // 短剧性别筛选：0 = 女频，1 = 男频
  creation_status?: number // 短剧连载状态：0 = 完结，1 = 连载中
  delivery_status?: number // 投放状态筛选：0 = 不可投放，1 = 可投放，2 = 即将下架
  drama_list_table_id?: string // 飞书剧集清单表ID
}

// 下载任务相关类型
export interface DownloadTask {
  task_id: string
  task_name: string
  book_name: string
  book_id?: string // 短剧ID
  task_status: number
  create_time: number
  finish_time?: number
  download_url?: string
  file_size?: number
  imagex_uri?: string
}

export interface DownloadTaskResponse {
  code: number
  data: {
    data: DownloadTask[]
    total: number
  }
  message: string
}

export interface DownloadTaskParams {
  start_time?: number
  end_time?: number
  page_index?: number
  page_size?: number
  task_status?: number
}

// 下载URL响应类型
export interface DownloadUrlResponse {
  download_url: string
  code: number
  message: string
}

// 集数信息相关类型
export interface EpisodeInfo {
  can_operate: number
  chapter_labels: Array<{
    describe: string
    label_key: number
  }>
  chapter_name: string
  enable_promotion_click: boolean
  item_id: string
  item_url: string
  need_pay: number
  order: number
}

export interface EpisodeInfoResponse {
  data: {
    data: EpisodeInfo[]
  }
}

export interface EpisodeInfoParams {
  page_index: number
  page_size: number
  book_id: string
}

// 番茄后台 - 剧集查询
export interface SplayAlbumItem {
  id: number
  title: string
  cover: string
  promotion_status: number
  publish_status: number
  is_delete: number
  copyright_content_id?: string // 版权内容ID，用于添加番茄剧集
}

export interface SplayAlbumSearchResponse {
  code: number
  message: string
  data?: {
    total_count: number
    total_page: number
    list: SplayAlbumItem[]
  }
}

// 番茄后台 - 小程序链接
export interface SplayMiniProgramResponse {
  code: number
  message: string
  data: string
}

// 番茄后台 - 新增商品
export interface SplayProductInfo {
  mini_program_info: string
  playlet_gender: '1' | '2' | '3'
  name: string
  ad_carrier: string
  album_id: number
  image_url: string
  first_category: string
  sub_category: string
  third_category: string
  first_category_id: string
  sub_category_id: string
  third_category_id: string
}

export interface SplayCreateProductParams {
  product_list: SplayProductInfo[]
  ad_account_id: string
  is_free: number
  product_platform_id: string
}

export interface SplayCreateProductEntry {
  album_id: number
  result: string
  name: string
  product_id: string
  product_platform_id: string
}

export interface SplayCreateProductResponse {
  code: number
  message: string
  data: SplayCreateProductEntry[]
}
