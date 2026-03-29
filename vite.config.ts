import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import type { PluginOption } from 'vite'

// https://vite.dev/config/
export default defineConfig(async () => {
  // const env = loadEnv(mode, process.cwd(), '')

  // 代理到第三方接口
  // const target = env.VITE_PROXY_TARGET || 'https://www.changdunovel.com'

  const plugins: PluginOption[] = [vue()]
  if (process.env.VITE_ENABLE_DEVTOOLS === 'true') {
    const { default: vueDevTools } = await import('vite-plugin-vue-devtools')
    plugins.push(vueDevTools())
  }

  return {
    plugins,
    // Vercel 部署使用根路径
    base: '/',
    envPrefix: ['VITE_PROXY_', 'VITE_BASE_', 'VITE_SPECIAL_', 'VITE_ENABLE_'], // 只加载特定前缀的环境变量
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0', // 允许外部访问
      port: 5178,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      // 生产环境优化
      minify: 'terser' as const,
      sourcemap: false,
      // 分包策略
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue'],
            'naive-ui': ['naive-ui'],
            utils: ['dayjs', 'axios'],
          },
        },
      },
      // 资源大小警告限制
      chunkSizeWarningLimit: 1000,
    },
  }
})
