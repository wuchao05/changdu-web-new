import crypto from 'crypto'
import { CHANGDU_DISTRIBUTOR_ID, CHANGDU_SECRET_KEY } from '../config/changdu.js'

/**
 * 生成小写 md5
 * @param {string} str - 待加密字符串
 * @returns {string} 小写 md5 值
 */
function md5Lower(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toLowerCase()
}

/**
 * 秒级时间戳
 * @returns {number} 秒级时间戳
 */
export function getChangduTimestamp() {
  return Math.floor(Date.now() / 1000)
}

/**
 * 构造 GET 请求的 params_value
 * 1. 对 key 升序排序
 * 2. 只拼接 value
 * 3. 每个 value 后面拼接一个 '|'，并保留最后一个 '|'
 *
 * @param {Record<string, any>} params - 请求参数对象
 * @returns {string} params_value
 */
export function buildChangduGetParamsValue(params) {
  const sortedKeys = Object.keys(params).sort() // 升序
  let paramsValue = ''

  for (const key of sortedKeys) {
    const value = params[key]
    paramsValue += String(value) + '|'
  }

  return paramsValue
}

/**
 * 构造 POST 请求的 params_value：
 * 直接 JSON.stringify(body)
 * 要求：body 与实际请求体一致，并包含 distributor_id
 *
 * @param {Record<string, any>} body - 请求体对象
 * @returns {string} params_value
 */
export function buildChangduPostParamsValue(body) {
  return JSON.stringify(body)
}

/**
 * 通用 sign 生成：
 * sign = lower_case(md5(distributor_id + secret_key + ts + params_value))
 *
 * distributor_id / secret_key 默认用固定配置，如需特殊渠道，可显式传入覆盖
 *
 * @param {number} ts - 秒级时间戳
 * @param {string} paramsValue - params_value
 * @param {string} [distributorId] - 渠道 ID（可选，默认使用固定配置）
 * @param {string} [secretKey] - 密钥（可选，默认使用固定配置）
 * @returns {string} sign
 */
export function buildChangduSign(
  ts,
  paramsValue,
  distributorId = CHANGDU_DISTRIBUTOR_ID,
  secretKey = CHANGDU_SECRET_KEY
) {
  const raw = `${distributorId}${secretKey}${ts}${paramsValue}`
  return md5Lower(raw)
}

/**
 * 生成常读请求所需的 header：
 * - header-sign
 * - header-ts
 *
 * 注意：函数只负责"算头部"，不发请求。
 *
 * @param {string} paramsValue - params_value
 * @param {number} [ts] - 秒级时间戳（可选，默认自动生成）
 * @param {string} [distributorId] - 渠道 ID（可选，默认固定）
 * @param {string} [secretKey] - 密钥（可选，默认固定）
 * @returns {{ sign: string, ts: number, headers: { 'header-sign': string, 'header-ts': string } }}
 */
export function buildChangduHeaders(paramsValue, ts, distributorId, secretKey) {
  const timestamp = ts ?? getChangduTimestamp()
  const sign = buildChangduSign(timestamp, paramsValue, distributorId, secretKey)

  return {
    sign,
    ts: timestamp,
    headers: {
      'header-sign': sign,
      'header-ts': String(timestamp),
    },
  }
}

/**
 * 便捷方法：为 GET 请求生成完整的签名头部
 * 自动计算 params_value 并生成 header-sign / header-ts
 *
 * @param {Record<string, any>} params - 请求参数对象（必须包含 distributor_id）
 * @param {number} [ts] - 秒级时间戳（可选）
 * @param {string} [distributorId] - 渠道 ID（可选，默认固定）
 * @param {string} [secretKey] - 密钥（可选，默认固定）
 * @returns {{ sign: string, ts: number, headers: { 'header-sign': string, 'header-ts': string } }}
 */
export function buildChangduGetHeaders(params, ts, distributorId, secretKey) {
  const paramsValue = buildChangduGetParamsValue(params)
  return buildChangduHeaders(paramsValue, ts, distributorId, secretKey)
}

/**
 * 便捷方法：为 POST 请求生成完整的签名头部
 * 自动计算 params_value 并生成 header-sign / header-ts
 *
 * @param {Record<string, any>} body - 请求体对象（必须包含 distributor_id）
 * @param {number} [ts] - 秒级时间戳（可选）
 * @param {string} [distributorId] - 渠道 ID（可选，默认固定）
 * @param {string} [secretKey] - 密钥（可选，默认固定）
 * @returns {{ sign: string, ts: number, headers: { 'header-sign': string, 'header-ts': string } }}
 */
export function buildChangduPostHeaders(body, ts, distributorId, secretKey) {
  const paramsValue = buildChangduPostParamsValue(body)
  return buildChangduHeaders(paramsValue, ts, distributorId, secretKey)
}
