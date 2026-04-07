import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

export const WORKFLOW_TIMEZONE = 'Asia/Shanghai'
export const DEFAULT_FORBIDDEN_ADVANCE_START_HOUR = 0
export const DEFAULT_FORBIDDEN_ADVANCE_END_HOUR = 0
export const DEFAULT_ADVANCE_BUILD_HOURS = 0

function normalizeCurrentTime(currentTime) {
  if (!currentTime) {
    return dayjs().tz(WORKFLOW_TIMEZONE)
  }
  return dayjs.isDayjs(currentTime)
    ? currentTime.tz(WORKFLOW_TIMEZONE)
    : dayjs(currentTime).tz(WORKFLOW_TIMEZONE)
}

function normalizeAdvanceHoursValue(value, fallback = 0) {
  const normalizedValue = Number(value)
  if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
    return fallback
  }
  return normalizedValue
}

function normalizeHourValue(value, fallback = 0) {
  const normalizedValue = Number(value)
  if (!Number.isFinite(normalizedValue)) {
    return fallback
  }

  const truncatedValue = Math.trunc(normalizedValue)
  if (truncatedValue < 0) {
    return 0
  }
  if (truncatedValue > 24) {
    return 24
  }
  return truncatedValue
}

export function resolveAdvanceHoursConfig(buildConfig = {}) {
  return {
    forbiddenAdvanceStartHour: normalizeHourValue(
      buildConfig?.forbiddenAdvanceStartHour,
      DEFAULT_FORBIDDEN_ADVANCE_START_HOUR
    ),
    forbiddenAdvanceEndHour: normalizeHourValue(
      buildConfig?.forbiddenAdvanceEndHour,
      DEFAULT_FORBIDDEN_ADVANCE_END_HOUR
    ),
    advanceBuildHours: normalizeAdvanceHoursValue(
      buildConfig?.advanceBuildHours,
      DEFAULT_ADVANCE_BUILD_HOURS
    ),
  }
}

export function hasForbiddenAdvanceWindow(buildConfig = {}) {
  const config = resolveAdvanceHoursConfig(buildConfig)
  return config.forbiddenAdvanceStartHour !== config.forbiddenAdvanceEndHour
}

export function formatHourLabel(hour) {
  return `${String(normalizeHourValue(hour)).padStart(2, '0')}:00`
}

export function formatForbiddenAdvanceWindow(buildConfig = {}) {
  const config = resolveAdvanceHoursConfig(buildConfig)
  return `${formatHourLabel(config.forbiddenAdvanceStartHour)}-${formatHourLabel(config.forbiddenAdvanceEndHour)}`
}

export function getAdvanceRuleDescription(buildConfig = {}) {
  const config = resolveAdvanceHoursConfig(buildConfig)
  const advanceText =
    config.advanceBuildHours > 0
      ? `其余时间可提前 ${config.advanceBuildHours} 小时搭建`
      : '其余时间也必须等上架时间后才能搭建'

  if (!hasForbiddenAdvanceWindow(config)) {
    return advanceText
  }

  return `上架时间命中 ${formatForbiddenAdvanceWindow(config)} 时禁止提前搭建，${advanceText}`
}

/**
 * 获取剧集上架时间
 * @param {{ fields?: Record<string, any> }} drama 飞书剧集记录
 * @returns {import('dayjs').Dayjs | null}
 */
export function getDramaPublishTime(drama) {
  const timestamp = drama?.fields?.['上架时间']?.value?.[0]
  if (!timestamp) return null
  return dayjs(timestamp).tz(WORKFLOW_TIMEZONE)
}

/**
 * 获取飞书日期字段值，日期越大说明剧越新
 * @param {{ fields?: Record<string, any> }} drama 飞书剧集记录
 * @returns {number}
 */
export function getDramaDateValue(drama) {
  return typeof drama?.fields?.['日期'] === 'number' ? drama.fields['日期'] : 0
}

/**
 * 获取评级
 * @param {{ fields?: Record<string, any> }} drama 飞书剧集记录
 * @returns {string}
 */
export function getDramaRating(drama) {
  const ratingField = drama?.fields?.['评级']
  if (ratingField && typeof ratingField === 'object' && 'value' in ratingField) {
    if (Array.isArray(ratingField.value) && ratingField.value[0]) {
      return ratingField.value[0]
    }
  }
  if (Array.isArray(ratingField) && ratingField[0]?.text) {
    return ratingField[0].text
  }
  if (typeof ratingField === 'string') {
    return ratingField
  }
  return '绿标'
}

/**
 * 根据上架时间计算可提前搭建小时数
 * @param {import('dayjs').Dayjs} publishTime 上架时间
 * @returns {number}
 */
export function getAdvanceHours(publishTime, buildConfig = {}) {
  const advanceHoursConfig = resolveAdvanceHoursConfig(buildConfig)
  if (isPublishTimeInForbiddenAdvanceWindow(publishTime, advanceHoursConfig)) {
    return 0
  }

  return advanceHoursConfig.advanceBuildHours
}

export function isPublishTimeInForbiddenAdvanceWindow(publishTime, buildConfig = {}) {
  const config = resolveAdvanceHoursConfig(buildConfig)
  const startHour = config.forbiddenAdvanceStartHour
  const endHour = config.forbiddenAdvanceEndHour

  if (startHour === endHour) {
    return false
  }

  const publishHour = publishTime.hour()
  if (startHour < endHour) {
    return publishHour >= startHour && publishHour < endHour
  }

  return publishHour >= startHour || publishHour < endHour
}

/**
 * 获取最早可搭建时间
 * @param {{ fields?: Record<string, any> }} drama 飞书剧集记录
 * @returns {import('dayjs').Dayjs | null}
 */
export function getEarliestBuildTime(drama, buildConfig = {}) {
  const publishTime = getDramaPublishTime(drama)
  if (!publishTime) return null
  return publishTime.subtract(getAdvanceHours(publishTime, buildConfig), 'hour')
}

/**
 * 判断当前是否可搭建
 * @param {{ fields?: Record<string, any> }} drama 飞书剧集记录
 * @param {string | number | Date | import('dayjs').Dayjs} [currentTime] 当前时间
 * @returns {boolean}
 */
export function canBuildDramaNow(drama, currentTime, buildConfig = {}) {
  const earliestBuildTime = getEarliestBuildTime(drama, buildConfig)
  if (!earliestBuildTime) return false
  const now = normalizeCurrentTime(currentTime)
  return now.isAfter(earliestBuildTime) || now.isSame(earliestBuildTime)
}

function sortRedDramas(dramas) {
  return [...dramas].sort((a, b) => {
    const aPublishTime = getDramaPublishTime(a)
    const bPublishTime = getDramaPublishTime(b)
    if (aPublishTime && bPublishTime && aPublishTime.valueOf() !== bPublishTime.valueOf()) {
      return bPublishTime.valueOf() - aPublishTime.valueOf()
    }

    const aDateValue = getDramaDateValue(a)
    const bDateValue = getDramaDateValue(b)
    if (aDateValue !== bDateValue) {
      return aDateValue - bDateValue
    }

    return 0
  })
}

function sortNonRedDramas(dramas) {
  const ratingPriority = { 绿标: 0, 黄标: 1 }

  return [...dramas].sort((a, b) => {
    const aDateValue = getDramaDateValue(a)
    const bDateValue = getDramaDateValue(b)
    if (aDateValue !== bDateValue) {
      return aDateValue - bDateValue
    }

    const aPriority = ratingPriority[getDramaRating(a)] ?? 2
    const bPriority = ratingPriority[getDramaRating(b)] ?? 2
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    const aPublishTime = getDramaPublishTime(a)
    const bPublishTime = getDramaPublishTime(b)
    if (!aPublishTime || !bPublishTime) {
      return 0
    }

    return bPublishTime.valueOf() - aPublishTime.valueOf()
  })
}

function selectDramaWithinPriorityGroup(dramas) {
  if (dramas.length === 0) {
    return null
  }

  const redDramas = dramas.filter(drama => getDramaRating(drama) === '红标')
  if (redDramas.length > 0) {
    return sortRedDramas(redDramas)[0]
  }

  return sortNonRedDramas(dramas)[0] || null
}

/**
 * 选择最高优先级剧集
 * @param {Array<{ fields?: Record<string, any> }>} dramas 飞书剧集记录数组
 * @param {{ currentTime?: string | number | Date | import('dayjs').Dayjs, onSkip?: (drama: any, context: { publishTime: import('dayjs').Dayjs, earliestBuildTime: import('dayjs').Dayjs | null, advanceHours: number, blockedByForbiddenAdvanceWindow: boolean, ruleDescription: string }) => void }} [options]
 * @returns {any | null}
 */
export function selectHighestPriorityDrama(dramas, options = {}) {
  const now = normalizeCurrentTime(options.currentTime)
  const buildableDramas = dramas.filter(drama => {
    const publishTime = getDramaPublishTime(drama)
    if (!publishTime) return false

    if (!canBuildDramaNow(drama, now, options.buildConfig)) {
      const advanceHours = getAdvanceHours(publishTime, options.buildConfig)
      const earliestBuildTime = getEarliestBuildTime(drama, options.buildConfig)
      const blockedByForbiddenAdvanceWindow = isPublishTimeInForbiddenAdvanceWindow(
        publishTime,
        options.buildConfig
      )
      options.onSkip?.(drama, {
        publishTime,
        earliestBuildTime,
        advanceHours,
        blockedByForbiddenAdvanceWindow,
        ruleDescription: getAdvanceRuleDescription(options.buildConfig),
      })
      return false
    }

    return true
  })

  if (buildableDramas.length === 0) {
    return null
  }

  const urgentForbiddenWindowDramas = buildableDramas.filter(drama => {
    const publishTime = getDramaPublishTime(drama)
    return publishTime
      ? isPublishTimeInForbiddenAdvanceWindow(publishTime, options.buildConfig)
      : false
  })

  if (urgentForbiddenWindowDramas.length > 0) {
    return selectDramaWithinPriorityGroup(urgentForbiddenWindowDramas)
  }

  return selectDramaWithinPriorityGroup(buildableDramas)
}
