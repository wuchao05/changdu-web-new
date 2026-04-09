import Router from '@koa/router'
import { buildBootstrapData, buildLayoutData, getMiniAppShellId } from '../config/miniappShell.js'

const router = new Router({
  prefix: '/miniapp',
})

function readRequiredQuery(ctx, key) {
  return String(ctx.query[key] || '').trim()
}

function writeMissingParam(ctx, paramName) {
  ctx.status = 400
  ctx.body = {
    code: 400,
    message: `缺少必要参数: ${paramName}`,
    data: null,
  }
}

router.get('/bootstrap', async ctx => {
  const appId = readRequiredQuery(ctx, 'app_id')

  if (!appId) {
    writeMissingParam(ctx, 'app_id')
    return
  }

  ctx.body = {
    code: 0,
    message: 'ok',
    data: await buildBootstrapData(appId),
  }
})

router.get('/layout', async ctx => {
  const shellId = readRequiredQuery(ctx, 'shell_id')
  const appId = readRequiredQuery(ctx, 'app_id')

  if (!shellId) {
    writeMissingParam(ctx, 'shell_id')
    return
  }

  if (!appId) {
    writeMissingParam(ctx, 'app_id')
    return
  }

  const currentShellId = await getMiniAppShellId()

  if (shellId !== currentShellId) {
    ctx.status = 404
    ctx.body = {
      code: 404,
      message: 'shell_id 不存在',
      data: null,
    }
    return
  }

  ctx.body = {
    code: 0,
    message: 'ok',
    data: await buildLayoutData(appId),
  }
})

export default router
