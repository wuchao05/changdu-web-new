/**
 * 飞书 API 相关类型定义
 */

// 获取 tenant_access_token 的请求参数
export interface FeishuTokenRequest {
  app_id: string
  app_secret: string
}

// 获取 tenant_access_token 的响应
export interface FeishuTokenResponse {
  code: number
  msg: string
  tenant_access_token: string
  expire: number
}

// 飞书 API 通用响应结构
export interface FeishuApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

// 多维表格记录
export interface FeishuRecord {
  record_id: string
  fields: Record<string, any>
  created_by: {
    id: string
    name: string
  }
  created_time: number
  last_modified_by: {
    id: string
    name: string
  }
  last_modified_time: number
}

// 获取记录列表的响应
export interface FeishuRecordsResponse {
  items: FeishuRecord[]
  page_token?: string
  has_more: boolean
  total: number
}

// 创建/更新记录的请求
export interface FeishuRecordRequest {
  fields: Record<string, any>
}

// 批量创建/更新记录的请求
export interface FeishuBatchRecordRequest {
  records: FeishuRecordRequest[]
}

// 表格字段类型
export type FeishuFieldType =
  | 'text' // 文本
  | 'number' // 数字
  | 'select' // 单选
  | 'multiSelect' // 多选
  | 'date' // 日期
  | 'checkbox' // 复选框
  | 'user' // 人员
  | 'phone' // 电话号码
  | 'url' // 超链接
  | 'attachment' // 附件
  | 'relation' // 关联
  | 'formula' // 公式
  | 'createdTime' // 创建时间
  | 'lastModifiedTime' // 最后更新时间
  | 'createdUser' // 创建人
  | 'lastModifiedUser' // 最后修改人
  | 'autoNumber' // 自动编号
  | 'barcode' // 条码
  | 'currency' // 货币
  | 'progress' // 进度
  | 'rating' // 评分
  | 'location' // 地理位置
  | 'lookup' // 查找
  | 'rollup' // 汇总
  | 'count' // 计数

// 表格字段定义
export interface FeishuField {
  field_id: string
  field_name: string
  type: FeishuFieldType
  property?: Record<string, any>
}

// 获取表格字段的响应
export interface FeishuFieldsResponse {
  fields: FeishuField[]
}

// 错误响应
export interface FeishuErrorResponse {
  code: number
  msg: string
  error?: {
    code: string
    message: string
  }
}

// 搜索记录请求类型
export interface FeishuSearchRecordRequest {
  field_names?: string[]
  filter?: {
    conjunction: 'and' | 'or'
    conditions: Array<{
      field_name: string
      operator: 'is' | 'isNot' | 'contains' | 'doesNotContain' | 'isEmpty' | 'isNotEmpty'
      value?: any[]
    }>
  }
  page_size?: number
  page_token?: string
}

// 搜索记录响应类型
export interface FeishuSearchRecordResponse {
  code: number
  msg: string
  data: {
    has_more: boolean
    items: Array<{
      fields: Record<string, any>
      record_id: string
    }>
    total: number
    page_token?: string
  }
}

// 新增记录响应类型
export interface FeishuCreateRecordResponse {
  code: number
  msg: string
  data: {
    record: {
      fields: Record<string, any>
      id: string
      record_id: string
    }
  }
}
