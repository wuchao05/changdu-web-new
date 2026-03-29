/**
 * 日期处理工具函数
 */

/**
 * 获取上传用日期范围：昨天、今天和未来3天（共5天）
 * @param timezone 时区，默认为 Asia/Shanghai
 * @returns 包含5个日期的数组，格式为 YYYY-MM-DD
 */
export function getNext7Days(timezone: string = 'Asia/Shanghai'): string[] {
  const dates: string[] = []
  const today = new Date()

  // 设置时区
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }

  // 包含昨天、今天、未来3天
  const offsets = [-1, 0, 1, 2, 3]

  for (const offset of offsets) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)

    const dateStr = date
      .toLocaleDateString('zh-CN', options)
      .replace(/\//g, '-')
      .split('-')
      .map(part => part.padStart(2, '0'))
      .join('-')

    dates.push(dateStr)
  }

  return dates
}

/**
 * 获取上传用日期范围（日期对象版）：昨天、今天和未来3天（共5天）
 * @returns 包含5个Date对象的数组
 */
export function getNext7DaysAsDates(): Date[] {
  const dates: Date[] = []
  const today = new Date()
  const offsets = [-1, 0, 1, 2, 3]

  for (const offset of offsets) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    dates.push(date)
  }

  return dates
}

/**
 * 将日期字符串转换为毫秒时间戳（当天00:00:00）
 * @param dateStr 日期字符串，格式为 YYYY-MM-DD
 * @param timezone 时区，默认为 Asia/Shanghai
 * @returns 毫秒时间戳
 */
export function dateStringToTimestamp(dateStr: string): number {
  const date = new Date(`${dateStr} 00:00:00`)
  return date.getTime()
}

/**
 * 将毫秒时间戳转换为日期字符串
 * @param timestamp 毫秒时间戳
 * @param timezone 时区，默认为 Asia/Shanghai
 * @returns 日期字符串，格式为 YYYY-MM-DD
 */
export function timestampToDateString(
  timestamp: number,
  timezone: string = 'Asia/Shanghai'
): string {
  const date = new Date(timestamp)

  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }

  return date
    .toLocaleDateString('zh-CN', options)
    .replace(/\//g, '-')
    .split('-')
    .map(part => part.padStart(2, '0'))
    .join('-')
}

/**
 * 格式化日期为显示格式（如 9-24、9-25）
 * @param dateStr 日期字符串，格式为 YYYY-MM-DD
 * @returns 格式化后的日期字符串
 */
export function formatDateForDisplay(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${parseInt(month)}-${parseInt(day)}`
}

/**
 * 格式化日期为完整显示格式（如 2025-09-24）
 * @param dateStr 日期字符串，格式为 YYYY-MM-DD
 * @returns 格式化后的日期字符串
 */
export function formatDateForFullDisplay(dateStr: string): string {
  return dateStr
}

/**
 * 获取日期范围显示文本
 * @param startDate 开始日期字符串
 * @param endDate 结束日期字符串
 * @returns 日期范围显示文本
 */
export function getDateRangeDisplay(startDate: string, endDate: string): string {
  return `${startDate} ~ ${endDate}`
}

/**
 * 检查日期是否在上传用日期范围内（昨天、今天、未来3天）
 * @param dateStr 日期字符串，格式为 YYYY-MM-DD
 * @param timezone 时区，默认为 Asia/Shanghai
 * @returns 是否在范围内
 */
export function isInNext7Days(dateStr: string, timezone: string = 'Asia/Shanghai'): boolean {
  const next7Days = getNext7Days(timezone)
  return next7Days.includes(dateStr)
}

/**
 * 获取今天的日期字符串
 * @param timezone 时区，默认为 Asia/Shanghai
 * @returns 今天的日期字符串，格式为 YYYY-MM-DD
 */
export function getTodayString(timezone: string = 'Asia/Shanghai'): string {
  const today = new Date()

  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }

  return today
    .toLocaleDateString('zh-CN', options)
    .replace(/\//g, '-')
    .split('-')
    .map(part => part.padStart(2, '0'))
    .join('-')
}
