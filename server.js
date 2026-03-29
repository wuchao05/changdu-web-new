import Koa from 'koa'
import Router from '@koa/router'
import cors from '@koa/cors'
import { koaBody } from 'koa-body'
import serve from 'koa-static'
import mount from 'koa-mount'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { loadServerEnv } from './server/utils/loadEnv.js'
import { installDebugLogCapture } from './server/utils/debugLogStream.js'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// 导入路由模块
import feishuRoutes from './server/routes/feishu.js'
import novelsaleRoutes from './server/routes/novelsale.js'
import nodeRoutes from './server/routes/node.js'
import thirdPartyRoutes from './server/routes/third-party.js'
import djdataRoutes from './server/routes/djdata.js'
import juliangRoutes from './server/routes/juliang.js'
import sessionRoutes from './server/routes/session.js'
import adminRoutes from './server/routes/admin.js'
import buildWorkflowRoutes from './server/routes/buildWorkflow.js'
import douyinMaterialRoutes from './server/routes/douyinMaterial.js'
import authRoutes from './server/routes/auth.js'
import publicRoutes from './server/routes/public.js'
import autoSubmitRoutes from './server/routes/autoSubmit.js'
import adxRoutes from './server/routes/adx.js'
import buildConfigRoutes from './server/routes/buildConfig.js'
import debugRoutes from './server/routes/debug.js'
import materialPreviewRoutes from './server/routes/materialPreview.js'
import { initScheduler } from './server/services/buildWorkflowScheduler.js'
import { initScheduler as initAutoSubmitScheduler } from './server/services/autoSubmitScheduler.js'
import { materialPreviewManager } from './server/services/materialPreviewManager.js'
import { ensureStudioData } from './server/utils/studioData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

installDebugLogCapture()

// 按环境加载服务端环境变量
loadServerEnv(__dirname, process.env.NODE_ENV)

const app = new Koa()
const router = new Router()

// 中间件配置
app.use(
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'distributorid',
      'appid',
      'apptype',
      'cookie',
      'Distributorid',
      'Appid',
      'Apptype',
      'aduserid',
      'rootaduserid',
      'Aduserid',
      'Rootaduserid',
      'X-Studio-Token',
      'X-Studio-Channel-Id',
    ],
    credentials: true,
  })
)

app.use(
  koaBody({
    multipart: true,
    formidable: {
      maxFileSize: 1000 * 1024 * 1024, // 1000MB
      uploadDir: './uploads', // 临时上传目录
      keepExtensions: true,
    },
    jsonLimit: '10mb',
    formLimit: '10mb',
    textLimit: '10mb',
    // 默认不解析 DELETE，需要显式开启
    parsedMethods: ['POST', 'PUT', 'PATCH', 'GET', 'DELETE'],
  })
)

// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    console.error('Server Error:', err)
    ctx.status = err.status || 500
    ctx.body = {
      error: 'Internal Server Error',
      message: err.message,
      timestamp: new Date().toISOString(),
    }
  }
})

// 日志中间件已移除

// API 路由

// 健康检查端点
router.get('/health', ctx => {
  ctx.body = { status: 'ok', timestamp: new Date().toISOString() }
})

router.use('/api/feishu', feishuRoutes.routes(), feishuRoutes.allowedMethods())
router.use('/api/novelsale', novelsaleRoutes.routes(), novelsaleRoutes.allowedMethods())
router.use('/api/node/api', nodeRoutes.routes(), nodeRoutes.allowedMethods())
router.use('/api/djdata', djdataRoutes.routes(), djdataRoutes.allowedMethods())
router.use(sessionRoutes.routes(), sessionRoutes.allowedMethods())
router.use(adminRoutes.routes(), adminRoutes.allowedMethods())
router.use('/api/auth', authRoutes.routes(), authRoutes.allowedMethods())
router.use(publicRoutes.routes(), publicRoutes.allowedMethods())
router.use('/api/build-config', buildConfigRoutes.routes(), buildConfigRoutes.allowedMethods())
router.use('/api/adx', adxRoutes.routes(), adxRoutes.allowedMethods())
router.use(debugRoutes.routes(), debugRoutes.allowedMethods())
router.use(materialPreviewRoutes.routes(), materialPreviewRoutes.allowedMethods())
router.use(
  '/api/douyin-material',
  douyinMaterialRoutes.routes(),
  douyinMaterialRoutes.allowedMethods()
)
router.use(juliangRoutes.routes(), juliangRoutes.allowedMethods())
router.use(thirdPartyRoutes.routes(), thirdPartyRoutes.allowedMethods())
router.use(buildWorkflowRoutes.routes(), buildWorkflowRoutes.allowedMethods())
router.use(autoSubmitRoutes.routes(), autoSubmitRoutes.allowedMethods())

app.use(router.routes())
app.use(router.allowedMethods())

// 静态文件服务 - 用于生产环境
if (process.env.NODE_ENV === 'production') {
  app.use(mount('/', serve(path.join(__dirname, 'dist'))))

  // SPA 路由回退
  app.use(async ctx => {
    if (!ctx.path.startsWith('/api')) {
      ctx.type = 'html'
      ctx.body = readFileSync(path.join(__dirname, 'dist', 'index.html'), 'utf8')
    }
  })
}

const PORT = process.env.PORT || 3000

ensureStudioData().catch(error => {
  console.error('初始化 Studio 数据目录失败:', error)
})

// 初始化后台调度器（恢复之前的状态）
initScheduler().catch(err => {
  console.error('初始化后台搭建调度器失败:', err)
})

// 初始化自动提交下载调度器
initAutoSubmitScheduler().catch(err => {
  console.error('初始化自动提交下载调度器失败:', err)
})

materialPreviewManager.init().catch(err => {
  console.error('初始化素材预览管理器失败:', err)
})

app.listen(PORT, () => {
  console.log(`服务器已启动，端口: ${PORT}`)
})

export default app
