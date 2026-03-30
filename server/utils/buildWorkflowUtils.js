/**
 * 每日搭建工具函数
 * 从前端迁移过来的工具函数，用于后端调度器
 */

/**
 * 清除剧名中的特殊符号
 * @param {string} name 原始剧名
 * @returns {string} 清除特殊符号后的剧名
 */
export function cleanDramaName(name) {
  if (!name) return ''
  return name.replace(/[：，！?"']/g, '').trim()
}

/**
 * 清理剧名中的特殊标点符号（更严格版本）
 * @param {string} name 原始剧名
 * @returns {string} 清除特殊符号后的剧名
 */
export function sanitizeDramaName(name) {
  return name.replace(
    /[，。：；！？、''""（）《》【】……—·\s,.:;!?()\[\]{}'"<>\/\\|~`@#$%^&*+=]/g,
    ''
  )
}

/**
 * 解析推广链接URL
 * @param {string} url 推广链接URL
 * @returns {{ launchPage: string, launchParams: string }} 解析后的启动页面和参数
 */
export function parsePromotionUrl(url) {
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
 * 生成推广链接名称
 * @param {string} dramaName 剧名
 * @returns {string} 推广链接名称
 */
export function generatePromotionName(dramaName, brandName = '小红') {
  return `${brandName}短剧-${cleanDramaName(dramaName)}`
}

/**
 * 生成智能搭建使用的推广链接名称
 * @param {string} douyinAccount 抖音号名称
 * @param {string} dramaName 剧名
 * @param {string} accountId 广告账户ID
 * @returns {string} 推广链接名称
 */
export function generateSmartPromotionName(douyinAccount, dramaName, accountId, brandName = '小红') {
  return `${brandName}短剧-${douyinAccount}-${cleanDramaName(dramaName)}-${accountId}`
}

// ============== 小程序链接生成工具 ==============

/**
 * 生成指定长度的随机字符串（0-9a-z）
 * @param {number} length 长度
 * @returns {string} 随机字符串
 */
function generateRandomString(length) {
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
 * @returns {string} uniq_id
 */
export function generateUniqId() {
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
 * @returns {string} bdpsum
 */
export function generateBdpsum() {
  return generateRandomString(7)
}

/**
 * 生成小程序链接（已编码）
 * @param {{ appId: string, startPage: string, startParams: string }} params 小程序参数
 * @returns {string} 编码后的小程序链接
 */
export function generateMicroAppLink(params) {
  const { appId, startPage, startParams } = params
  const uniqId = generateUniqId()
  const bdpsum = generateBdpsum()

  // 解析 startParams 并按指定顺序重排
  const paramsMap = new Map()
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

  const orderedParams = []
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
 * @param {string} params 启动参数字符串
 * @returns {string} app_id 或空字符串
 */
export function extractAppIdFromParams(params) {
  const match = params.match(/app_id=([^&]+)/)
  return match ? match[1] : ''
}

// ============== 素材筛选工具 ==============

/**
 * 解析素材文件名
 * 格式：{日期}-{剧名}-{用户标识}-{序号}.mp4
 * 示例：1.6-玄门泰斗开局竟被当凡夫-xh-01.mp4
 * @param {string} filename 素材文件名
 * @returns {{ date: string, dramaName: string, userTag: string, sequence: string } | null} 解析后的素材信息
 */
export function parseMaterialName(filename) {
  if (!filename) return null

  // 移除文件扩展名
  const nameWithoutExt = filename.replace(/\.(mp4|MP4|mov|MOV|avi|AVI)$/, '')

  // 按 '-' 分割
  const parts = nameWithoutExt.split('-')

  // 至少需要4个部分：日期-剧名-用户标签-序号
  if (parts.length < 4) {
    console.warn(`素材文件名格式不正确: ${filename}`)
    return null
  }

  return {
    date: parts[0].trim(),
    dramaName: parts[1].trim(),
    userTag: parts[2].trim(),
    sequence: parts[3].trim(),
  }
}

/**
 * 检查序号是否在指定范围内
 * @param {string} sequence 序号，例如 "01", "02"
 * @param {string} range 范围，例如 "01-04"
 * @returns {boolean} 是否在范围内
 */
export function isSequenceInRange(sequence, range) {
  if (!sequence || !range) return false

  const seq = parseInt(sequence, 10)
  if (isNaN(seq)) return false

  // 检查是否是单个序号（不包含 '-'）
  if (!range.includes('-')) {
    const target = parseInt(range, 10)
    if (isNaN(target)) return false
    return seq === target
  }

  // 解析范围
  const [startStr, endStr] = range.split('-')
  if (!startStr || !endStr) return false

  const start = parseInt(startStr, 10)
  const end = parseInt(endStr, 10)

  if (isNaN(start) || isNaN(end)) return false

  return seq >= start && seq <= end
}

/**
 * 根据规则筛选素材
 * @param {Array<{ video_id: string, filename: string, [key: string]: unknown }>} materials 素材列表
 * @param {string} dramaName 剧名（用于匹配）
 * @param {string} sequenceRange 序号范围，例如 "01-04"
 * @param {string} [dateString] 日期字符串（可选），格式："M.D"，例如 "1.6"
 * @returns {Array} 筛选后的素材列表
 */
export function filterMaterials(materials, dramaName, sequenceRange, dateString) {
  if (!materials || materials.length === 0) {
    console.warn('素材列表为空')
    return []
  }

  if (!dramaName || !sequenceRange) {
    console.warn('缺少筛选参数：dramaName 或 sequenceRange')
    return []
  }

  console.log('=== 开始筛选素材 ===')
  console.log('剧名:', dramaName)
  console.log('序号范围:', sequenceRange)
  console.log('日期:', dateString || '不限')
  console.log('素材总数:', materials.length)

  // 清除剧名中的特殊符号，用于宽松匹配
  const cleanedDramaName = dramaName.replace(/[：，！?"']/g, '').trim()
  console.log('清理后的剧名:', cleanedDramaName)

  const filtered = materials.filter((material, index) => {
    const parsed = parseMaterialName(material.filename)

    if (!parsed) {
      console.log(`素材 ${index + 1}: 文件名解析失败 - ${material.filename}`)
      return false
    }

    // 1. 日期匹配（如果指定了日期）
    if (dateString && parsed.date !== dateString) {
      return false
    }

    // 2. 剧名匹配（宽松匹配，去除特殊符号后比较）
    const parsedDramaName = parsed.dramaName.replace(/[：，！?"']/g, '').trim()
    if (parsedDramaName !== cleanedDramaName) {
      return false
    }

    // 3. 序号范围匹配
    if (!isSequenceInRange(parsed.sequence, sequenceRange)) {
      return false
    }

    return true
  })

  console.log(
    `素材筛选结果: 剧名=${dramaName}, 日期=${dateString || '不限'}, 范围=${sequenceRange}, 筛选前=${materials.length}, 筛选后=${filtered.length}`
  )
  console.log('=== 筛选完成 ===')

  return filtered
}

/**
 * 按序号对素材进行排序
 * @param {Array<{ video_id: string, filename: string, [key: string]: unknown }>} materials 素材列表
 * @returns {Array} 排序后的素材列表
 */
export function sortMaterialsBySequence(materials) {
  return [...materials].sort((a, b) => {
    const parsedA = parseMaterialName(a.filename)
    const parsedB = parseMaterialName(b.filename)

    if (!parsedA || !parsedB) return 0

    const seqA = parseInt(parsedA.sequence, 10)
    const seqB = parseInt(parsedB.sequence, 10)

    if (isNaN(seqA) || isNaN(seqB)) return 0

    return seqA - seqB
  })
}

/**
 * 格式化日期为 YYYYMMDD 格式
 * @param {Date} [date] 日期对象，默认为当前日期
 * @returns {string} 格式化后的日期字符串
 */
export function formatBuildDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

// ============== 抖音素材配置解析工具 ==============

/**
 * 解析飞书状态表中的"抖音素材"字段
 * 格式示例：
 * 小红看剧 25655660267 01-05
 * 斯娜看剧 3499633230 06-10
 * 葸辉好剧 63222312178 11-15
 *
 * @param {string} douyinMaterialText 飞书状态表"抖音素材"字段的文本内容
 * @returns {Array<{douyinAccount: string, douyinAccountId: string, materialRange: string}>} 解析后的抖音号配置列表
 */
export function parseDouyinMaterialFromFeishu(douyinMaterialText) {
  if (!douyinMaterialText || typeof douyinMaterialText !== 'string') {
    return []
  }

  // 按行分割文本
  const lines = douyinMaterialText.trim().split('\n')
  const configs = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    // 按空格分割，每行格式：抖音号名称 抖音号ID 素材序号
    const parts = trimmedLine.split(/\s+/)

    // 至少需要3个部分：抖音号名称、抖音号ID、素材序号
    if (parts.length >= 3) {
      const douyinAccount = parts[0].trim()
      const douyinAccountId = parts[1].trim()
      const materialRange = parts[2].trim()

      // 验证素材序号格式（如 01-05 或 01）
      if (isValidMaterialRange(materialRange)) {
        configs.push({
          douyinAccount,
          douyinAccountId,
          materialRange,
        })
      } else {
        console.warn(`跳过无效的素材序号格式: ${materialRange} (行: ${trimmedLine})`)
      }
    }
  }

  console.log(`从飞书抖音素材字段解析出 ${configs.length} 个抖音号配置`)
  return configs
}

/**
 * 验证素材序号范围格式是否有效
 * @param {string} range 素材序号范围，如 "01-04" 或 "01"
 * @returns {boolean} 是否有效
 */
function isValidMaterialRange(range) {
  if (!range) return false

  // 单个素材序号（如 "01"）
  const singlePattern = /^\d{2}$/
  if (singlePattern.test(range)) return true

  // 范围格式（如 "01-04"）
  const rangePattern = /^(\d{2})-(\d{2})$/
  const match = range.match(rangePattern)
  if (match) {
    const start = parseInt(match[1], 10)
    const end = parseInt(match[2], 10)
    return end >= start // 确保结束序号大于等于开始序号
  }

  return false
}
