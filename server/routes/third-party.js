import Router from '@koa/router'
import { createProxyMiddleware } from 'http-proxy-middleware'
import koaConnect from 'koa2-connect'

const router = new Router()

// 第三方 API 代理配置
const createThirdPartyProxy = () => {
  const target = process.env.VITE_PROXY_TARGET || 'https://www.changdunovel.com'

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
    pathRewrite: path => {
      // 移除 /api/third-party 前缀，并确保路径以 / 开头
      const newPath = path.replace(/^\/api\/third-party/, '')
      return newPath.startsWith('/') ? newPath : `/${newPath}`
    },
    onProxyRes: (proxyRes, req, res) => {
      // 设置 CORS 头
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie')
    },
    onProxyReq: (proxyReq, req) => {
      // 添加必要的请求头
      proxyReq.setHeader('Origin', 'https://www.changdunovel.com')
      proxyReq.setHeader('Referer', 'https://www.changdunovel.com/')

      // 其他接口的原有逻辑
      // 初始化cookie值
      let cookieValue = null

      if (req.method === 'GET') {
        // GET请求：从query参数中获取cookie
        const url = new URL(req.url || '', 'http://localhost')
        cookieValue = url.searchParams.get('cookie')

        // 从URL中移除cookie参数，避免传递到目标服务器
        if (cookieValue) {
          url.searchParams.delete('cookie')
          const newPath = url.pathname + (url.search || '')
          proxyReq.path = newPath
        }
      }

      // 优先级处理：query参数 > 请求头 > 环境变量
      const finalCookieValue = cookieValue || req.headers.cookie || process.env.VITE_HEADER_COOKIE

      // 设置最终的cookie到请求头
      if (finalCookieValue) {
        proxyReq.setHeader('Cookie', finalCookieValue)
      }

      // 处理环境变量中的其他请求头
      const headerPrefix = 'VITE_HEADER_'
      Object.keys(process.env)
        .filter(k => k.startsWith(headerPrefix) && k !== 'VITE_HEADER_COOKIE')
        .forEach(k => {
          const headerName = k.replace(headerPrefix, '').replace(/_/g, '-')
          const val = process.env[k]
          if (val) {
            proxyReq.setHeader(headerName, val)
          }
        })
    },
  })
}

// 第三方 API 代理路由 - 使用多个具体路由匹配
router.all('/api/third-party', koaConnect(createThirdPartyProxy()))
router.all('/api/third-party/:path', koaConnect(createThirdPartyProxy()))
router.all('/api/third-party/:path/:subpath', koaConnect(createThirdPartyProxy()))
router.all('/api/third-party/:path/:subpath/:subsubpath', koaConnect(createThirdPartyProxy()))
router.all(
  '/api/third-party/:path/:subpath/:subsubpath/:subsubsubpath',
  koaConnect(createThirdPartyProxy())
)
router.all(
  '/api/third-party/:path/:subpath/:subsubpath/:subsubsubpath/:subsubsubsubpath',
  koaConnect(createThirdPartyProxy())
)

export default router
