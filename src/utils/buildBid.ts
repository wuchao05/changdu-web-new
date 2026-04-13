export const BUILD_BID_PATTERN = /^\d+(\.\d+)?$/

export function normalizeBuildBidValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isValidBuildBidValue(value: unknown): boolean {
  const normalizedValue = normalizeBuildBidValue(value)
  return Boolean(normalizedValue) && BUILD_BID_PATTERN.test(normalizedValue)
}

export function parseBuildBidInputValue(value: unknown): number | null {
  const normalizedValue = normalizeBuildBidValue(value)
  if (!normalizedValue || !BUILD_BID_PATTERN.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

export function formatBuildBidInputValue(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }

  return String(value)
}
