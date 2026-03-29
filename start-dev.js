#!/usr/bin/env node

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { loadServerEnv } from './server/utils/loadEnv.js'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 按环境加载服务端环境变量
loadServerEnv(__dirname, process.env.NODE_ENV)

console.log('🚀 启动开发环境...')

// 启动 Koa 服务器
const serverProcess = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
})

// 启动 Vite 开发服务器
const viteProcess = spawn('pnpm', ['dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
})

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭开发服务器...')
  serverProcess.kill('SIGINT')
  viteProcess.kill('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭开发服务器...')
  serverProcess.kill('SIGTERM')
  viteProcess.kill('SIGTERM')
  process.exit(0)
})

// 监听进程错误
serverProcess.on('error', err => {
  console.error('❌ Koa 服务器启动失败:', err)
})

viteProcess.on('error', err => {
  console.error('❌ Vite 开发服务器启动失败:', err)
})

console.log('✅ 开发环境已启动')
console.log('📱 前端: http://localhost:5178')
console.log('🔧 后端: http://localhost:3000')
