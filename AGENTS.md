# AGENTS.md

## 仓库定位

这是一个基于 Vue 3 + TypeScript + Koa 的长读工作台仓库。
当前模型只有两层：

1. 当前登录用户
2. 当前选中的渠道配置

不要再引入任何历史兼容层或已下线能力。

## 关键目录

- `src/`：前端页面、组件、Pinia store、API 封装
- `server/`：Koa 路由、调度器、配置和运行时工具
- `server/data/studio/`：本地 Studio 数据目录
- `server.js`：服务端入口

## 常用命令

- `pnpm install`
- `pnpm dev`
- `pnpm lint`
- `pnpm type-check`
- `pnpm build`
- `pnpm start`

## 修改原则

- 默认使用中文回复和中文注释。
- 优先沿用现有 `naive-ui`、Pinia、`@/` 别名和 `script setup` 风格。
- 后端运行时、请求头、调度器实例都必须基于“当前用户 + 当前渠道”。
- 不要保留旧字段名、旧路由名、旧文案，也不要新增兼容层。
- 不要手改 `dist/`。
- 不要提交真实 Cookie、Token、本地绝对路径。

## 校验建议

涉及前端或服务端代码改动时，优先执行：

1. `pnpm lint`
2. `pnpm type-check`
3. `pnpm build`

## Workflow

- 以下工作流来自仓库维护者要求；若与当前运行环境的更高优先级指令冲突，以更高优先级指令为准。
- **始终在 master 分支上进行代码修改**：所有代码变更必须直接在 master 分支上完成，不使用功能分支（除非用户明确要求）。
- **自动提交并推送**：每次修改代码后自动提交并推送到远程 master 分支；只有当用户明确说明需要 review 代码时，才不自动提交和推送。
- **工作流程**：
  1. 确认当前在 master 分支（`git branch --show-current`）
  2. 进行代码修改
  3. 运行 lint 和 type-check
  4. 提交代码到 master 分支
  5. 立即推送到远程：`git push origin master`
