⸻

一、基础约束（固定配置）

在 Koa2 项目中集成常读分销平台时，统一约定以下固定配置（后续如需改成环境变量再调整）：

// src/config/changdu.ts

/\*\*

- 常读开放平台基础配置
  \*/
  export const CHANGDU_BASE_URL =
  'https://openapi.changdupingtai.com/novelsale/openapi';

/\*\*

- 渠道 distributor_id（固定）
  \*/
  export const CHANGDU_DISTRIBUTOR_ID = '1842865091654731';

/\*\*

- 渠道 secret_key（固定）
  \*/
  export const CHANGDU_SECRET_KEY = 't05gPUR5ke8zyihAj9AlSNsarEJzCDzC';

后续所有与常读相关的签名逻辑，一律从这里取配置。

⸻

二、签名规则（统一规范）

所有常读 OpenAPI 请求统一使用以下签名规则：

sign = lower_case(
md5(distributor_id + secret_key + ts + params_value)
)

    •	distributor_id：固定为 "1842865091654731"
    •	secret_key：固定为 "t05gPUR5ke8zyihAj9AlSNsarEJzCDzC"
    •	ts：秒级时间戳（Number），例如：Math.floor(Date.now() / 1000)
    •	params_value：根据 请求方法不同，有不同计算方式（见下面三节）

生成出的 sign 通过 HTTP 头传递：
• header-sign: sign
• header-ts: ts（字符串）

⸻

三、GET 请求的 params_value 计算规则

针对所有 GET 请求（包括后续新增接口），params_value 一律按以下规则计算：1. 取要发送给常读的 query 参数对象（必须包含 distributor_id）；2. 对参数的 key 按字典序升序排序；3. 只取排序后的 value，不拼 key；4. 每个 value 后面拼接一个竖线 |；5. 保留最后一个 |，不要裁掉。

该行为需与文档中的 Python 示例保持一致。

约定提供的工具函数（仅定义规则，真正调用处按需使用）：

// src/utils/changduSign.ts 中的一部分

/\*\*

- 构造 GET 请求的 params_value
- 1.  对 key 升序排序
- 2.  只拼接 value
- 3.  每个 value 后面拼接一个 '|'，并保留最后一个 '|'
      \*/
      export function buildChangduGetParamsValue(
      params: Record<string, any>,
      ): string {
      const sortedKeys = Object.keys(params).sort(); // 升序
      let paramsValue = '';

for (const key of sortedKeys) {
const value = params[key];
paramsValue += String(value) + '|';
}

return paramsValue;
}

在真正实现 GET 请求时，Koa 侧只要保证：
• 传给这个函数的 params 与最终发送给常读的 query 一致；
• 包含 distributor_id（默认为固定值，特殊场景可覆盖）。

⸻

四、POST 请求的 params_value 计算规则

针对所有 POST 请求，params_value 一律按以下规则计算：1. 取要发送给常读的 JSON 请求体对象（必须包含 distributor_id）；2. 直接对该对象执行 JSON.stringify；3. 不做额外处理，不剔除空值、不手工排序 key；4. 注意：字段插入顺序尽量稳定（定义对象时就写好 key 顺序）。

工具函数约定：

/\*\*

- 构造 POST 请求的 params_value：
- 直接 JSON.stringify(body)
- 要求：body 与实际请求体一致，并包含 distributor_id
  \*/
  export function buildChangduPostParamsValue(
  body: Record<string, any>,
  ): string {
  return JSON.stringify(body);
  }

在实现具体 POST 接口时，只要保证：
• body 与请求体完全一致；
• distributor_id 写入 body 中（默认使用固定配置）。

⸻

五、签名生成与头部构造（通用规则）

统一在一个工具文件中封装以下“规范动作”（这里只定义规则，不强制具体调用位置）：

import crypto from 'crypto';
import {
CHANGDU_DISTRIBUTOR_ID,
CHANGDU_SECRET_KEY,
} from '../config/changdu';

/\*\*

- 生成小写 md5
  \*/
  function md5Lower(str: string): string {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toLowerCase();
  }

/\*\*

- 秒级时间戳
  \*/
  export function getChangduTimestamp(): number {
  return Math.floor(Date.now() / 1000);
  }

/\*\*

- 通用 sign 生成：
- sign = lower_case(md5(distributor_id + secret_key + ts + params_value))
-
- distributor_id / secret_key 默认用固定配置，如需特殊渠道，可显式传入覆盖
  \*/
  export function buildChangduSign(
  ts: number,
  paramsValue: string,
  distributorId: string = CHANGDU_DISTRIBUTOR_ID,
  secretKey: string = CHANGDU_SECRET_KEY,
  ): string {
  const raw = `${distributorId}${secretKey}${ts}${paramsValue}`;
  return md5Lower(raw);
  }

/\*\*

- 生成常读请求所需的 header：
- - header-sign
- - header-ts
-
- 注意：函数只负责“算头部”，不发请求。
  \*/
  export function buildChangduHeaders(paramsValue: string, ts?: number) {
  const timestamp = ts ?? getChangduTimestamp();
  const sign = buildChangduSign(timestamp, paramsValue);

return {
sign,
ts: timestamp,
headers: {
'header-sign': sign,
'header-ts': String(timestamp),
},
};
}

约定：
• 所有与常读相关的 Koa 中间层/Service 只要需要调用常读 API，就必须通过这些工具函数生成 params_value 和 header-sign / header-ts；
• 工具本身不负责发请求，只负责「签名规则实现」。

⸻

六、返回结构与错误码（仅告知规则，不写实现）

常读所有接口统一返回结构：

{
"code": 200,
"message": "OK",
"has_more": false,
"next_offset": 10,
"result": [ /* ... */ ]
}

    •	code：业务返回码
    •	message：提示信息
    •	has_more / next_offset：分页相关
    •	result：具体数据结构由各接口定义

错误码语义（供上层统一处理策略使用）：

code 说明 建议处理逻辑
200 OPENAPI_OK 成功，无需额外处理
410 distributor_id 无效 提示渠道无效，建议与商务确认合作状态
411 sign 错误 优先检查签名计算（参数顺序、params_value 计算等）；如无误，联系商务确认密钥
412 timestamp 不合法 检查 ts 是否为秒级时间戳、服务端时间是否严重偏差
413 功能已停用 提示能力停用，引导使用对应公众号能力
500 访问速度过快 降低 QPS，控制单个接口调用频率 ≤ 1 QPS
501 内部错误 支持有限次重试，如持续大面积失败，需对接常读研发

Koa 层或 Service 层在对接时，可以基于 code 做统一判断和日志，本说明只定义语义规则，不要求在此处实现具体处理函数。

⸻

七、给 Cursor 的总结指令（一句话版）

在 Koa2 项目中，围绕 CHANGDU_DISTRIBUTOR_ID = "1842865091654731" 与 CHANGDU_SECRET_KEY = "t05gPUR5ke8zyihAj9AlSNsarEJzCDzC"，实现一套独立的签名工具模块 src/utils/changduSign.ts，严格按上述「GET/POST 的 params_value 计算规则 + 通用 sign 公式 + header 生成规范」产出 header-sign 和 header-ts，该模块不负责任何 HTTP 请求发送，只提供签名规则能力，供后续 Service / 路由在调用常读 OpenAPI 时复用。
