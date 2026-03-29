/**
 * 素材筛选工具函数
 */

export interface Material {
  video_id: string
  filename: string
  [key: string]: unknown
}

export interface ParsedMaterialName {
  date: string // 例如: "1.6" (月.日格式)
  dramaName: string // 例如: "玄门泰斗开局竟被当凡夫"
  userTag: string // 例如: "xh"
  sequence: string // 例如: "01", "02", "03"
}

/**
 * 解析素材文件名
 * 格式：{日期}-{剧名}-{用户标识}-{序号}.mp4
 * 示例：1.6-玄门泰斗开局竟被当凡夫-xh-01.mp4
 * @param filename 素材文件名
 * @returns 解析后的素材信息，如果解析失败返回 null
 */
export function parseMaterialName(filename: string): ParsedMaterialName | null {
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
 * @param sequence 序号，例如 "01", "02"
 * @param range 范围，例如 "01-04"
 * @returns 是否在范围内
 */
export function isSequenceInRange(sequence: string, range: string): boolean {
  if (!sequence || !range) return false

  // 解析范围
  const [startStr, endStr] = range.split('-')
  if (!startStr || !endStr) return false

  const seq = parseInt(sequence, 10)
  const start = parseInt(startStr, 10)
  const end = parseInt(endStr, 10)

  if (isNaN(seq) || isNaN(start) || isNaN(end)) return false

  return seq >= start && seq <= end
}

/**
 * 根据规则筛选素材
 * @param materials 素材列表
 * @param dramaName 剧名（用于匹配）
 * @param sequenceRange 序号范围，例如 "01-04"
 * @param dateString 日期字符串（可选），格式："M.D"，例如 "1.6"
 * @returns 筛选后的素材列表
 */
export function filterMaterials(
  materials: Material[],
  dramaName: string,
  sequenceRange: string,
  dateString?: string
): Material[] {
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

    console.log(`素材 ${index + 1}:`, {
      filename: material.filename,
      parsed: parsed,
    })

    // 1. 日期匹配（如果指定了日期）
    if (dateString && parsed.date !== dateString) {
      console.log(`  ❌ 日期不匹配: "${parsed.date}" !== "${dateString}"`)
      return false
    }

    // 2. 剧名匹配（宽松匹配，去除特殊符号后比较）
    const parsedDramaName = parsed.dramaName.replace(/[：，！?"']/g, '').trim()
    if (parsedDramaName !== cleanedDramaName) {
      console.log(`  ❌ 剧名不匹配: "${parsedDramaName}" !== "${cleanedDramaName}"`)
      return false
    }

    // 3. 序号范围匹配
    if (!isSequenceInRange(parsed.sequence, sequenceRange)) {
      console.log(`  ❌ 序号不在范围内: "${parsed.sequence}" 不在 "${sequenceRange}" 范围内`)
      return false
    }

    console.log(`  ✅ 匹配成功`)
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
 * @param materials 素材列表
 * @returns 排序后的素材列表
 */
export function sortMaterialsBySequence(materials: Material[]): Material[] {
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
