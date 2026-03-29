import { ENV } from '@/config/env'
import { DJDATA_CONFIG } from '@/config/djdata'

type DjdataAdvertiserResponse = {
  success: boolean
  advertiserId?: number | null
  data?: any
  message?: string
}

type DjdataUploadUrlResponse = {
  code: number
  message: string
  data?: {
    upload_token?: string
    advertiser_id?: string
    url?: string
  }
}

export const djdataApi = {
  async getAdvertiserIdByAccount(account: string): Promise<DjdataAdvertiserResponse> {
    const url = `${ENV.BASE_URL}/djdata/advertisers?name=${encodeURIComponent(account)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`查询广告主失败: ${response.status} ${response.statusText}`)
    }
    return response.json()
  },

  async getOssUploadUrl(params: {
    name: string
    md5: string
    advertiserId: number
    signal?: AbortSignal
  }) {
    console.log('DJDATA获取上传地址参数:', {
      name: params.name,
      md5: params.md5,
      advertiserId: params.advertiserId,
      uploadType: DJDATA_CONFIG.uploadType,
      uploadAssetType: DJDATA_CONFIG.uploadAssetType,
    })

    const response = await fetch(`${DJDATA_CONFIG.baseUrl}/sys/open/get_oss_upload_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': DJDATA_CONFIG.accessToken,
      },
      body: JSON.stringify({
        name: params.name,
        type: DJDATA_CONFIG.uploadAssetType,
        md5: params.md5,
        upload_type: DJDATA_CONFIG.uploadType,
        advertiser_id: [params.advertiserId],
      }),
      signal: params.signal,
    })

    if (!response.ok) {
      throw new Error(`获取上传地址失败: ${response.status} ${response.statusText}`)
    }

    const result = (await response.json()) as DjdataUploadUrlResponse
    if (result.code !== 0) {
      throw new Error(result.message || '获取上传地址失败')
    }

    return result
  },

  async uploadVideoFile(params: {
    url: string
    file: File
    md5: string
    uploadToken: string
    advertiserId: string
    signal?: AbortSignal
  }) {
    console.log('DJDATA上传视频参数:', {
      url: params.url,
      fileName: params.file.name,
      advertiserId: params.advertiserId,
      md5: params.md5,
      uploadToken: params.uploadToken,
      uploadType: DJDATA_CONFIG.uploadActionType,
      uploadPlatform: DJDATA_CONFIG.uploadPlatform,
      uploadPwd: DJDATA_CONFIG.uploadPwd,
    })

    const formData = new FormData()
    formData.append('video_file', params.file)
    formData.append('advertiser_id', params.advertiserId)
    formData.append('upload_type', DJDATA_CONFIG.uploadActionType)
    formData.append('video_signature', params.md5)
    formData.append('filename', params.file.name)
    formData.append('upload_token', params.uploadToken)
    formData.append('pwd', DJDATA_CONFIG.uploadPwd)
    formData.append('platform', DJDATA_CONFIG.uploadPlatform)

    const response = await fetch(params.url, {
      method: 'POST',
      body: formData,
      signal: params.signal,
    })

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      return { raw: text }
    }

    if (data && typeof data === 'object' && 'code' in data && data.code !== 0) {
      throw new Error(data.message || '上传失败')
    }

    return data
  },
}

export default djdataApi
