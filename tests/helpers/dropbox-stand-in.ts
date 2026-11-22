// A stand-in for Dropbox's auth calls (spec/phases/phase-09-slices.md "P9-2"): a Node http server
// on 127.0.0.1, on a port the system picks. It plays /oauth2/token (both grants),
// /2/auth/token/revoke and /2/users/get_current_account, keeps its codes and tokens in memory,
// records every request, and can be told to answer the next request on a route otherwise.
// `standInFetch` keeps the real pin and sends the two Dropbox hosts here; `routes` lets a later
// helper (the file routes) add its own. Tests only: nothing here reaches Dropbox.
import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { DROPBOX_APP_KEY } from '@/shared/config/public-ids'
import type { DropboxFetch } from '@/main/providers/dropbox/fetch'
import { DROPBOX_REDIRECT_URI } from '@/main/providers/dropbox/hosts'
import { pinnedFetch } from '@/main/providers/dropbox/pinned-fetch'

export type DropboxRoute = 'token' | 'revoke' | 'account' | (string & {})

export type DropboxSeen = {
  host: string
  route: DropboxRoute | 'unknown'
  method: string
  path: string
  headers: http.IncomingHttpHeaders
  body: Buffer
}

export type Reply = {
  status: number
  json?: unknown
  text?: string
  headers?: http.OutgoingHttpHeaders
}

// One answer in place of the route's own.
export type Once =
  | Reply
  | { tag: string; status?: number } // an API error with this .tag chain ("path/not_found")
  | { oauthError: string; status?: number } // OAuth's { error } form
  | { slowMs: number } // the route's own answer, this late
  | { oversized: number; chunked?: true } // a 200 of this many bytes
  | { redirect: string; status?: number }

export type ExtraRoutes = (seen: DropboxSeen, standIn: DropboxStandIn) => Reply | undefined

export type DropboxStandIn = {
  origin: string
  seen: DropboxSeen[]
  accountName: string
  expiresIn: number
  // A code the token route accepts once; with a challenge, only with the matching verifier.
  issueCode(challenge?: string): string
  plantRefreshToken(): string
  isRevoked(refreshToken: string): boolean
  accessTokensOf(refreshToken: string): string[]
  refreshFor(accessToken: string): string | undefined
  once(route: DropboxRoute, reply: Once): void
  close(): Promise<void>
}

const token = (prefix: string) => `${prefix}${randomBytes(18).toString('base64url')}`
const json = (status: number, body: unknown): Reply => ({ status, json: body })
const tagged = (chain: string) =>
  chain
    .split('/')
    .reverse()
    .reduce<Record<string, unknown>>((inner, tag) => ({ '.tag': tag, [tag]: inner }), {})
const API_ROUTES: Record<string, DropboxRoute> = {
  '/oauth2/token': 'token',
  '/2/auth/token/revoke': 'revoke',
  '/2/users/get_current_account': 'account',
}
const AUTH_ROUTES = new Set<string>(Object.values(API_ROUTES))

function plantedReply(once: Once): Reply | undefined {
  if ('tag' in once) {
    const body = { error_summary: `${once.tag}/...`, error: tagged(once.tag) }
    return json(once.status ?? 409, body)
  }
  if ('oauthError' in once) return json(once.status ?? 400, { error: once.oauthError })
  if ('redirect' in once)
    return { status: once.status ?? 302, headers: { location: once.redirect } }
  if ('status' in once) return once
  return undefined
}

export async function startDropboxStandIn(routes?: ExtraRoutes): Promise<DropboxStandIn> {
  const codes = new Map<string, string | null>()
  const refreshTokens = new Set<string>()
  const revoked = new Set<string>()
  const access = new Map<string, string>()
  const planted = new Map<DropboxRoute, Once>()

  function newAccess(refresh: string): string {
    const value = token('sl.stand-in-access-')
    access.set(value, refresh)
    return value
  }

  function bearer(seen: DropboxSeen): string | undefined {
    const value = /^Bearer (\S+)$/.exec(seen.headers.authorization ?? '')?.[1]
    const refresh = value ? access.get(value) : undefined
    return refresh && !revoked.has(refresh) ? refresh : undefined
  }

  function tokenRoute(seen: DropboxSeen): Reply {
    const form = new URLSearchParams(seen.body.toString())
    if (form.get('client_id') !== DROPBOX_APP_KEY) return json(400, { error: 'invalid_client' })
    if (form.has('client_secret')) return json(400, { error: 'invalid_request' })
    const grant = form.get('grant_type')
    const invalid = json(400, { error: 'invalid_grant', error_description: 'invalid or revoked' })
    if (grant === 'refresh_token') {
      const refresh = form.get('refresh_token') ?? ''
      if (!refreshTokens.has(refresh) || revoked.has(refresh)) return invalid
      const reply = {
        access_token: newAccess(refresh),
        token_type: 'bearer',
        expires_in: standIn.expiresIn,
      }
      return json(200, reply)
    }
    if (grant !== 'authorization_code') return json(400, { error: 'unsupported_grant_type' })
    const code = form.get('code') ?? ''
    const verifier = form.get('code_verifier') ?? ''
    if (!codes.has(code) || form.get('redirect_uri') !== DROPBOX_REDIRECT_URI || !verifier)
      return invalid
    const challenge = codes.get(code)
    codes.delete(code)
    if (challenge && createHash('sha256').update(verifier).digest('base64url') !== challenge)
      return invalid
    const refresh = standIn.plantRefreshToken()
    const reply = {
      access_token: newAccess(refresh),
      token_type: 'bearer',
      expires_in: standIn.expiresIn,
      refresh_token: refresh,
      scope: 'files.content.read files.content.write files.metadata.read',
      uid: '12345',
      account_id: 'dbid:stand-in-account',
    }
    return json(200, reply)
  }

  function ownReply(seen: DropboxSeen): Reply {
    if (seen.method !== 'POST') return json(405, { error: 'method' })
    if (seen.route === 'token') return tokenRoute(seen)
    const refresh = bearer(seen)
    if (!refresh)
      return json(401, {
        error_summary: 'invalid_access_token/',
        error: tagged('invalid_access_token'),
      })
    if (seen.route === 'revoke') {
      revoked.add(refresh)
      return { status: 200, text: 'null', headers: { 'content-type': 'application/json' } }
    }
    const name = { display_name: standIn.accountName, given_name: 'Ann', surname: 'Example' }
    return json(200, { account_id: 'dbid:stand-in-account', name, email: 'ann@example.com' })
  }

  function routeOf(host: string, path: string): DropboxRoute | 'unknown' {
    if (host === 'api.dropboxapi.com' && API_ROUTES[path]) return API_ROUTES[path]
    return path.startsWith('/2/') ? path.slice(3) : 'unknown'
  }

  function routeReply(seen: DropboxSeen): Reply {
    if (AUTH_ROUTES.has(seen.route)) return ownReply(seen)
    return routes?.(seen, standIn) ?? json(404, { error: 'unknown' })
  }

  async function answer(seen: DropboxSeen, res: http.ServerResponse): Promise<void> {
    const once = planted.get(seen.route)
    planted.delete(seen.route)
    if (once && 'oversized' in once) {
      const body = Buffer.alloc(once.oversized, 0x20)
      res.writeHead(200, once.chunked ? {} : { 'content-length': body.length })
      res.end(body)
      return
    }
    if (once && 'slowMs' in once) await new Promise((r) => setTimeout(r, once.slowMs))
    const reply = (once && plantedReply(once)) ?? routeReply(seen)
    const body = reply.json !== undefined ? JSON.stringify(reply.json) : (reply.text ?? '')
    const type = reply.json !== undefined ? { 'content-type': 'application/json' } : {}
    if (!res.destroyed) res.writeHead(reply.status, { ...type, ...reply.headers }).end(body)
  }

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const host = String(req.headers['x-stand-in-host'] ?? '')
      const path = new URL(req.url ?? '/', 'http://stand-in').pathname
      const seen: DropboxSeen = {
        host,
        route: routeOf(host, path),
        method: req.method ?? '',
        path,
        headers: req.headers,
        body: Buffer.concat(chunks),
      }
      standIn.seen.push(seen)
      void answer(seen, res)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  const standIn: DropboxStandIn = {
    origin: `http://127.0.0.1:${port}`,
    seen: [],
    accountName: 'Ann Example',
    expiresIn: 14_400,
    issueCode(challenge) {
      const code = token('stand-in-code-')
      codes.set(code, challenge ?? null)
      return code
    },
    plantRefreshToken() {
      const refresh = token('stand-in-refresh-')
      refreshTokens.add(refresh)
      return refresh
    },
    isRevoked: (refresh) => revoked.has(refresh),
    accessTokensOf: (refresh) => [...access].filter(([, r]) => r === refresh).map(([a]) => a),
    refreshFor: (accessToken) => access.get(accessToken),
    once: (route, reply) => void planted.set(route, reply),
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
  return standIn
}

// The real pin, then the two Dropbox hosts sent to the stand-in, the host named in a header.
export function standInFetch(standIn: DropboxStandIn): DropboxFetch {
  const toStandIn: typeof fetch = (input, init) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    headers.set('x-stand-in-host', url.hostname)
    return fetch(`${standIn.origin}${url.pathname}`, { ...init, headers })
  }
  return pinnedFetch(toStandIn)
}
