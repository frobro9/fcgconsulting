import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings } from './types'

const COOKIE = 'fcg_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

type Payload = { u: string; exp: number }

const enc = new TextEncoder()

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return new Uint8Array(sig)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function makeToken(username: string, secret: string): Promise<string> {
  const payload: Payload = { u: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE }
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)))
  const sig = b64urlEncode(await hmac(body, secret))
  return `${body}.${sig}`
}

async function verifyToken(token: string, secret: string): Promise<Payload | null> {
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let expected: Uint8Array
  try {
    expected = await hmac(body, secret)
  } catch {
    return null
  }
  let given: Uint8Array
  try {
    given = b64urlDecode(sig)
  } catch {
    return null
  }
  if (!timingSafeEqual(expected, given)) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Payload
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function validCredentials(env: Bindings, username: string, password: string): boolean {
  // Length guard keeps the XOR comparison meaningful; values come from secrets.
  const u = username === env.ADMIN_USERNAME
  const p = password === env.ADMIN_PASSWORD
  return u && p
}

export async function startSession(
  c: Context<{ Bindings: Bindings }>,
  username: string,
): Promise<void> {
  const token = await makeToken(username, c.env.SESSION_SECRET)
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export function endSession(c: Context<{ Bindings: Bindings }>): void {
  deleteCookie(c, COOKIE, { path: '/' })
}

/** Redirects to /login when there is no valid session cookie. */
export const requireAuth: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  const token = getCookie(c, COOKIE)
  const payload = token ? await verifyToken(token, c.env.SESSION_SECRET) : null
  if (!payload) return c.redirect('/login')
  c.set('user' as never, payload.u as never)
  await next()
}

export async function hasValidSession(c: Context<{ Bindings: Bindings }>): Promise<boolean> {
  const token = getCookie(c, COOKIE)
  return !!(token && (await verifyToken(token, c.env.SESSION_SECRET)))
}
