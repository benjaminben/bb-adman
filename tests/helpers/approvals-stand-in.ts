// A stand-in for the approvals service (spec/phases/approvals.md "AP-6"): a Node http server on
// 127.0.0.1, on a port the system picks, that plays the keyed API of spec/approvals-service.md
// under the contract. It keeps links, galleries and sign-offs in memory, checks the key,
// records every request, and can be told to answer one request otherwise. It serves
// /adman-approvals/... from a folder it is given (the test picture store). Tests only.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { z } from 'zod'
import {
  CONTRACT_VERSION,
  CampaignId,
  CreateLink,
  Gallery,
  NewPassword,
  PictureRenewals,
  ProjectId,
  SERVICE_NAME,
  type LinkState as LinkStateSchema,
} from '@/shared/approvals/contract'

export type StandInRoute =
  | 'health'
  | 'createLink'
  | 'getLink'
  | 'setPassword'
  | 'replaceGallery'
  | 'renewPictures'
  | 'deleteLink'

// One answer in place of the route's own.
export type Once =
  | { status: number; json?: unknown }
  | { redirect: string; status?: number }
  // A 200 whose body is `json` (default a text) padded with spaces to this many bytes, so
  // only the size is wrong; with chunked: true it is sent with no Content-Length.
  | { oversized: number; json?: unknown; chunked?: true }
  | { wait: true } // takes the request and never answers

export type Seen = {
  route: StandInRoute | 'picture' | 'unknown'
  method: string
  path: string
  headers: http.IncomingHttpHeaders
  body: string
}

type LinkState = z.infer<typeof LinkStateSchema>
type Signoff = LinkState['signoffs'][number]
export type StandInLink = {
  slug: string
  campaignName: string
  password: string
  createdAt: string
  gallery: z.infer<typeof Gallery>['variants']
  signoffs: Signoff[]
  // How many times the password was set again, each ending every visitor session.
  sessionsEnded: number
}

export type ApprovalsStandIn = {
  origin: string
  port: number
  seen: Seen[]
  // TCP connections the server took, with or without a request in them.
  connections: () => number
  links: Map<string, StandInLink>
  // null plays a service with no key of its own (503 not_set_up).
  setKey(key: string | null): void
  once(route: StandInRoute, reply: Once): void
  plantSignoff(projectId: string, campaignId: string, signoff: Signoff): void
  close(): Promise<void>
}

const LETTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const slug = () => [...randomBytes(12)].map((b) => LETTERS.charAt(b % 62)).join('')
const now = () => new Date().toISOString()

type Answer = { status: number; json: unknown }
const error = (status: number, code: string): Answer => ({
  status,
  json: { error: { code, message: `Stand-in refusal: ${code}` } },
})

function routeOf(method: string, pathname: string): { route: StandInRoute; pair?: string } | null {
  if (method === 'GET' && pathname === '/api/v1/health') return { route: 'health' }
  if (method === 'POST' && pathname === '/api/v1/links') return { route: 'createLink' }
  const m = /^\/api\/v1\/links\/([^/]+)\/([^/]+)(\/password|\/gallery|\/pictures)?$/.exec(pathname)
  if (!m) return null
  const [, p = '', c = '', tail] = m
  if (!ProjectId.safeParse(p).success || !CampaignId.safeParse(c).success) return null
  const pair = `${p}/${c}`
  if (tail === undefined && method === 'GET') return { route: 'getLink', pair }
  if (tail === undefined && method === 'DELETE') return { route: 'deleteLink', pair }
  if (tail === '/password' && method === 'PUT') return { route: 'setPassword', pair }
  if (tail === '/gallery' && method === 'PUT') return { route: 'replaceGallery', pair }
  if (tail === '/pictures' && method === 'PUT') return { route: 'renewPictures', pair }
  return null
}

function stateOf(link: StandInLink): LinkState {
  return {
    slug: link.slug,
    campaignName: link.campaignName,
    createdAt: link.createdAt,
    variants: link.gallery.map((v) => ({
      variantKey: v.variantKey,
      version: v.version,
      pictureExpiresAt: v.pictureExpiresAt,
    })),
    signoffs: link.signoffs,
  }
}

function play(
  links: Map<string, StandInLink>,
  route: StandInRoute,
  pair: string | undefined,
  body: unknown,
): Answer {
  if (route === 'health')
    return { status: 200, json: { service: SERVICE_NAME, contract: CONTRACT_VERSION } }
  if (route === 'createLink') {
    const input = CreateLink.safeParse(body)
    if (!input.success) return error(400, 'invalid_input')
    const key = `${input.data.projectId}/${input.data.campaignId}`
    if (links.has(key)) return error(409, 'link_exists')
    const made = {
      slug: slug(),
      campaignName: input.data.campaignName,
      password: input.data.password,
    }
    links.set(key, { ...made, createdAt: now(), gallery: [], signoffs: [], sessionsEnded: 0 })
    return { status: 201, json: { slug: made.slug } }
  }
  const link = pair === undefined ? undefined : links.get(pair)
  if (!link || pair === undefined) return error(404, 'not_found')
  if (route === 'getLink') return { status: 200, json: stateOf(link) }
  if (route === 'deleteLink') {
    links.delete(pair)
    return { status: 200, json: {} }
  }
  if (route === 'setPassword') {
    const input = NewPassword.safeParse(body)
    if (!input.success) return error(400, 'invalid_input')
    link.password = input.data.password
    link.sessionsEnded += 1
    return { status: 200, json: {} }
  }
  if (route === 'replaceGallery') {
    const input = Gallery.safeParse(body)
    if (!input.success) return error(400, 'invalid_input')
    const keys = new Set(input.data.variants.map((v) => v.variantKey))
    link.campaignName = input.data.campaignName
    link.gallery = input.data.variants
    link.signoffs = link.signoffs.filter((s) => keys.has(s.variantKey))
    return { status: 200, json: { variants: input.data.variants.length } }
  }
  const input = PictureRenewals.safeParse(body)
  if (!input.success) return error(400, 'invalid_input')
  let renewed = 0
  for (const r of input.data.pictures) {
    const row = link.gallery.find((v) => v.variantKey === r.variantKey && v.version === r.version)
    if (!row) continue
    row.pictureUrl = r.pictureUrl
    row.pictureExpiresAt = r.pictureExpiresAt
    renewed += 1
  }
  return { status: 200, json: { renewed } }
}

function sendJson(res: http.ServerResponse, answer: Answer): void {
  const text = JSON.stringify(answer.json ?? {})
  res.writeHead(answer.status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  })
  res.end(text)
}

function playOnce(res: http.ServerResponse, reply: Once): void {
  if ('wait' in reply) return
  if ('redirect' in reply) {
    res.writeHead(reply.status ?? 302, { Location: reply.redirect, 'Content-Length': 0 })
    res.end()
    return
  }
  if ('oversized' in reply) {
    const text = JSON.stringify(reply.json ?? 'x')
    const body = text + ' '.repeat(Math.max(0, reply.oversized - Buffer.byteLength(text)))
    const length = reply.chunked ? {} : { 'Content-Length': Buffer.byteLength(body) }
    res.writeHead(200, { 'Content-Type': 'application/json', ...length })
    res.end(body)
    return
  }
  sendJson(res, { status: reply.status, json: reply.json })
}

// Only a file inside {pictures}/adman-approvals/, never through a link.
function servePicture(res: http.ServerResponse, pictures: string | undefined, pathname: string) {
  const root = pictures === undefined ? null : path.join(pictures, 'adman-approvals')
  const file = root === null ? null : path.join(root, decodeURIComponent(pathname.slice(17)))
  const inside = root !== null && file !== null && file.startsWith(root + path.sep)
  if (!inside || !fs.existsSync(file) || !fs.lstatSync(file).isFile()) {
    res.writeHead(404, { 'Content-Length': 0 })
    res.end()
    return
  }
  const bytes = fs.readFileSync(file)
  res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': bytes.byteLength })
  res.end(bytes)
}

export async function startApprovalsStandIn(
  opts: { key?: string | null; pictures?: string } = {},
): Promise<ApprovalsStandIn> {
  let key = opts.key === undefined ? 'made-up-approvals-key-for-the-stand-in-0001' : opts.key
  const seen: Seen[] = []
  const links = new Map<string, StandInLink>()
  const onces = new Map<StandInRoute, Once>()
  let connections = 0
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const method = req.method ?? ''
      const pathname = (req.url ?? '').split('?')[0] ?? ''
      const found = routeOf(method, pathname)
      const picture = method === 'GET' && pathname.startsWith('/adman-approvals/')
      const route = found?.route ?? (picture ? 'picture' : 'unknown')
      const text = Buffer.concat(chunks).toString('utf8')
      seen.push({ route, method, path: req.url ?? '', headers: req.headers, body: text })
      if (picture) return servePicture(res, opts.pictures, pathname)
      const reply = found ? onces.get(found.route) : undefined
      if (found && reply) {
        onces.delete(found.route)
        return playOnce(res, reply)
      }
      if (req.headers.origin !== undefined) return sendJson(res, error(403, 'bad_request'))
      if (key === null) return sendJson(res, error(503, 'not_set_up'))
      if (req.headers.authorization !== `Bearer ${key}`) return sendJson(res, error(401, 'bad_key'))
      if (!found) return sendJson(res, error(404, 'not_found'))
      const hasBody = method === 'POST' || method === 'PUT'
      if (hasBody && req.headers['content-type'] !== 'application/json') {
        return sendJson(res, error(415, 'bad_request'))
      }
      let body: unknown = undefined
      try {
        body = hasBody ? JSON.parse(text) : undefined
      } catch {
        return sendJson(res, error(400, 'invalid_input'))
      }
      sendJson(res, play(links, found.route, found.pair, body))
    })
  })
  server.on('connection', () => (connections += 1))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    seen,
    connections: () => connections,
    links,
    setKey: (k) => {
      key = k
    },
    once: (route, reply) => onces.set(route, reply),
    plantSignoff: (projectId, campaignId, signoff) => {
      links.get(`${projectId}/${campaignId}`)?.signoffs.push(signoff)
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
