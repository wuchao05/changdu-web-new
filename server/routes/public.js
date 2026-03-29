import Router from '@koa/router'
import { getDefaultDownloadCenterConfig } from '../utils/studioData.js'

const router = new Router({
  prefix: '/api/public',
})

router.get('/download-center/default', async ctx => {
  try {
    const config = await getDefaultDownloadCenterConfig()

    if (!config) {
      ctx.body = {
        code: 0,
        message: 'success',
        data: null,
      }
      return
    }

    ctx.body = {
      code: 0,
      message: 'success',
      data: {
        appId: config.appId || '',
        appType: '7',
        cookie: config.cookie || '',
        distributorId: config.distributorId || '',
        adUserId: config.adUserId || '',
        rootAdUserId: config.rootAdUserId || config.adUserId || '',
        agwJsConv: 'str',
      },
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: 500,
      message: '读取下载中心默认配置失败',
      error: error.message,
    }
  }
})

export default router
