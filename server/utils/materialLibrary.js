const MATERIAL_LIBRARY_BASE_URL = 'https://splay-admin.yncctech.com'
const MATERIAL_LIBRARY_TEAM_ID = '500039'
const MATERIAL_LIBRARY_READY_STATUS = 2
const MATERIAL_LIBRARY_QUERY_CONCURRENCY = 6

function normalizeMaterialIdValue(value) {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeMaterialIdValue(item)
      if (normalized) {
        return normalized
      }
    }
    return ''
  }

  if (typeof value === 'object') {
    if ('text' in value) {
      const normalized = normalizeMaterialIdValue(value.text)
      if (normalized) {
        return normalized
      }
    }

    if ('value' in value) {
      const normalized = normalizeMaterialIdValue(value.value)
      if (normalized) {
        return normalized
      }
    }
  }

  return ''
}

export function getDramaMaterialId(drama) {
  return normalizeMaterialIdValue(drama?.fields?.['推送素材ID'])
}

export function isMaterialReadyStatus(status) {
  return Number(status) === MATERIAL_LIBRARY_READY_STATUS
}

function buildBlockedResult(materialId, reason, message, status = null) {
  return {
    materialId,
    status: Number.isFinite(Number(status)) ? Number(status) : null,
    ready: false,
    reason,
    message,
  }
}

export function buildNotRequiredResult(message = '当前渠道无需校验素材入库状态') {
  return {
    materialId: '',
    status: null,
    ready: true,
    reason: 'not_required',
    message,
  }
}

function buildReadyResult(materialId, status) {
  return {
    materialId,
    status: Number(status),
    ready: true,
    reason: 'ready',
    message: '素材已进入巨量视频库',
  }
}

async function parseJsonResponse(response, actionName) {
  const responseText = await response.text()

  let payload
  try {
    payload = JSON.parse(responseText)
  } catch {
    const snippet = responseText.slice(0, 200).replace(/\s+/g, ' ').trim()
    throw new Error(
      `${actionName}返回非JSON响应: HTTP ${response.status} ${response.statusText}，响应片段=${snippet || 'empty'}`
    )
  }

  if (!response.ok) {
    throw new Error(payload?.message || `${actionName}失败: HTTP ${response.status}`)
  }

  return payload
}

export async function queryMaterialLibraryStatus(materialId, xtToken) {
  const normalizedMaterialId = String(materialId || '').trim()
  const normalizedXtToken = String(xtToken || '').trim()

  if (!normalizedMaterialId) {
    return buildBlockedResult('', 'missing_material_id', '缺少推送素材ID')
  }

  if (!normalizedXtToken) {
    return buildBlockedResult(
      normalizedMaterialId,
      'missing_xt_token',
      '当前用户未配置 XT Token，无法校验素材是否已推送到巨量视频库'
    )
  }

  try {
    const requestUrl = new URL('/material/batchMaterialList', MATERIAL_LIBRARY_BASE_URL)
    requestUrl.searchParams.set('team_id', MATERIAL_LIBRARY_TEAM_ID)
    requestUrl.searchParams.set('page', '1')
    requestUrl.searchParams.set('page_size', '20')
    requestUrl.searchParams.set('material_id', normalizedMaterialId)

    const response = await fetch(requestUrl.toString(), {
      method: 'GET',
      headers: {
        token: normalizedXtToken,
      },
    })

    const result = await parseJsonResponse(response, `查询素材 ${normalizedMaterialId} 入库状态`)
    if (result?.code !== 0) {
      if (Number(result?.code) === -100 || String(result?.message || '').includes('请先登录')) {
        return buildBlockedResult(
          normalizedMaterialId,
          'expired_xt_token',
          '当前用户 XT Token 已过期，请先更新当前渠道下的 XT Token'
        )
      }

      throw new Error(result?.message || `查询素材 ${normalizedMaterialId} 入库状态失败`)
    }

    const materialList = Array.isArray(result?.data?.list) ? result.data.list : []
    const matchedMaterial =
      materialList.find(item => String(item?.material_id || '').trim() === normalizedMaterialId) ||
      null

    if (!matchedMaterial) {
      return buildBlockedResult(
        normalizedMaterialId,
        'not_found',
        `素材 ${normalizedMaterialId} 还未推送到巨量视频库`
      )
    }

    const status = Number.isFinite(Number(matchedMaterial.status))
      ? Number(matchedMaterial.status)
      : null

    if (!isMaterialReadyStatus(status)) {
      return buildBlockedResult(
        normalizedMaterialId,
        'not_ready',
        `素材 ${normalizedMaterialId} 还未进入巨量视频库（status=${status ?? '-'}）`,
        status
      )
    }

    return buildReadyResult(normalizedMaterialId, status)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return buildBlockedResult(
      normalizedMaterialId,
      'query_failed',
      `查询素材 ${normalizedMaterialId} 入库状态失败: ${message}`
    )
  }
}

export async function queryDramaMaterialLibraryStatus(drama, xtToken) {
  const materialId = getDramaMaterialId(drama)
  return queryMaterialLibraryStatus(materialId, xtToken)
}

export function buildDramaMaterialLibraryBypassStatus(
  drama,
  message = '当前渠道无需校验素材入库状态'
) {
  return {
    recordId: String(drama?.record_id || '').trim(),
    dramaName: String(drama?.fields?.['剧名']?.[0]?.text || '').trim(),
    ...buildNotRequiredResult(message),
  }
}

export async function queryDramaMaterialLibraryStatuses(dramas, xtToken, options = {}) {
  const dramaList = Array.isArray(dramas) ? dramas : []
  const concurrency = Math.max(1, Number(options.concurrency || MATERIAL_LIBRARY_QUERY_CONCURRENCY))
  const resultItems = new Array(dramaList.length)
  let currentIndex = 0

  async function worker() {
    while (currentIndex < dramaList.length) {
      const targetIndex = currentIndex
      currentIndex += 1

      const drama = dramaList[targetIndex]
      const statusResult = await queryDramaMaterialLibraryStatus(drama, xtToken)
      resultItems[targetIndex] = {
        recordId: String(drama?.record_id || '').trim(),
        dramaName: String(drama?.fields?.['剧名']?.[0]?.text || '').trim(),
        ...statusResult,
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, dramaList.length || 1) }, worker))
  return resultItems
}
