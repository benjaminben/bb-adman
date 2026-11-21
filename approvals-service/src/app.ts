// The router (spec/approvals-service.md "Folder and tooling"). `parts` holds what tests swap:
// the clock and the random byte source.
import type { z } from 'zod'
import {
  CampaignId,
  CreateLink,
  Gallery,
  NewPassword,
  PictureRenewals,
  ProjectId,
} from './contract'
import type { RandomBytes } from './crypto/random'
import type { Env } from './env'
import { checkKey } from './api/auth'
import { readJsonBody } from './api/body'
import { apiError } from './api/errors'
import { health } from './api/health'
import { createLink, removeLink, setPassword } from './api/links'
import { renewPictures, replaceGallery } from './api/gallery'
import { readLink } from './api/read'
import { visitorRoute } from './visitor/routes'

export type Parts = { now: () => number; random: RandomBytes }

export type ApiContext = {
  request: Request
  env: Env
  parts: Parts
  // The link's pair from the path, checked against the contract; null on routes without one.
  link: { projectId: string; campaignId: string } | null
  // The body as the route's contract schema parsed it (trimmed, lower-cased where it says so).
  body: unknown
}

export type ApiHandler = (ctx: ApiContext) => Promise<Response>

type ApiRoute = {
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: RegExp
  body?: z.ZodType
  handler: ApiHandler
}

const LINK = '^/api/v1/links/([^/]+)/([^/]+)'

const API_ROUTES: ApiRoute[] = [
  { name: 'health', method: 'GET', path: /^\/api\/v1\/health$/, handler: health },
  {
    name: 'create-link',
    method: 'POST',
    path: /^\/api\/v1\/links$/,
    body: CreateLink,
    handler: createLink,
  },
  { name: 'read-link', method: 'GET', path: new RegExp(`${LINK}$`), handler: readLink },
  {
    name: 'set-password',
    method: 'PUT',
    path: new RegExp(`${LINK}/password$`),
    body: NewPassword,
    handler: setPassword,
  },
  {
    name: 'replace-gallery',
    method: 'PUT',
    path: new RegExp(`${LINK}/gallery$`),
    body: Gallery,
    handler: replaceGallery,
  },
  {
    name: 'renew-pictures',
    method: 'PUT',
    path: new RegExp(`${LINK}/pictures$`),
    body: PictureRenewals,
    handler: renewPictures,
  },
  { name: 'delete-link', method: 'DELETE', path: new RegExp(`${LINK}$`), handler: removeLink },
]

function findRoute(request: Request, path: string) {
  for (const route of API_ROUTES) {
    const match = route.path.exec(path)
    if (match !== null && route.method === request.method) return { route, ids: match.slice(1) }
  }
  return null
}

// Checks 4 to 6, after the key check: the body, the contract, then the handler.
async function apiRoute(request: Request, env: Env, parts: Parts, path: string) {
  const found = findRoute(request, path)
  if (found === null) return apiError(404, 'not_found')
  const { route, ids } = found
  let body: unknown = undefined
  if (route.body !== undefined) {
    const read = await readJsonBody(request)
    if (!read.ok) return read.reply
    const parsed = route.body.safeParse(read.value)
    if (!parsed.success) return apiError(400, 'invalid_input')
    body = parsed.data
  }
  let link: ApiContext['link'] = null
  if (ids.length === 2) {
    const projectId = ProjectId.safeParse(ids[0])
    const campaignId = CampaignId.safeParse(ids[1])
    if (!projectId.success || !campaignId.success) return apiError(400, 'invalid_input')
    link = { projectId: projectId.data, campaignId: campaignId.data }
  }
  try {
    return await route.handler({ request, env, parts, link, body })
  } catch (error) {
    // spec "Logs": the route name and the error's name only.
    console.error(route.name, error instanceof Error ? error.name : 'unknown')
    return apiError(500, 'internal')
  }
}

export function createApp(env: Env, parts: Parts) {
  return {
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname
      if (path === '/api/v1' || path.startsWith('/api/v1/')) {
        const refused = await checkKey(request, env)
        if (refused !== null) return refused
        return apiRoute(request, env, parts, path)
      }
      return visitorRoute(request, env, parts)
    },
  }
}
