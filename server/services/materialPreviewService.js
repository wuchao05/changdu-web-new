import axios from 'axios'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { FEISHU_CONFIG } from '../config/feishu.js'

dayjs.extend(customParseFormat)

const FEISHU_TOKEN_API_URL = `${FEISHU_CONFIG.api_base_url}${FEISHU_CONFIG.token_endpoint}`
const DEFAULT_FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis/bitable/v1'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const DEFAULT_LOG_PREFIX = '[素材预览-未知用户-默认渠道]'

function resolveLogPrefix(logPrefix = '') {
  return String(logPrefix || '').trim() || DEFAULT_LOG_PREFIX
}

async function withRetry(runner, label, retries = 3, delayMs = 600, logPrefix = '') {
  let lastError

  for (let index = 0; index < retries; index += 1) {
    try {
      return await runner()
    } catch (error) {
      lastError = error
      console.warn(
        `${resolveLogPrefix(logPrefix)} ${label} 失败重试 ${index + 1}/${retries}:`,
        error?.response?.status || error?.message || error
      )
      await sleep(delayMs * (index + 1))
    }
  }

  throw lastError
}

function createClient(cookie) {
  return axios.create({
    baseURL: 'https://ad.oceanengine.com',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      Cookie: cookie,
    },
    timeout: 20000,
  })
}

async function fetchAllAds(client, aadvid, logPrefix = '') {
  const all = []
  let page = 1

  while (true) {
    const response = await withRetry(
      () =>
        client.post(
          '/ad/api/promotion/ads/list',
          {
            sort_stat: 'create_time',
            project_status: [-1],
            promotion_status: [-1],
            limit: 10,
            page,
            sort_order: 1,
            campaign_type: [1],
          },
          {
            params: { aadvid },
          }
        ),
      `fetchAds(page=${page})`,
      3,
      600,
      logPrefix
    )

    if (response.data.code !== 0) {
      throw new Error(`fetch ads code=${response.data.code}, msg=${response.data.msg}`)
    }

    const ads = response.data.data?.ads ?? []
    all.push(...ads)

    const pagination = response.data.data?.pagination
    if (!pagination || page >= (pagination.total_page || 1)) {
      break
    }
    page += 1
  }

  return all
}

function filterAndDedupAds(ads, dramaName, awemeWhiteList = []) {
  const filteredAds = ads.filter(ad => dramaName && ad.promotion_name?.includes(dramaName))

  const pickAwemeFromTitle = title => {
    if (!title || !awemeWhiteList.length) {
      return null
    }

    const hits = awemeWhiteList.filter(name => title.includes(name))
    if (!hits.length) {
      return null
    }

    return hits.sort((left, right) => right.length - left.length)[0] ?? null
  }

  const getCreateTs = ad => {
    const timestamp = dayjs(ad.create_time ?? '', 'YYYY-MM-DD HH:mm:ss', true).valueOf()
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  const grouped = filteredAds
    .map(ad => {
      const aweme = pickAwemeFromTitle(ad.promotion_name)
      return aweme ? { aweme, ad } : null
    })
    .filter(Boolean)

  const bestByAweme = new Map()
  for (const { aweme, ad } of grouped) {
    const previous = bestByAweme.get(aweme)
    if (!previous) {
      bestByAweme.set(aweme, ad)
      continue
    }

    const currentTs = getCreateTs(ad)
    const previousTs = getCreateTs(previous)
    if (currentTs > previousTs || (currentTs === previousTs && ad.promotion_id > previous.promotion_id)) {
      bestByAweme.set(aweme, ad)
    }
  }

  return [...bestByAweme.values()].sort((left, right) => getCreateTs(right) - getCreateTs(left))
}

function chunk(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function runConcurrent(items, limit, runner) {
  const groups = chunk(items, limit)
  for (const [groupIndex, group] of groups.entries()) {
    await Promise.all(group.map(item => runner(item, groupIndex)))
  }
}

async function fetchMaterialsByPromotions(client, aadvid, promotionIds, concurrency = 3, logPrefix = '') {
  const results = []
  const groups = chunk(promotionIds, 50)

  await runConcurrent(groups, concurrency, async (ids, chunkIndex) => {
    let page = 1

    while (true) {
      const response = await withRetry(
        () =>
          client.post(
            '/ad/api/promotion/materials/list',
            {
              promotion_ids: ids,
              page,
              limit: 50,
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
                'deep_convert_cnt',
                'deep_convert_cost',
                'deep_convert_rate',
              ],
              sort_stat: 'create_time',
              sort_order: 1,
              delivery_package: [],
              delivery_mode: [3],
              delivery_mode_internal: [3],
              quick_delivery: [],
              isAigc: false,
              isAutoStar: false,
            },
            {
              params: { aadvid },
            }
          ),
        `fetchMaterials(chunk=${chunkIndex}, page=${page})`,
        3,
        600,
        logPrefix
      )

      if (response.data.code !== 0) {
        throw new Error(`fetch materials code=${response.data.code}, msg=${response.data.msg}`)
      }

      const materials = response.data.data?.materials ?? []
      results.push(...materials)

      const pagination = response.data.data?.pagination
      if (!pagination || page >= (pagination.total_page || 1)) {
        break
      }
      page += 1
    }
  })

  return results
}

const ensureStatusArray = value => (Array.isArray(value) ? value : [])
const isPendingMaterial = material => material.material_status_first_name === '未投放'
const isDeliveringMaterial = material => material.material_status_first_name === '投放中'

function isOnlyBalanceInsufficient(material) {
  const secondNames = ensureStatusArray(material.material_status_second_name)
  return secondNames.length === 1 && secondNames[0] === '账户余额不足'
}

function containsRejectStatus(material) {
  return ensureStatusArray(material.material_status_second_name).includes('审核不通过')
}

function isPendingPreviewMaterial(material) {
  return (
    isPendingMaterial(material) &&
    isOnlyBalanceInsufficient(material) &&
    (material.material_reject_reason_type ?? 0) === 0
  )
}

function isPendingDeleteMaterial(material) {
  return (
    isPendingMaterial(material) &&
    ((isOnlyBalanceInsufficient(material) &&
      (material.material_reject_reason_type ?? 0) === 1) ||
      (containsRejectStatus(material) && (material.material_reject_reason_type ?? 0) === 1))
  )
}

function isDeliveringPreviewMaterial(material) {
  return (
    isDeliveringMaterial(material) &&
    ensureStatusArray(material.material_status_second_name).length === 0 &&
    (material.material_reject_reason_type ?? 0) === 0
  )
}

function isDeliveringDeleteMaterial(material) {
  return isDeliveringMaterial(material) && (material.material_reject_reason_type ?? 0) === 1
}

function classifyMaterialsByType(materials) {
  return {
    needPreview: materials.filter(
      material => isPendingPreviewMaterial(material) || isDeliveringPreviewMaterial(material)
    ),
    needDelete: materials.filter(
      material => isPendingDeleteMaterial(material) || isDeliveringDeleteMaterial(material)
    ),
  }
}

function groupBy(items, keyFn) {
  return items.reduce((accumulator, item) => {
    const key = keyFn(item)
    ;(accumulator[key] ||= []).push(item)
    return accumulator
  }, {})
}

function promotionsToDeleteByType(materials) {
  const grouped = groupBy(materials, material => material.promotion_id)
  const promotionIds = []

  for (const [promotionId, items] of Object.entries(grouped)) {
    const deliveringMaterials = items.filter(isDeliveringMaterial)
    const pendingMaterials = items.filter(isPendingMaterial)
    const hasOtherType = items.some(item => !isDeliveringMaterial(item) && !isPendingMaterial(item))
    const hasPreviewMaterial = items.some(
      item => isPendingPreviewMaterial(item) || isDeliveringPreviewMaterial(item)
    )

    const deliveringCanDelete =
      deliveringMaterials.length === 0 ||
      (!deliveringMaterials.some(isDeliveringPreviewMaterial) &&
        !deliveringMaterials.some(item =>
          ensureStatusArray(item.material_status_second_name).includes('新建审核中')
        ))

    const pendingCanDelete =
      pendingMaterials.length === 0 ||
      (!pendingMaterials.some(isPendingPreviewMaterial) &&
        pendingMaterials.every(isPendingDeleteMaterial))

    if (!hasOtherType && !hasPreviewMaterial && deliveringCanDelete && pendingCanDelete) {
      promotionIds.push(promotionId)
    }
  }

  return promotionIds
}

async function previewOne(client, aadvid, materialId, promotionId, logPrefix = '') {
  const response = await withRetry(
    () =>
      client.get('/ad/api/agw/ad/preview_url', {
        params: {
          IdType: 'ID_TYPE_MATERIAL',
          MaterialId: materialId,
          PromotionId: promotionId,
          aadvid,
        },
        headers: { 'Accept-Encoding': 'gzip, deflate, br' },
      }),
    `preview(material=${materialId})`,
    3,
    600,
    logPrefix
  )

  if ((response.data?.code ?? 0) !== 0) {
    throw new Error(`preview failed code=${response.data?.code}`)
  }

  return response.data
}

async function deleteMaterialsBatch(client, aadvid, promotionId, cdpIds, logPrefix = '') {
  const response = await withRetry(
    () =>
      client.post(
        '/superior/api/promote/materials/del',
        { ids: cdpIds, promotion_id: promotionId },
        {
          params: { aadvid },
        }
      ),
    `deleteMaterials(promotion=${promotionId}, count=${cdpIds.length})`,
    3,
    600,
    logPrefix
  )

  if ((response.data?.code ?? 0) !== 0) {
    throw new Error(`delete materials failed code=${response.data?.code}`)
  }

  return response.data
}

async function deletePromotion(client, aadvid, promotionId, logPrefix = '') {
  const response = await withRetry(
    () =>
      client.post(
        '/ad/api/promotion/ads/delete',
        { ids: [promotionId] },
        {
          params: { aadvid },
        }
      ),
    `deletePromotion(${promotionId})`,
    3,
    600,
    logPrefix
  )

  if ((response.data?.code ?? 0) !== 0) {
    throw new Error(`delete promotion failed code=${response.data?.code}`)
  }

  return response.data
}

async function fetchFeishuToken(appId, appSecret) {
  const response = await axios.post(
    FEISHU_TOKEN_API_URL,
    {
      app_id: appId,
      app_secret: appSecret,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
    }
  )

  if (response.data?.code !== 0) {
    throw new Error(`获取飞书 token 失败: ${response.data?.msg || 'unknown error'}`)
  }

  return response.data.tenant_access_token
}

async function fetchFeishuRecords(url, token, payload) {
  const allRecords = []
  let pageToken

  do {
    const requestPayload = {
      ...payload,
      ...(pageToken ? { page_token: pageToken } : {}),
    }

    const response = await axios.post(url, requestPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    })

    if (response.data?.code !== 0) {
      throw new Error(`飞书 API 请求失败: ${response.data?.msg || 'unknown error'}`)
    }

    const items = response.data?.data?.items || []
    allRecords.push(...items)
    pageToken = response.data?.data?.has_more ? response.data.data.page_token : undefined
  } while (pageToken)

  return allRecords
}

function buildFeishuConfig(feishu = {}) {
  return {
    appId: feishu.appId || FEISHU_CONFIG.app_id,
    appSecret: feishu.appSecret || FEISHU_CONFIG.app_secret,
    appToken: feishu.appToken || FEISHU_CONFIG.app_token,
    tableId: feishu.tableId || FEISHU_CONFIG.table_ids.drama_status,
    baseUrl: (feishu.baseUrl || DEFAULT_FEISHU_BASE_URL).replace(/\/$/, ''),
  }
}

function normalizeFieldText(fieldValue) {
  if (typeof fieldValue === 'string') {
    return fieldValue.trim()
  }

  if (Array.isArray(fieldValue) && fieldValue[0]?.text) {
    return String(fieldValue[0].text || '').trim()
  }

  return ''
}

function formatBeijingDateTime(timestamp) {
  const date = new Date(Number(timestamp))
  if (Number.isNaN(date.getTime())) {
    return String(timestamp || '')
  }

  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = beijingDate.getUTCFullYear()
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingDate.getUTCDate()).padStart(2, '0')
  const hours = String(beijingDate.getUTCHours()).padStart(2, '0')
  const minutes = String(beijingDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(beijingDate.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function resolveBuildTimeWindow(timeWindowStartMinutes, timeWindowEndMinutes) {
  const now = Date.now()
  const timeWindowStart = now - timeWindowStartMinutes * 60 * 1000
  const timeWindowEnd = now - timeWindowEndMinutes * 60 * 1000

  return {
    startMinutes: timeWindowStartMinutes,
    endMinutes: timeWindowEndMinutes,
    startTimestamp: timeWindowStart,
    endTimestamp: timeWindowEnd,
    startText: formatBeijingDateTime(timeWindowStart),
    endText: formatBeijingDateTime(timeWindowEnd),
  }
}

async function fetchAccountsFromFeishu(feishuConfig, timeWindowStartMinutes, timeWindowEndMinutes, awemeWhiteList, cookie) {
  const apiUrl = `${feishuConfig.baseUrl}/apps/${feishuConfig.appToken}/tables/${feishuConfig.tableId}/records/search`
  const accessToken = await fetchFeishuToken(feishuConfig.appId, feishuConfig.appSecret)

  const basePayload = {
    field_names: ['剧名', '账户', '日期', '当前状态', '搭建时间'],
    page_size: 100,
    filter: {
      conjunction: 'and',
      conditions: [
        {
          field_name: '当前状态',
          operator: 'is',
          value: ['已完成'],
        },
      ],
    },
  }

  const [todayRecords, yesterdayRecords] = await Promise.all([
    fetchFeishuRecords(apiUrl, accessToken, {
      ...basePayload,
      filter: {
        ...basePayload.filter,
        conditions: [
          ...basePayload.filter.conditions,
          {
            field_name: '日期',
            operator: 'is',
            value: ['Today'],
          },
        ],
      },
    }),
    fetchFeishuRecords(apiUrl, accessToken, {
      ...basePayload,
      filter: {
        ...basePayload.filter,
        conditions: [
          ...basePayload.filter.conditions,
          {
            field_name: '日期',
            operator: 'is',
            value: ['Yesterday'],
          },
        ],
      },
    }),
  ])

  const buildTimeWindow = resolveBuildTimeWindow(timeWindowStartMinutes, timeWindowEndMinutes)
  const accountMap = new Map()

  for (const record of [...todayRecords, ...yesterdayRecords]) {
    const dramaName = normalizeFieldText(record.fields?.剧名)
    const accountId = normalizeFieldText(record.fields?.账户)
    const buildTime = record.fields?.搭建时间

    if (
      !buildTime ||
      buildTime < buildTimeWindow.startTimestamp ||
      buildTime > buildTimeWindow.endTimestamp
    ) {
      continue
    }

    if (dramaName && accountId && !accountMap.has(accountId)) {
      accountMap.set(accountId, {
        aadvid: accountId,
        drama_name: dramaName,
        cookie: cookie || '',
        aweme_white_list: awemeWhiteList,
      })
    }
  }

  return {
    accounts: [...accountMap.values()],
    buildTimeWindow,
  }
}

function resolveAccountCookie(account, fallbackCookie = '') {
  const directCookie = String(account.cookie || '').trim()
  if (directCookie) {
    return directCookie
  }

  const sharedCookie = String(fallbackCookie || '').trim()
  if (sharedCookie) {
    return sharedCookie
  }

  throw new Error(`账户 ${account.aadvid} 缺少可用的 cookie`)
}

export class MaterialPreviewService {
  async analyzeAccount(config) {
    const client = createClient(config.cookie)
    const adsAll = await fetchAllAds(client, config.aadvid, config.logPrefix)
    const adsFiltered = filterAndDedupAds(adsAll, config.drama_name, config.aweme_white_list)

    if (!adsFiltered.length) {
      return {
        needPreview: [],
        needDelete: [],
        canDeletePromotions: [],
        totalAds: adsAll.length,
        filteredAds: 0,
      }
    }

    const promotionIds = adsFiltered.map(ad => ad.promotion_id)
    const materials = await fetchMaterialsByPromotions(
      client,
      config.aadvid,
      promotionIds,
      3,
      config.logPrefix
    )
    const classified = classifyMaterialsByType(materials)
    const canDeletePromotions = promotionsToDeleteByType(materials)
    const canDeletePromotionSet = new Set(canDeletePromotions)

    return {
      needPreview: classified.needPreview.filter(
        material => !canDeletePromotionSet.has(material.promotion_id)
      ),
      needDelete: classified.needDelete.filter(
        material => !canDeletePromotionSet.has(material.promotion_id)
      ),
      canDeletePromotions,
      totalAds: adsAll.length,
      filteredAds: adsFiltered.length,
    }
  }

  async executePreview(config, materials, delayMs = 400) {
    const client = createClient(config.cookie)
    let success = 0
    let failed = 0

    for (const material of materials) {
      try {
        await previewOne(
          client,
          config.aadvid,
          material.material_id,
          material.promotion_id,
          config.logPrefix
        )
        success += 1
      } catch (error) {
        failed += 1
        console.error(
          `${resolveLogPrefix(config.logPrefix)} 预览失败 material=${material.material_id} promotion=${material.promotion_id}:`,
          error?.response?.status || error?.message || error
        )
      }
      await sleep(delayMs)
    }

    return { success, failed }
  }

  async stopPreview(config, materials) {
    const client = createClient(config.cookie)
    let success = 0
    let failed = 0
    const groups = groupBy(
      materials.filter(material => Boolean(material.cdp_material_id)),
      material => material.promotion_id
    )

    for (const [promotionId, items] of Object.entries(groups)) {
      const materialIds = items.map(item => item.cdp_material_id).filter(Boolean)
      if (!materialIds.length) {
        continue
      }

      try {
        await deleteMaterialsBatch(client, config.aadvid, promotionId, materialIds, config.logPrefix)
        success += 1
      } catch (error) {
        failed += 1
        console.error(
          `${resolveLogPrefix(config.logPrefix)} 删除素材失败 promotion=${promotionId}:`,
          error?.response?.status || error?.message || error
        )
      }
      await sleep(300)
    }

    return { success, failed }
  }

  async deletePromotions(config, promotionIds) {
    const client = createClient(config.cookie)
    let success = 0
    let failed = 0

    for (const promotionId of promotionIds) {
      try {
        await deletePromotion(client, config.aadvid, promotionId, config.logPrefix)
        success += 1
      } catch (error) {
        failed += 1
        console.error(
          `${resolveLogPrefix(config.logPrefix)} 删除广告失败 promotion=${promotionId}:`,
          error?.response?.status || error?.message || error
        )
      }
      await sleep(300)
    }

    return { success, failed }
  }

  async batchProcess(batchConfig) {
    const results = []
    let success = 0
    let failed = 0

    console.log(
      `${resolveLogPrefix(batchConfig.logPrefix)} 开始处理账户批次，共 ${batchConfig.accounts.length} 个账户，dryRun=${Boolean(batchConfig.dryRun)}`
    )

    for (const account of batchConfig.accounts) {
      try {
        const cookie = resolveAccountCookie(account, batchConfig.cookie)
        const config = {
          ...account,
          cookie,
          logPrefix: batchConfig.logPrefix,
        }

        const analysis = await this.analyzeAccount(config)
        console.log(
          `${resolveLogPrefix(batchConfig.logPrefix)} 账户分析结果 aadvid=${account.aadvid} drama=${account.drama_name}: filteredAds=${analysis.filteredAds}, needPreview=${analysis.needPreview.length}, needDelete=${analysis.needDelete.length}, canDeletePromotions=${analysis.canDeletePromotions.length}`
        )
        if (analysis.filteredAds === 0) {
          results.push({
            aadvid: account.aadvid,
            drama_name: account.drama_name,
            status: 'skipped',
            needPreviewCount: 0,
            needDeleteCount: 0,
            canDeletePromotionsCount: 0,
          })
          console.log(
            `${resolveLogPrefix(batchConfig.logPrefix)} 跳过账户 aadvid=${account.aadvid} drama=${account.drama_name}: 没有命中过滤后的广告`
          )
          continue
        }

        if (batchConfig.dryRun) {
          results.push({
            aadvid: account.aadvid,
            drama_name: account.drama_name,
            status: 'success',
            needPreviewCount: analysis.needPreview.length,
            needDeleteCount: analysis.needDelete.length,
            canDeletePromotionsCount: analysis.canDeletePromotions.length,
          })
          success += 1
          continue
        }

        if (analysis.needPreview.length > 0) {
          await this.executePreview(config, analysis.needPreview, batchConfig.previewDelayMs || 400)
        }

        if (analysis.needDelete.length > 0) {
          await this.stopPreview(config, analysis.needDelete)
        }

        if (analysis.canDeletePromotions.length > 0) {
          await this.deletePromotions(config, analysis.canDeletePromotions)
        }

        results.push({
          aadvid: account.aadvid,
          drama_name: account.drama_name,
          status: 'success',
          needPreviewCount: analysis.needPreview.length,
          needDeleteCount: analysis.needDelete.length,
          canDeletePromotionsCount: analysis.canDeletePromotions.length,
        })
        success += 1
        console.log(
          `${resolveLogPrefix(batchConfig.logPrefix)} 账户处理完成 aadvid=${account.aadvid} drama=${account.drama_name}: preview=${analysis.needPreview.length}, delete=${analysis.needDelete.length}, deletePromotions=${analysis.canDeletePromotions.length}`
        )
      } catch (error) {
        results.push({
          aadvid: account.aadvid,
          drama_name: account.drama_name,
          status: 'failed',
          needPreviewCount: 0,
          needDeleteCount: 0,
          canDeletePromotionsCount: 0,
          error: error?.message || String(error),
        })
        failed += 1
        console.error(
          `${resolveLogPrefix(batchConfig.logPrefix)} 账户处理失败 aadvid=${account.aadvid} drama=${account.drama_name}:`,
          error?.message || error
        )
      }
    }

    console.log(
      `${resolveLogPrefix(batchConfig.logPrefix)} 账户批次处理完成: total=${batchConfig.accounts.length}, success=${success}, failed=${failed}`
    )

    return {
      total: batchConfig.accounts.length,
      success,
      failed,
      results,
    }
  }

  async batchProcessFromFeishu(config) {
    const feishuConfig = buildFeishuConfig(config.feishu)
    const { accounts, buildTimeWindow } = await fetchAccountsFromFeishu(
      feishuConfig,
      config.buildTimeFilterWindowStartMinutes || 90,
      config.buildTimeFilterWindowEndMinutes || 20,
      config.aweme_white_list,
      config.cookie
    )

    console.log(
      `${resolveLogPrefix(config.logPrefix)} 飞书筛选范围: 当前状态=已完成, 搭建时间=${buildTimeWindow.startText} ~ ${buildTimeWindow.endText}（${buildTimeWindow.startMinutes}-${buildTimeWindow.endMinutes} 分钟前）`
    )

    console.log(
      `${resolveLogPrefix(config.logPrefix)} 飞书筛选完成: tableId=${feishuConfig.tableId}, accounts=${accounts.length}, buildTimeRange=${buildTimeWindow.startText} ~ ${buildTimeWindow.endText}, awemeWhiteList=${Array.isArray(config.aweme_white_list) ? config.aweme_white_list.join(',') : ''}`
    )

    if (!accounts.length) {
      console.log(`${resolveLogPrefix(config.logPrefix)} 本轮没有命中需要预览的账户`)
      return {
        total: 0,
        success: 0,
        failed: 0,
        results: [],
      }
    }

    return this.batchProcess({
      accounts,
      dryRun: config.dryRun,
      previewDelayMs: config.previewDelayMs || 400,
      cookie: config.cookie,
      logPrefix: config.logPrefix,
    })
  }
}
