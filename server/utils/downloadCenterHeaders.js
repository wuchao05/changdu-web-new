import { DEFAULT_USER_AGENT } from '../config/headers.js'
import { getDefaultDownloadCenterConfig } from './studioData.js'

function normalizeString(value, fallback = '') {
  return String(value || fallback).trim()
}

export async function resolveDownloadCenterRequestHeaders(baseHeaders = {}) {
  const normalizedHeaders = {
    appid: normalizeString(baseHeaders.appid || baseHeaders.Appid),
    apptype: normalizeString(baseHeaders.apptype || baseHeaders.Apptype, '7'),
    distributorid: normalizeString(baseHeaders.distributorid || baseHeaders.Distributorid),
    Cookie: normalizeString(baseHeaders.Cookie),
    Aduserid: normalizeString(baseHeaders.Aduserid || baseHeaders.aduserid),
    Rootaduserid: normalizeString(baseHeaders.Rootaduserid || baseHeaders.rootaduserid),
    'User-Agent': normalizeString(
      baseHeaders['User-Agent'] || baseHeaders['user-agent'],
      DEFAULT_USER_AGENT
    ),
  }

  const defaultDownloadCenterConfig = await getDefaultDownloadCenterConfig()
  if (!defaultDownloadCenterConfig) {
    return normalizedHeaders
  }

  return {
    ...normalizedHeaders,
    appid: normalizeString(defaultDownloadCenterConfig.appId, normalizedHeaders.appid),
    apptype: '7',
    distributorid: normalizeString(
      defaultDownloadCenterConfig.distributorId,
      normalizedHeaders.distributorid
    ),
    Aduserid: normalizeString(defaultDownloadCenterConfig.adUserId, normalizedHeaders.Aduserid),
    Rootaduserid: normalizeString(
      defaultDownloadCenterConfig.rootAdUserId,
      normalizedHeaders.Rootaduserid
    ),
    Cookie: normalizeString(defaultDownloadCenterConfig.cookie, normalizedHeaders.Cookie),
  }
}
