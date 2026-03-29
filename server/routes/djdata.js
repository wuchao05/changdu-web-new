import Router from '@koa/router'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import axios from 'axios'
import FormData from 'form-data'
import { DJDATA_CONFIG } from '../config/djdata.js'

const router = new Router()

const ensureAccessToken = ctx => {
  if (DJDATA_CONFIG.accessToken) return DJDATA_CONFIG.accessToken
  ctx.status = 500
  ctx.body = {
    success: false,
    message: '缺少 DJDATA Access-Token 配置',
  }
  return null
}

const calcFileMd5 = filePath =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })

// 查询广告主信息
router.get('/advertisers', async ctx => {
  const { name, type, page_size } = ctx.query || {}
  if (!name) {
    ctx.status = 400
    ctx.body = { success: false, message: '缺少账户名称' }
    return
  }

  const accessToken = ensureAccessToken(ctx)
  if (!accessToken) return

  const query = new URLSearchParams({
    name: String(name),
    type: String(type || DJDATA_CONFIG.advertiserType),
    page_size: String(page_size || DJDATA_CONFIG.advertiserPageSize),
  })

  try {
    const response = await fetch(`${DJDATA_CONFIG.baseUrl}/sys/open/get_advertisers?${query}`, {
      headers: {
        'Access-Token': accessToken,
      },
    })

    const result = await response.json()
    if (result.code !== 0) {
      ctx.status = 500
      ctx.body = {
        success: false,
        message: result.message || '查询广告主失败',
        data: result,
      }
      return
    }

    const advertiserId = result?.data?.list?.[0]?.id ?? null
    ctx.body = {
      success: true,
      data: result,
      advertiserId,
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      success: false,
      message: error.message,
    }
  }
})

// 上传素材到巨量视频库
router.post('/upload-video', async ctx => {
  const { filePath, advertiserId } = ctx.request.body || {}
  if (!filePath || !advertiserId) {
    ctx.status = 400
    ctx.body = {
      success: false,
      message: '缺少 filePath 或 advertiserId',
    }
    return
  }

  if (!fs.existsSync(filePath)) {
    ctx.status = 400
    ctx.body = {
      success: false,
      message: `文件不存在: ${filePath}`,
    }
    return
  }

  const accessToken = ensureAccessToken(ctx)
  if (!accessToken) return

  try {
    const fileName = path.basename(filePath)
    const md5 = await calcFileMd5(filePath)

    console.log('DJDATA上传参数:', {
      filePath,
      fileName,
      advertiserId,
      md5,
    })

    const uploadUrlResponse = await fetch(`${DJDATA_CONFIG.baseUrl}/sys/open/get_oss_upload_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        name: fileName,
        type: DJDATA_CONFIG.uploadAssetType,
        md5,
        upload_type: DJDATA_CONFIG.uploadType,
        advertiser_id: [Number(advertiserId)],
      }),
    })

    const uploadUrlResult = await uploadUrlResponse.json()
    if (uploadUrlResult.code !== 0) {
      ctx.status = 500
      ctx.body = {
        success: false,
        message: uploadUrlResult.message || '获取上传地址失败',
        data: uploadUrlResult,
      }
      return
    }

    const {
      upload_token: uploadToken,
      advertiser_id: outAdvertiserId,
      url,
    } = uploadUrlResult.data || {}

    if (!url || !uploadToken) {
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '上传地址返回数据不完整',
        data: uploadUrlResult.data || null,
      }
      return
    }

    console.log('DJDATA上传地址返回:', {
      url,
      uploadToken,
      advertiserId: outAdvertiserId || advertiserId,
    })

    const formData = new FormData()
    formData.append('video_file', fs.createReadStream(filePath), {
      filename: fileName,
      contentType: 'application/octet-stream',
    })
    formData.append('advertiser_id', String(outAdvertiserId || advertiserId))
    formData.append('upload_type', DJDATA_CONFIG.uploadActionType)
    formData.append('video_signature', md5)
    formData.append('filename', fileName)
    formData.append('upload_token', uploadToken)
    formData.append('pwd', DJDATA_CONFIG.uploadPwd)
    formData.append('platform', DJDATA_CONFIG.uploadPlatform)

    const uploadResponse = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 30 * 60 * 1000,
    })

    ctx.body = {
      success: true,
      data: uploadResponse.data,
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      success: false,
      message: error.message,
    }
  }
})

export default router
