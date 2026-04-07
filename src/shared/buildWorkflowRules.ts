import type { Dayjs } from 'dayjs'

type DramaRecord = {
  record_id?: string
  fields?: Record<string, any>
}

type SkipContext = {
  publishTime: Dayjs
  earliestBuildTime: Dayjs | null
  advanceHours: number
  blockedByForbiddenAdvanceWindow: boolean
  ruleDescription: string
}

export type BuildWorkflowRuleConfig = {
  forbiddenAdvanceStartHour?: string | number
  forbiddenAdvanceEndHour?: string | number
  advanceBuildHours?: string | number
}

// @ts-expect-error 服务端规则文件仍为 JS，这里补一层前端类型包装。
import * as workflowRules from '../../server/utils/buildWorkflowRules.js'

const typedWorkflowRules = workflowRules as {
  WORKFLOW_TIMEZONE: string
  resolveAdvanceHoursConfig: (buildConfig?: BuildWorkflowRuleConfig) => {
    forbiddenAdvanceStartHour: number
    forbiddenAdvanceEndHour: number
    advanceBuildHours: number
  }
  getAdvanceRuleDescription: (buildConfig?: BuildWorkflowRuleConfig) => string
  getDramaPublishTime: (drama: DramaRecord) => Dayjs | null
  getEarliestBuildTime: (drama: DramaRecord, buildConfig?: BuildWorkflowRuleConfig) => Dayjs | null
  canBuildDramaNow: (
    drama: DramaRecord,
    currentTime?: string | number | Date | Dayjs,
    buildConfig?: BuildWorkflowRuleConfig
  ) => boolean
  selectHighestPriorityDrama: <T extends DramaRecord>(
    dramas: T[],
    options?: {
      currentTime?: string | number | Date | Dayjs
      buildConfig?: BuildWorkflowRuleConfig
      onSkip?: (drama: T, context: SkipContext) => void
    }
  ) => T | null
}

export const WORKFLOW_TIMEZONE = typedWorkflowRules.WORKFLOW_TIMEZONE
export const resolveAdvanceHoursConfig = typedWorkflowRules.resolveAdvanceHoursConfig
export const getAdvanceRuleDescription = typedWorkflowRules.getAdvanceRuleDescription
export const getDramaPublishTime = typedWorkflowRules.getDramaPublishTime
export const getEarliestBuildTime = typedWorkflowRules.getEarliestBuildTime
export const canBuildDramaNow = typedWorkflowRules.canBuildDramaNow
export const selectHighestPriorityDrama = typedWorkflowRules.selectHighestPriorityDrama
