import axios, { type AxiosInstance } from 'axios'
import { createDiscreteApi } from 'naive-ui'
import { ENV } from '@/config/env'
import { useApiConfigStore } from '@/stores/apiConfig'
import { getSelectedChannelId, getSessionToken } from '@/utils/sessionToken'

export interface ExtendedError extends Error {
  handledByInterceptor?: boolean
}

const { message } = createDiscreteApi(['message'])

const httpInstance: AxiosInstance = axios.create({
  baseURL: ENV.BASE_URL,
  timeout: 30 * 60 * 1000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let currentDistributorId = ''

export function setCurrentDistributorId(distributorId: string) {
  currentDistributorId = distributorId
}

function getApiType(url: string | undefined) {
  if (!url) return 'default'
  if (url.includes('/download_center/get_url')) return 'download_center'
  if (url.includes('/download_center/task_list')) return 'task_list'
  return 'default'
}

function addCookieToRequest(config: any, cookie: string) {
  if (config.method === 'get') {
    config.params = config.params || {}
    config.params.cookie = cookie
    return
  }

  config.headers = config.headers || {}
  config.headers.Cookie = cookie

  if (typeof config.data === 'object' && config.data !== null) {
    config.data = { ...config.data, cookie }
  } else {
    config.data = { cookie }
  }
}

httpInstance.interceptors.request.use(
  config => {
    const apiConfigStore = useApiConfigStore()
    const apiConfig = apiConfigStore.config
    const apiType = getApiType(config.url)
    const distributorId = apiConfig.distributorId || currentDistributorId
    const baseHeaders: Record<string, string> = {
      Appid: apiConfig.appId || '40011566',
      Apptype: '7',
      Aduserid: apiConfig.adUserId || '1291245239407612',
      Rootaduserid: apiConfig.rootAdUserId || '600762415841560',
    }
    const downloadHeaders: Record<string, string> = {
      ...baseHeaders,
      Distributorid: distributorId || '',
    }

    switch (apiType) {
      case 'download_center':
      case 'task_list':
        Object.assign(config.headers, downloadHeaders)
        break
      default:
        Object.assign(config.headers, baseHeaders)
        break
    }

    if (distributorId) {
      config.headers.Distributorid = distributorId
    }

    const sessionToken = getSessionToken()
    if (sessionToken) {
      config.headers['X-Studio-Token'] = sessionToken
    }
    const selectedChannelId = getSelectedChannelId()
    if (selectedChannelId) {
      config.headers['X-Studio-Channel-Id'] = selectedChannelId
    }

    if (apiConfig.cookie) {
      addCookieToRequest(config, apiConfig.cookie)
    }

    return config
  },
  error => Promise.reject(error)
)

function createError(messageText: string, name: string, originalError?: Error): ExtendedError {
  const error = new Error(messageText) as ExtendedError
  error.name = name
  error.handledByInterceptor = true
  if (originalError?.stack) {
    error.stack = originalError.stack
  }
  return error
}

httpInstance.interceptors.response.use(
  response => {
    const { data } = response

    if (data?.code !== undefined && data.code !== 0) {
      if (data.code === 4001) {
        message.error('Cookie 认证信息无效或已过期，请在设置页面重新填写。')
        return Promise.reject(createError('Cookie 认证信息无效，请重新配置', 'AuthenticationError'))
      }
      return Promise.reject(createError(data.message || '请求失败', 'BusinessError'))
    }

    return response
  },
  error => {
    let errorMessage = error.message || '未知错误'
    let errorName = 'UnknownError'

    if (error.response) {
      errorMessage = error.response.data?.message || `请求失败 (${error.response.status})`
      errorName = 'NetworkError'
    } else if (error.request) {
      errorMessage = '网络连接失败，请检查网络设置'
      errorName = 'ConnectionError'
    }

    message.error(errorMessage)
    return Promise.reject(createError(errorMessage, errorName, error))
  }
)

export default httpInstance
