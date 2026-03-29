# 管理员资源查询接口

本文档说明当前项目对外可用的管理员资源查询接口，主要用于获取：

- 用户列表
- 用户详情
- 渠道列表
- 渠道详情

这些接口都属于管理员接口，统一挂在 `/api/admin` 下。

## 鉴权说明

所有接口都要求：

- 已登录
- 登录账号为管理员

请求头至少需要携带：

```http
X-Studio-Token: <管理员登录后拿到的 token>
```

如果你的调用链路本身已经维护了当前渠道，也可以额外传：

```http
X-Studio-Channel-Id: <channelId>
```

说明：

- 这 4 个接口本身不依赖 `X-Studio-Channel-Id` 做资源过滤。
- 但如果你的外部系统已经统一带这个头，可以继续保留，不影响接口返回。

## 通用返回格式

成功时：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

失败时常见返回：

```json
{
  "code": 401,
  "message": "未登录或登录已失效"
}
```

```json
{
  "code": 403,
  "message": "仅管理员可访问"
}
```

```json
{
  "code": 404,
  "message": "用户不存在"
}
```

或：

```json
{
  "code": 404,
  "message": "渠道不存在"
}
```

## 1. 获取用户列表

- 方法：`GET`
- 路径：`/api/admin/users`
- 路径参数：无
- 查询参数：无

### 请求示例

```bash
curl -X GET "http://localhost:3000/api/admin/users" \
  -H "X-Studio-Token: <管理员Token>"
```

### 返回说明

`data` 为用户数组，每一项都包含基础用户信息，以及便于外部系统直接展示的渠道名称字段。

### 成功返回示例

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "admin",
      "nickname": "管理员",
      "account": "admin",
      "userType": "admin",
      "channelIds": [
        "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df"
      ],
      "defaultChannelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
      "channelConfigs": {
        "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df": {
          "feishu": {
            "dramaListTableId": "tblxxxx",
            "dramaStatusTableId": "tblyyyy",
            "accountTableId": "tblzzzz"
          },
          "materialPreview": {
            "enabled": false,
            "intervalMinutes": 20,
            "buildTimeWindowStart": 90,
            "buildTimeWindowEnd": 20
          },
          "douyinMaterialMatches": []
        }
      },
      "feishu": {
        "dramaListTableId": "tblxxxx",
        "dramaStatusTableId": "tblyyyy",
        "accountTableId": "tblzzzz"
      },
      "createdAt": "2026-03-26T13:32:12.621Z",
      "updatedAt": "2026-03-27T10:24:11.785Z",
      "channelNames": [
        "默认渠道"
      ],
      "defaultChannelName": "默认渠道"
    }
  ]
}
```

### 字段说明

- `id`: 用户 ID
- `nickname`: 用户昵称
- `account`: 登录账号
- `userType`: 用户类型，取值为 `admin` 或 `normal`
- `channelIds`: 用户可访问的渠道 ID 列表
- `defaultChannelId`: 默认渠道 ID
- `channelConfigs`: 用户在各渠道下的业务配置
- `channelConfigs[channelId].feishu`: 该用户在指定渠道下的飞书表配置
- `channelConfigs[channelId].materialPreview`: 该用户在指定渠道下的素材预览配置
- `channelConfigs[channelId].douyinMaterialMatches`: 该用户在指定渠道下的抖音匹配素材配置
- `feishu`: 当前默认渠道下的飞书配置快照
- `channelNames`: 可访问渠道名称列表
- `defaultChannelName`: 默认渠道名称

## 2. 获取用户详情

- 方法：`GET`
- 路径：`/api/admin/users/:id`
- 路径参数：
  - `id`: 用户 ID
- 查询参数：无

### 请求示例

```bash
curl -X GET "http://localhost:3000/api/admin/users/admin" \
  -H "X-Studio-Token: <管理员Token>"
```

### 成功返回示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "admin",
    "nickname": "管理员",
    "account": "admin",
    "userType": "admin",
    "channelIds": [
      "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df"
    ],
    "defaultChannelId": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
    "channelConfigs": {
      "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df": {
        "feishu": {
          "dramaListTableId": "tblxxxx",
          "dramaStatusTableId": "tblyyyy",
          "accountTableId": "tblzzzz"
        },
        "materialPreview": {
          "enabled": false,
          "intervalMinutes": 20,
          "buildTimeWindowStart": 90,
          "buildTimeWindowEnd": 20
        },
        "douyinMaterialMatches": []
      }
    },
    "feishu": {
      "dramaListTableId": "tblxxxx",
      "dramaStatusTableId": "tblyyyy",
      "accountTableId": "tblzzzz"
    },
    "createdAt": "2026-03-26T13:32:12.621Z",
    "updatedAt": "2026-03-27T10:24:11.785Z",
    "channelNames": [
      "默认渠道"
    ],
    "defaultChannelName": "默认渠道"
  }
}
```

### 失败返回示例

```json
{
  "code": 404,
  "message": "用户不存在"
}
```

## 3. 获取渠道列表

- 方法：`GET`
- 路径：`/api/admin/channels`
- 路径参数：无
- 查询参数：无

### 请求示例

```bash
curl -X GET "http://localhost:3000/api/admin/channels" \
  -H "X-Studio-Token: <管理员Token>"
```

### 成功返回示例

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
      "name": "默认渠道",
      "juliang": {
        "cookie": "",
        "buildConfig": {
          "secretKey": "",
          "source": "",
          "productId": "",
          "productPlatformId": "",
          "landingUrl": "",
          "microAppName": "",
          "microAppId": "",
          "ccId": "",
          "rechargeTemplateId": ""
        }
      },
      "changdu": {
        "secretKey": "",
        "cookie": "",
        "distributorId": "",
        "adUserId": "",
        "rootAdUserId": "",
        "appId": ""
      },
      "adx": {
        "cookie": ""
      },
      "createdAt": "2026-03-26T13:32:12.621Z",
      "updatedAt": "2026-03-27T10:24:11.785Z"
    }
  ]
}
```

### 字段说明

- `id`: 渠道 ID
- `name`: 渠道名称
- `juliang`: 巨量相关配置
- `changdu`: 常读相关配置
- `adx`: ADX 相关配置
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

## 4. 获取渠道详情

- 方法：`GET`
- 路径：`/api/admin/channels/:id`
- 路径参数：
  - `id`: 渠道 ID
- 查询参数：无

### 请求示例

```bash
curl -X GET "http://localhost:3000/api/admin/channels/5f0d85e6-26a0-4fe2-a0c5-30c78a8770df" \
  -H "X-Studio-Token: <管理员Token>"
```

### 成功返回示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "5f0d85e6-26a0-4fe2-a0c5-30c78a8770df",
    "name": "默认渠道",
    "juliang": {
      "cookie": "",
      "buildConfig": {
        "secretKey": "",
        "source": "",
        "productId": "",
        "productPlatformId": "",
        "landingUrl": "",
        "microAppName": "",
        "microAppId": "",
        "ccId": "",
        "rechargeTemplateId": ""
      }
    },
    "changdu": {
      "secretKey": "",
      "cookie": "",
      "distributorId": "",
      "adUserId": "",
      "rootAdUserId": "",
      "appId": ""
    },
    "adx": {
      "cookie": ""
    },
    "createdAt": "2026-03-26T13:32:12.621Z",
    "updatedAt": "2026-03-27T10:24:11.785Z"
  }
}
```

### 失败返回示例

```json
{
  "code": 404,
  "message": "渠道不存在"
}
```

## 调用建议

- 外部系统如果只是同步基础资料，优先调用列表接口，再按需调用详情接口。
- 如果外部系统只需要单条资源，请直接调用详情接口，避免先拉全量列表再本地过滤。
- 当前接口默认返回完整配置对象，包含业务配置字段；如果你后面需要“脱敏版”或“轻量版”响应，可以再补单独接口。
