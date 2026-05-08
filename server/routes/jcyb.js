import Router from '@koa/router'
import fs from 'fs/promises'
import path from 'path'
import { ensureStudioData, getStudioDataDir } from '../utils/studioData.js'
import { requireAdmin } from '../utils/studioSession.js'

const router = new Router({
  prefix: '/api/jcyb',
})

const JCYB_GET_INFO_URL = 'https://jcyb-admin.nbjcyb.cn/config/getInfo'
const JCYB_DEBUG_HEADER = 'ewrwerr343t4t5f'
const REVENUE_SHARES_FILE_NAME = 'jcyb-revenue-shares.json'

function normalizeDate(value) {
  const normalizedValue = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : ''
}

function getRevenueSharesFilePath() {
  return path.join(getStudioDataDir(), REVENUE_SHARES_FILE_NAME)
}

function normalizeActualShare(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null
}

function normalizeRevenueShareRecord(record = {}) {
  return {
    actualShare: normalizeActualShare(record.actualShare),
    updatedAt: record.updatedAt || new Date().toISOString(),
  }
}

async function readRevenueShares() {
  await ensureStudioData()

  try {
    const raw = await fs.readFile(getRevenueSharesFilePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    const records = Object.fromEntries(
      Object.entries(parsed.records || {})
        .map(([date, record]) => [normalizeDate(date), normalizeRevenueShareRecord(record)])
        .filter(([date]) => Boolean(date))
    )

    return {
      records,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }

    return {
      records: {},
      updatedAt: new Date().toISOString(),
    }
  }
}

async function writeRevenueShares(records) {
  await ensureStudioData()
  const payload = {
    records,
    updatedAt: new Date().toISOString(),
  }
  await fs.writeFile(getRevenueSharesFilePath(), JSON.stringify(payload, null, 2), 'utf-8')
  return payload
}

router.get('/get-info', async ctx => {
  const date = normalizeDate(ctx.query.date)
  if (!date) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '日期参数格式错误',
    }
    return
  }

  const targetUrl = `${JCYB_GET_INFO_URL}?date=${encodeURIComponent(date)}`

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        debug: JCYB_DEBUG_HEADER,
        Accept: 'application/json',
      },
    })

    const rawText = await response.text()
    if (!response.ok) {
      console.error(
        `[jcyb] 第三方金额接口请求失败 status=${response.status} body=${rawText.slice(0, 200)}`
      )
      ctx.status = response.status
      ctx.body = {
        code: response.status,
        message: `第三方金额接口请求失败 (${response.status})`,
      }
      return
    }

    try {
      ctx.body = rawText ? JSON.parse(rawText) : { code: 0, data: { total: '0' } }
    } catch (parseError) {
      console.error('[jcyb] 解析第三方金额接口响应失败:', parseError, rawText.slice(0, 200))
      ctx.status = 502
      ctx.body = {
        code: 502,
        message: '第三方金额接口返回格式异常',
      }
    }
  } catch (error) {
    console.error('[jcyb] 请求第三方金额接口异常:', error)
    ctx.status = 502
    ctx.body = {
      code: 502,
      message: error instanceof Error ? error.message : '请求第三方金额接口失败',
    }
  }
})

router.get('/revenue-shares', requireAdmin, async ctx => {
  const payload = await readRevenueShares()
  ctx.body = {
    code: 0,
    data: payload,
  }
})

router.put('/revenue-shares/:date', requireAdmin, async ctx => {
  const date = normalizeDate(ctx.params.date)
  if (!date) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '日期参数格式错误',
    }
    return
  }

  const body = ctx.request.body || {}
  const actualShare = normalizeActualShare(body.actualShare)
  if (
    body.actualShare !== null &&
    body.actualShare !== undefined &&
    body.actualShare !== '' &&
    actualShare === null
  ) {
    ctx.status = 400
    ctx.body = {
      code: 400,
      message: '实际分成金额格式错误',
    }
    return
  }

  const payload = await readRevenueShares()
  const nextRecord = normalizeRevenueShareRecord({
    actualShare,
    updatedAt: new Date().toISOString(),
  })
  const nextRecords = {
    ...payload.records,
    [date]: nextRecord,
  }

  await writeRevenueShares(nextRecords)
  ctx.body = {
    code: 0,
    data: {
      date,
      ...nextRecord,
    },
  }
})

export default router
