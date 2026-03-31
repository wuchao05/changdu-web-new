function getLogPrefix(logPrefix = '') {
  return logPrefix ? `${logPrefix} ` : ''
}

async function parseProjectApiResponse(response, actionName) {
  const responseText = await response.text()
  const contentType = response.headers.get('content-type') || 'unknown'

  let result
  try {
    result = JSON.parse(responseText)
  } catch {
    const snippet = responseText.slice(0, 200).replace(/\s+/g, ' ').trim()
    throw new Error(
      `${actionName}返回非JSON响应: HTTP ${response.status} ${response.statusText}, Content-Type=${contentType}, URL=${response.url}, 响应片段=${snippet || 'empty'}`
    )
  }

  if (!response.ok) {
    const message =
      result?.message ||
      result?.msg ||
      result?.error ||
      `HTTP ${response.status} ${response.statusText}`
    throw new Error(
      `${actionName}请求失败: ${message}, HTTP ${response.status}, URL=${response.url}`
    )
  }

  return result
}

function chunkArray(items, chunkSize) {
  const chunks = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

export function formatProjectCleanupDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function createProjectListRequestBody(page, dateString) {
  return {
    project_status: [-1],
    search_type: '8',
    promotion_status: [-1],
    st: dateString,
    et: dateString,
    campaign_type: [1],
    page,
    limit: 30,
    fields: [
      'stat_cost',
      'show_cnt',
      'cpm_platform',
      'click_cnt',
      'ctr',
      'cpc_platform',
      'convert_cnt',
      'conversion_rate',
      'conversion_cost',
    ],
    cascade_fields: ['support_cost_rate_7d', 'budget_optimize_switch'],
    sort_stat: 'create_time',
    sort_order: 1,
    need_trans_toLocal: true,
    isSophonx: 1,
  }
}

export async function clearExistingProjects({
  accountId,
  cookie,
  logPrefix = '',
  date = new Date(),
}) {
  const prefix = getLogPrefix(logPrefix)
  const dateString = formatProjectCleanupDate(date)
  const projectIds = []
  let page = 1
  let totalPages = 1

  console.log(`${prefix}开始清理历史项目，账户=${accountId}，日期=${dateString}`)

  while (page <= totalPages) {
    const listResponse = await fetch(
      `https://ad.oceanengine.com/ad/api/promotion/projects/list?aadvid=${accountId}`,
      {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createProjectListRequestBody(page, dateString)),
      }
    )

    const listResult = await parseProjectApiResponse(listResponse, '查询项目列表')
    if (listResult.code !== 0) {
      throw new Error(listResult.msg || listResult.message || '查询项目列表失败')
    }

    const projects = Array.isArray(listResult.data?.projects) ? listResult.data.projects : []
    projectIds.push(
      ...projects
        .map(project => String(project?.project_id || '').trim())
        .filter(projectId => projectId.length > 0)
    )

    totalPages = Math.max(1, Number(listResult.data?.pagination?.total_page || 1))
    page += 1
  }

  const uniqueProjectIds = [...new Set(projectIds)]
  if (uniqueProjectIds.length === 0) {
    console.log(`${prefix}未查询到可删除的历史项目`)
    return {
      date: dateString,
      queriedCount: 0,
      deletedCount: 0,
      projectIds: [],
    }
  }

  console.log(`${prefix}查询到 ${uniqueProjectIds.length} 个历史项目，开始删除`)
  const projectIdChunks = chunkArray(uniqueProjectIds, 20)

  for (const projectIdChunk of projectIdChunks) {
    const deleteResponse = await fetch(
      `https://ad.oceanengine.com/ad/api/promotion/projects/delete?aadvid=${accountId}`,
      {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ProjectIds: projectIdChunk,
          ForceAsync: false,
        }),
      }
    )

    const deleteResult = await parseProjectApiResponse(deleteResponse, '删除项目')
    if (deleteResult.code !== 0) {
      throw new Error(deleteResult.msg || deleteResult.message || '删除项目失败')
    }
  }

  console.log(`${prefix}历史项目删除完成，共删除 ${uniqueProjectIds.length} 个项目`)
  return {
    date: dateString,
    queriedCount: uniqueProjectIds.length,
    deletedCount: uniqueProjectIds.length,
    projectIds: uniqueProjectIds,
  }
}
