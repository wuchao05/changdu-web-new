import type { AxiosRequestConfig } from 'axios'
import httpInstance from './http'

export interface DouyinMaterialMatch {
  id: string
  douyinAccountRefId: string
  douyinAccount: string
  douyinAccountId: string
  cooperationCode: string
  materialRange: string
  createdAt: string
  updatedAt: string
}

function buildFeishuTableGroupHeaders(feishuTableGroupId?: string) {
  const normalizedGroupId = String(feishuTableGroupId || '').trim()
  return normalizedGroupId ? { 'x-feishu-table-group-id': normalizedGroupId } : undefined
}

/**
 * 获取所有抖音号素材匹配配置
 */
export function getDouyinMaterialConfig(
  config: Pick<AxiosRequestConfig, 'signal'> & { feishuTableGroupId?: string } = {}
): Promise<DouyinMaterialMatch[]> {
  return httpInstance
    .get('/douyin-material/config', {
      signal: config.signal,
      headers: buildFeishuTableGroupHeaders(config.feishuTableGroupId),
    })
    .then(res => res.data.data)
}

/**
 * 添加抖音号素材匹配规则
 */
export function addDouyinMaterialMatch(match: {
  douyinAccountRefId: string
  materialRange: string
  feishuTableGroupId?: string
}): Promise<DouyinMaterialMatch> {
  return httpInstance
    .post('/douyin-material/config', match, {
      headers: buildFeishuTableGroupHeaders(match.feishuTableGroupId),
    })
    .then(res => res.data.data)
}

/**
 * 更新抖音号素材匹配规则
 */
export function updateDouyinMaterialMatch(
  id: string,
  updates: Partial<DouyinMaterialMatch> & { feishuTableGroupId?: string }
): Promise<DouyinMaterialMatch> {
  return httpInstance
    .put(`/douyin-material/config/${id}`, updates, {
      headers: buildFeishuTableGroupHeaders(updates.feishuTableGroupId),
    })
    .then(res => res.data.data)
}

/**
 * 删除抖音号素材匹配规则
 */
export function deleteDouyinMaterialMatch(id: string, feishuTableGroupId?: string): Promise<void> {
  return httpInstance
    .delete(`/douyin-material/config/${id}`, {
      headers: buildFeishuTableGroupHeaders(feishuTableGroupId),
    })
    .then(() => undefined)
}
