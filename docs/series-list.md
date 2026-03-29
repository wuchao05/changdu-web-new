⸻

2.33 短剧列表接口

接口信息
• 接口名称：短剧列表
• 请求地址

https://www.changdupingtai.com/novelsale/openapi/content/series/list/v1/

    •	请求方式：GET

⸻

请求参数

Query 参数

参数名 类型 是否必须 说明
distributor_id int64 必须 分销商标识
page_index int32 必须 页码，不允许超过 1000
page_size int32 必须 每页数量大小，不允许超过 100
query string 可选 搜索内容，目前仅支持 短剧 ID，传入其他内容将报错
gender int16 可选 短剧性别筛选：0 = 女频，1 = 男频
creation_status int16 可选 短剧连载状态：0 = 完结，1 = 连载中
permission_statuses string 可选 授权类型筛选（可多选，逗号分隔），例如 "3,4"2 = 无授权3 = 独家授权4 = 普通授权
delivery_status int16 可选 投放状态筛选：0 = 不可投放1 = 可投放2 = 即将下架

⸻

Header 参数

参数名 类型 是否必须 说明
header-ts string 是 秒级时间戳
header-sign string 是 签名结果，使用 1.2.1 签名升级中的 GET 加签方式

⸻

返回结果

返回结构

{
"code": 200,
"message": "success",
"total": 123,
"data": []
}

⸻

返回字段说明

字段名 类型 说明
code int64 接口状态码（200 表示成功，其它表示异常）
message string 接口状态描述
total int64 短剧总数量
data list<SeriesItem> 短剧列表

⸻

data 列表元素结构（SeriesItem）

1️⃣ series_info（短剧基础信息）

字段名 类型 说明
thumb_url string 短剧封面 URL
original_thumb_url string 原始封面 URL（未处理原图）
series_name string 短剧名称
creation_status int16 连载状态
category string 分类 ID，逗号分隔（如 "1,3"）
category_text string 分类名称，逗号分隔（如 "悬疑,都市"）
episode_amount int32 总集数
book_id string 短剧唯一标识 ID
permission_status int64 授权状态：2 = 无授权3 = 独家授权4 = 普通授权
publish_time string 分销首发时间（yyyy-MM-dd HH:mm:ss）
first_visible_time string 书城首次可见时间
expect_publish_time string 预估可投时间
premiere_time string 免费短剧首发时间
delivery_status int 投放状态：0 = 不可投放，1 = 可投放，2 = 即将下架
wx_is_reject bool 微信场景审核是否被拒
wx_audit_status int64 微信审核状态：0 = 默认，1 = 待送审，2 = 审核中，3 = 审核通过，4 = 审核不通过
dy_audit_status json 抖音审核状态（同微信枚举）
dy_free_audit_status json 抖音免费短剧审核状态
amount_limit_status json 新剧保护状态：1 = 生效中2 = 保护过期3 = 未开启
album_id_dy string 抖音平台短剧 ID（仅抖音场景）
book_tags list<int64> 短剧标签：1 = 拆集剧

⸻

2️⃣ media_config（定价相关配置）

⚠️ 仅在特定体裁下生效，多余体裁字段可忽略。

字段名 类型 说明
media_config_type int64 付费墙类型：1 = 付费网文2 = 付费短剧3 = 免费短剧4 = 免费网文

⸻

3️⃣ book_paywall（网文付费配置）

长篇多章网文

字段名 类型 说明
thousand_words_price int64 千字价格（分）
start_chapter int64 起始付费章节

短篇整本网文

字段名 类型 说明
total_price int64 整本价格（分）
start_percentage int64 起始付费进度（百分比）

短篇多章网文

字段名 类型 说明
short_thousand_words_price int64 千字价格（分）
short_start_chapter int64 起始付费章节

⸻

4️⃣ series_paywall（短剧付费配置）

字段名 类型 说明
unit_price int64 单集价格（分）
start_chapter int64 起始付费剧集

⸻

5️⃣ free_series_paywall（免费短剧配置）

字段名 类型 说明
ad_episode int64 起始解锁剧集

⸻

6️⃣ free_book_paywall（免费网文配置）

字段名 类型 说明
ad_episode int64 长篇多章起始解锁章节
ad_word_number int64 短篇整本起始解锁字数
short_book_ad_episode int64 短篇多章起始解锁章节

⸻

7️⃣ 定价扩展字段（书籍维度）

字段名 类型 说明
price_changed bool 是否存在书籍级别自定义定价
unit_price int64 单集价格（分）
start_chapter int64 起始付费剧集
ad_episode int64 起始解锁剧集
ad_word_number int64 起始解锁字数
short_book_ad_episode int64 起始解锁章节

说明：
• price_changed = false 时，表示未设置书籍维度定价，返回的是 渠道全局定价；
• price_changed = true 时，应优先使用书籍维度定价。

⸻
