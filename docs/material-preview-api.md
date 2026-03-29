# 素材预览接口

本文档说明当前项目内置的素材预览服务接口。  
这套接口已经接入当前项目，不再依赖外部 `oceanengine-preview` 服务。

素材预览的运行数据来源如下：

- 巨量 Cookie：当前渠道的 `juliang.cookie`
- 飞书表格 ID：当前用户当前渠道下的 `feishu.dramaStatusTableId`
- 抖音白名单：当前用户当前渠道下 `douyinMaterialMatches[].douyinAccount`

## 鉴权说明

所有接口都要求已登录。

请求头至少需要携带：

```http
X-Studio-Token: <登录 token>
```

如果是按当前渠道调用，还应携带：

```http
X-Studio-Channel-Id: <channelId>
```

如果要由管理员操作“其他用户 + 其他渠道”的素材预览，可在请求体或查询参数中传：

- `userId`
- `channelId`

非管理员不能指定其他用户。

## 通用返回格式

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": -1,
  "message": "错误信息"
}
```

## 状态对象说明

以下接口会返回素材预览状态对象：

```json
{
  "instanceKey": "userId__channelId",
  "userId": "admin",
  "runtimeUserName": "管理员",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
  "channelName": "甜荔",
  "enabled": true,
  "running": false,
  "intervalMinutes": 20,
  "buildTimeWindowStart": 90,
  "buildTimeWindowEnd": 20,
  "nextRunTime": "2026-03-27T12:20:00.000Z",
  "lastRunTime": "2026-03-27T12:00:00.000Z",
  "lastStatus": "success",
  "lastError": "",
  "tableId": "tblDOyi2Lzs80sv0",
  "awemeWhiteList": ["小红看剧", "甜荔看剧"],
  "stats": {
    "totalProcessed": 12,
    "totalPreviewed": 8,
    "totalDeleted": 2,
    "successCount": 1,
    "failCount": 0
  },
  "lastRunTimeText": "2026-03-27 20:00:00",
  "nextRunTimeText": "2026-03-27 20:20:00"
}
```

## 1. 启动素材预览

- 方法：`POST`
- 路径：`/api/material-preview/start`

### 请求体

```json
{
  "userId": "admin",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
  "intervalMinutes": 20,
  "buildTimeWindowStart": 90,
  "buildTimeWindowEnd": 20
}
```

说明：

- `userId` 可选
  不传时默认使用当前登录用户
- `channelId` 可选
  不传时优先取 `X-Studio-Channel-Id`
- `intervalMinutes` 可选
- `buildTimeWindowStart` 可选
- `buildTimeWindowEnd` 可选

### 返回

返回最新状态对象。

## 2. 停止素材预览

- 方法：`POST`
- 路径：`/api/material-preview/stop`

### 请求体

```json
{
  "userId": "admin",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df"
}
```

### 返回

返回停止后的状态对象。

## 3. 更新素材预览配置

- 方法：`POST`
- 路径：`/api/material-preview/update`

### 请求体

```json
{
  "userId": "admin",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
  "intervalMinutes": 10,
  "buildTimeWindowStart": 120,
  "buildTimeWindowEnd": 30
}
```

### 返回

返回更新后的状态对象。

## 4. 查询当前素材预览状态

- 方法：`GET`
- 路径：`/api/material-preview/status`

### 查询参数

- `userId` 可选
- `channelId` 可选

### 请求示例

```bash
curl "http://localhost:3000/api/material-preview/status?userId=admin&channelId=5f0d85e6-26a0-4fe2-a0c5-30c78a8770df" \
  -H "X-Studio-Token: <token>"
```

### 返回

返回单个状态对象。

## 5. 查询素材预览状态列表

- 方法：`GET`
- 路径：`/api/material-preview/status/list`
- 权限：仅管理员

### 查询参数

- `userId` 可选
- `channelId` 可选

### 请求示例

```bash
curl "http://localhost:3000/api/material-preview/status/list" \
  -H "X-Studio-Token: <admin-token>"
```

### 返回

返回状态对象数组。

## 6. 手动触发一轮素材预览

- 方法：`POST`
- 路径：`/api/material-preview/trigger`

### 请求体

```json
{
  "userId": "admin",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df"
}
```

### 返回

返回触发后的状态对象。

## 7. 执行一轮素材预览但不启动定时器

- 方法：`POST`
- 路径：`/api/material-preview/execute-once`

### 请求体

```json
{
  "userId": "admin",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
  "buildTimeWindowStart": 90,
  "buildTimeWindowEnd": 20,
  "dryRun": false,
  "previewDelayMs": 400
}
```

### 返回

返回批量执行结果：

```json
{
  "code": 0,
  "message": "素材预览执行完成",
  "data": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "results": []
  }
}
```

## 8. 分析单个账户需要预览/删除的素材

- 方法：`POST`
- 路径：`/api/material-preview/analyze`

### 请求体

```json
{
  "userId": "admin",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
  "aadvid": "380892546610362",
  "dramaName": "某部剧"
}
```

### 返回

```json
{
  "code": 0,
  "message": "分析完成",
  "data": {
    "totalAds": 12,
    "filteredAds": 3,
    "needPreviewCount": 2,
    "needDeleteCount": 1,
    "canDeletePromotionsCount": 0,
    "needPreview": [],
    "needDelete": [],
    "canDeletePromotions": []
  }
}
```

## 9. 直接执行单个账户的预览

- 方法：`POST`
- 路径：`/api/material-preview/execute`

### 请求体

```json
{
  "userId": "admin",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
  "aadvid": "380892546610362",
  "dramaName": "某部剧",
  "delayMs": 400
}
```

### 返回

```json
{
  "code": 0,
  "message": "预览完成",
  "data": {
    "previewCount": 2,
    "success": 2,
    "failed": 0
  }
}
```

## 10. 清理单个账户的问题素材/广告

- 方法：`POST`
- 路径：`/api/material-preview/cleanup`

### 请求体

```json
{
  "userId": "admin",
  "channelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
  "aadvid": "380892546610362",
  "dramaName": "某部剧",
  "deleteAds": true
}
```

### 返回

```json
{
  "code": 0,
  "message": "停用预览完成",
  "data": {
    "deletedMaterialsCount": 1,
    "deletedMaterialsSuccess": 1,
    "deletedMaterialsFailed": 0,
    "deletedAdsCount": 0,
    "deletedAdsSuccess": 0,
    "deletedAdsFailed": 0
  }
}
```

## 调用建议

- 定时运行场景优先用：
  - `start`
  - `stop`
  - `status`
  - `trigger`
- 调试单个广告账户时优先用：
  - `analyze`
  - `execute`
  - `cleanup`
- 如果你只是想验证当前渠道配置是否可跑，优先用 `execute-once`，这样不会创建长期定时器。
