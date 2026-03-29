/**
 * 小程序链接生成工具函数
 * 用于自动创建小程序时生成链接
 */

/**
 * 生成指定长度的随机字符串（0-9a-z）
 */
function generateRandomString(length: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 生成 uniq_id
 * 格式：W + yyyyMMddHHmmss + 3位数字 + 8位随机串[0-9a-z]
 * 示例：W20260111114427273cp0vp10s
 */
export function generateUniqId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')

  const timestamp = `${year}${month}${day}${hour}${minute}${second}`
  const threeDigits = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')
  const randomStr = generateRandomString(8)

  return `W${timestamp}${threeDigits}${randomStr}`
}

/**
 * 生成 bdpsum
 * 格式：7位随机串[0-9a-z]
 * 示例：8a99de0
 */
export function generateBdpsum(): string {
  return generateRandomString(7)
}

/**
 * 生成小程序链接（已编码）
 * @param params 小程序参数
 * @returns 编码后的小程序链接
 */
export function generateMicroAppLink(params: {
  appId: string
  startPage: string
  startParams: string
}): string {
  const { appId, startPage, startParams } = params
  const uniqId = generateUniqId()
  const bdpsum = generateBdpsum()

  // 解析 startParams 并按指定顺序重排
  const paramsMap = new Map<string, string>()
  startParams.split('&').forEach(pair => {
    const [key, value] = pair.split('=')
    if (key && value) {
      paramsMap.set(key, value)
    }
  })

  // 按照指定顺序重新组织 start_page 内部的参数
  const orderedKeys = [
    'advertiser_id',
    'aid',
    'click_id',
    'code',
    'item_source',
    'media_source',
    'mid1',
    'mid2',
    'mid3',
    'mid4',
    'mid5',
    'request_id',
    'tt_album_id',
    'tt_episode_id',
  ]

  const orderedParams: string[] = []
  orderedKeys.forEach(key => {
    if (paramsMap.has(key)) {
      orderedParams.push(`${key}=${paramsMap.get(key)}`)
    }
  })

  // 添加未在顺序列表中的其他参数（保持原顺序）
  paramsMap.forEach((value, key) => {
    if (!orderedKeys.includes(key)) {
      orderedParams.push(`${key}=${value}`)
    }
  })

  const reorderedParams = orderedParams.join('&')

  // 构建 bdp_log JSON 字符串并编码
  const bdpLog = '{"launch_from":"ad","location":""}'
  const encodedBdpLog = encodeURIComponent(bdpLog)

  // 构建 start_page 值并编码
  const startPageValue = `${startPage}?${reorderedParams}`
  const encodedStartPage = encodeURIComponent(startPageValue)

  // 构建小程序链接（已编码关键参数）
  const link =
    `sslocal://microapp?` +
    `app_id=${appId}&` +
    `bdp_log=${encodedBdpLog}&` +
    `scene=0&` +
    `start_page=${encodedStartPage}&` +
    `uniq_id=${uniqId}&` +
    `version=v2&` +
    `version_type=current&` +
    `bdpsum=${bdpsum}`

  return link
}

/**
 * 从启动参数中提取 app_id
 * @param params 启动参数字符串
 * @returns app_id 或空字符串
 */
export function extractAppIdFromParams(params: string): string {
  const match = params.match(/app_id=([^&]+)/)
  return match ? match[1] : ''
}
