import dayjs from 'dayjs'

/**
 * 清除剧名中的特殊符号
 * @param name 原始剧名
 * @returns 清除特殊符号后的剧名
 */
export function cleanDramaName(name: string): string {
  if (!name) return ''
  return name.replace(/[：，！?"']/g, '').trim()
}

/**
 * 解析推广链接URL
 * @param url 推广链接URL
 * @returns 解析后的启动页面和参数
 */
export function parsePromotionUrl(url: string): {
  launchPage: string
  launchParams: string
} {
  if (!url) {
    return { launchPage: '', launchParams: '' }
  }
  const [page, params] = url.split('?')
  return {
    launchPage: page,
    launchParams: params || '',
  }
}

/**
 * 复制到剪贴板
 * @param text 要复制的文本
 * @returns 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param date 日期对象
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD')
}

/**
 * 生成推广链接名称
 * @param dramaName 剧名
 * @returns 推广链接名称
 */
export function generatePromotionName(dramaName: string, brandName = '小红'): string {
  return `${brandName}短剧-${cleanDramaName(dramaName)}`
}

/**
 * 生成智能搭建使用的推广链接名称
 * @param douyinAccount 抖音号名称
 * @param dramaName 剧名
 * @param accountId 广告账户ID
 * @returns 推广链接名称
 */
export function generateSmartPromotionName(
  douyinAccount: string,
  dramaName: string,
  accountId: string,
  brandName = '小红'
): string {
  return `${brandName}短剧-${douyinAccount}-${cleanDramaName(dramaName)}-${accountId}`
}

/**
 * 抖音素材配置项
 */
export interface DouyinMaterialConfig {
  douyinAccount: string
  douyinAccountId: string
  materialRange: string
}

/**
 * 验证素材序号格式是否有效
 * @param materialRange 素材序号，如 "01-05" 或 "01"
 * @returns 是否有效
 */
function isValidMaterialRange(materialRange: string): boolean {
  if (!materialRange) return false
  // 支持格式: "01", "01-05", "001-010"
  const rangePattern = /^\d+(-\d+)?$/
  return rangePattern.test(materialRange.trim())
}

/**
 * 从飞书状态表的"抖音素材"字段解析配置
 * @param douyinMaterialText 抖音素材字段内容
 * @returns 解析后的抖音素���配置数组
 *
 * 字段格式示例:
 * 小红看剧 25655660267 01-05
 * 斯娜看剧 34996393230 06-10
 * 葸辉好剧 63222312178 11-15
 */
export function parseDouyinMaterialFromFeishu(
  douyinMaterialText: string | undefined
): DouyinMaterialConfig[] {
  if (!douyinMaterialText || typeof douyinMaterialText !== 'string') {
    return []
  }

  const lines = douyinMaterialText.trim().split('\n')
  const configs: DouyinMaterialConfig[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    // 按空白字符分割：抖音号名称、抖音号ID、素材序号
    const parts = trimmedLine.split(/\s+/)
    if (parts.length >= 3) {
      const douyinAccount = parts[0].trim()
      const douyinAccountId = parts[1].trim()
      const materialRange = parts[2].trim()

      if (isValidMaterialRange(materialRange)) {
        configs.push({
          douyinAccount,
          douyinAccountId,
          materialRange,
        })
      }
    }
  }

  return configs
}
