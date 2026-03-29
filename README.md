# 长读工作台

基于 Vue 3 + Koa 的内部工作台，当前只保留“当前用户 + 当前渠道配置”模型。

## 当前能力

- 登录后按当前渠道加载工作台、爆剧爆剪和搭建调度
- 渠道维度维护常读、巨量、ADX 和搭建参数
- 用户维度维护飞书表、抖音号匹配素材和本地偏好
- 后端调度器按 `用户 + 渠道` 独立运行，互不影响

## 本地开发

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm start
```

## 运行数据

- Studio 数据目录默认使用 `server/data/studio`
- 生产环境可通过 `STUDIO_DATA_DIR` 指向持久化目录
- 常读逆向目录通过 `CHANGDU_REVERSE_DIR` 指定

## 接口文档

- 管理员资源查询接口文档见 [docs/admin-resource-api.md](docs/admin-resource-api.md)
- 素材预览接口文档见 [docs/material-preview-api.md](docs/material-preview-api.md)

## 注意事项

1. 不要把真实 Cookie、Token 和本地路径提交到仓库。
2. 管理员、用户、渠道配置都以 `server/data/studio` 为准。
3. 仓库只保留当前工作台模型，已下线的历史兼容说明不再保留。
