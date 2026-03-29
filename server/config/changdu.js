/**
 * 常读开放平台基础配置
 */
export const CHANGDU_BASE_URL = 'https://openapi.changdupingtai.com/novelsale/openapi'

/**
 * 渠道 distributor_id（固定）
 */
export const CHANGDU_DISTRIBUTOR_ID = '1842865091654731'

/**
 * 渠道 secret_key（固定）
 */
export const CHANGDU_SECRET_KEY = 't05gPUR5ke8zyihAj9AlSNsarEJzCDzC'

const CHANGDU_EXTRA_SECRET_KEY_MAP = {
  [CHANGDU_DISTRIBUTOR_ID]: CHANGDU_SECRET_KEY,
  '1844565955364887': 'H53iZltmBXDndYt5ONW2h6tgCUxbG7kX',
}

export function getChangduSecretKey(distributorId) {
  return CHANGDU_EXTRA_SECRET_KEY_MAP[distributorId] || CHANGDU_SECRET_KEY
}
