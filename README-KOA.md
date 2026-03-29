# 长读小说 Web 应用 - Koa 服务器架构

## 架构说明

本项目已从 Vercel 无服务器架构迁移到 Koa.js 服务器架构，提供更好的开发体验和部署灵活性。

## 项目结构

```
├── server.js                 # Koa 服务器入口文件
├── server/                   # 服务器端代码
│   ├── routes/              # API 路由
│   │   ├── feishu.js        # 飞书 API 路由
│   │   ├── novelsale.js     # 小说销售 API 路由
│   │   └── node.js          # 节点 API 路由
│   └── utils/               # 服务器工具函数
│       └── apiHandler.js    # API 处理工具
├── src/                     # 前端 Vue.js 应用
├── dist/                    # 构建输出目录
└── start-dev.js            # 开发环境启动脚本
```

## 开发环境

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
# 同时启动前端和后端服务器
npm run dev:full

# 或者分别启动
npm run dev          # 启动前端 (端口 5173)
npm run server:dev   # 启动后端 (端口 3000)
```

### 访问地址

- 前端应用: http://localhost:5173
- 后端 API: http://localhost:3000
- 健康检查: http://localhost:3000/health

## 生产环境

### 构建和启动

```bash
# 构建前端并启动生产服务器
npm start

# 或者分步执行
npm run build        # 构建前端
npm run server:prod  # 启动生产服务器
```

## API 路由

### 飞书 API

- `POST /api/feishu/token` - 获取飞书访问令牌
- `POST /api/feishu/bitable/create` - 创建飞书多维表格
- `POST /api/feishu/bitable/search` - 搜索飞书多维表格

### 小说销售 API

- `GET /api/novelsale/distributor/application_overview_list/v1` - 应用概览列表
- `GET /api/novelsale/distributor/promotion/detail/v2` - 推广详情
- `GET /api/novelsale/distributor/login/v1` - 登录
- `GET /api/novelsale/distributor/content/series/list/v1` - 系列列表
- `GET /api/novelsale/distributor/content/series/detail/v1` - 系列详情
- `GET /api/novelsale/distributor/content/episode/info/v1` - 剧集信息
- `GET /api/novelsale/distributor/dashboard/data_overview/v1` - 数据概览
- `GET /api/novelsale/distributor/dashboard/recharge_analyze/v1` - 充值分析

### 节点 API

- `GET /api/node/api/platform/distributor/download_center/get_url` - 获取下载链接
- `GET /api/node/api/platform/distributor/download_center/task_list` - 任务列表

## 环境变量

创建 `.env` 文件并配置以下变量：

```env
# 飞书配置
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# 第三方 API 代理目标
VITE_PROXY_TARGET=https://www.changdunovel.com

# 其他配置
VITE_HEADER_COOKIE=your_cookie_value

# 常读 a_bogus 逆向目录
# 目录中至少要有 env.js 和 bdms.js
# 生产环境请放在项目外部目录
CHANGDU_REVERSE_DIR=/data/changdu-web/reverse-bogus
```

## 部署

### Docker 部署

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### 传统服务器部署

1. 构建项目: `npm run build`
2. 启动服务器: `npm run server:prod`
3. 使用 PM2 或类似工具管理进程

## 迁移说明

从 Vercel 架构迁移的主要变化：

1. **API 函数** → **Koa 路由**: 所有 Vercel API 函数已转换为 Koa 路由
2. **无服务器** → **传统服务器**: 使用 Koa.js 提供完整的服务器功能
3. **Vercel 配置** → **Koa 中间件**: 使用 Koa 中间件处理 CORS、错误处理等
4. **开发代理**: Vite 开发服务器现在代理到本地 Koa 服务器

## 故障排除

### 端口冲突

如果端口 3000 被占用，可以修改 `server.js` 中的端口配置。

### CORS 问题

检查 `server.js` 中的 CORS 配置，确保允许的域名和请求头正确。

### API 代理问题

检查 `vite.config.ts` 中的代理配置，确保目标地址正确。
