export const DJDATA_CONFIG = {
  baseUrl: process.env.DJDATA_API_BASE_URL || 'https://api.djdata.nvnrnyt.cn',
  accessToken: '41dbc-9af49-2b061-a3880-7fafc-f6af1-4f961-e81fd',
  advertiserType: process.env.DJDATA_ADVERTISER_TYPE || 'juliang',
  advertiserPageSize: Number(process.env.DJDATA_ADVERTISER_PAGE_SIZE || 20),
  uploadAssetType: Number(process.env.DJDATA_UPLOAD_ASSET_TYPE || 3),
  uploadType: process.env.DJDATA_UPLOAD_TYPE || 'juliang',
  uploadActionType: process.env.DJDATA_UPLOAD_ACTION_TYPE || 'UPLOAD_BY_FILE',
  uploadPwd: 'ssrgfd54ytgtrj86s4',
  uploadPlatform: process.env.DJDATA_UPLOAD_PLATFORM || 'playlet',
}
