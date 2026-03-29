import crypto from 'crypto'
import { findUserByAccount, findUserByToken, readUser, writeUser } from './studioData.js'

const AUTH_HEADER_NAME = 'x-studio-token'

function createToken() {
  return crypto.randomBytes(24).toString('hex')
}

function extractToken(ctx) {
  const customToken = ctx.get(AUTH_HEADER_NAME)
  if (customToken) {
    return customToken.trim()
  }

  const authorization = ctx.get('authorization')
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return ''
}

export async function loginWithAccount(account, password) {
  const user = await findUserByAccount(account)
  if (!user || user.password !== password) {
    return null
  }

  const nextUser = {
    ...user,
    authToken: createToken(),
    updatedAt: new Date().toISOString(),
  }

  await writeUser(nextUser)
  return nextUser
}

export async function logoutSession(ctx) {
  const token = extractToken(ctx)
  if (!token) return

  const user = await findUserByToken(token)
  if (!user) return

  await writeUser({
    ...user,
    authToken: '',
    updatedAt: new Date().toISOString(),
  })
}

export async function getSessionUser(ctx) {
  const token = extractToken(ctx)
  if (!token) return null

  const user = await findUserByToken(token)
  if (!user) return null

  try {
    return await readUser(user.id)
  } catch {
    return null
  }
}

export async function requireSession(ctx, next) {
  const user = await getSessionUser(ctx)
  if (!user) {
    ctx.status = 401
    ctx.body = {
      code: 401,
      message: '未登录或登录已失效',
    }
    return
  }

  ctx.state.sessionUser = user
  await next()
}

export async function requireAdmin(ctx, next) {
  const user = await getSessionUser(ctx)
  if (!user) {
    ctx.status = 401
    ctx.body = {
      code: 401,
      message: '未登录或登录已失效',
    }
    return
  }

  if (user.userType !== 'admin') {
    ctx.status = 403
    ctx.body = {
      code: 403,
      message: '仅管理员可访问',
    }
    return
  }

  ctx.state.sessionUser = user
  await next()
}
