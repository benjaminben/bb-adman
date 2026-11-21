// The router (spec/approvals-service.md "Folder and tooling"). `parts` holds what tests swap:
// the clock and the random byte source.
import { CreateLink, Gallery, NewPassword, PictureRenewals } from './contract'
import type { RandomBytes } from './crypto/random'
import type { Env } from './env'
import { checkKey } from './api/auth'
import { apiError } from './api/errors'
import { health } from './api/health'
import { createLink, removeLink, setPassword } from './api/links'
import {
  checkGalleryPictures,
  checkRenewalPictures,
  renewPictures,
  replaceGallery,
} from './api/gallery'
import { readLink } from './api/read'
import { bodyRoute, plainRoute, type ApiRoute } from './api/route'
import { VISITOR_ROUTES, visitorRoute, type VisitorRoute } from './visitor/routes'

export type Parts = { now: () => number; random: RandomBytes }

const LINK = '^/api/v1/links/([^/]+)/([^/]+)'

export const API_ROUTES: ApiRoute[] = [
  plainRoute({ name: 'health', method: 'GET', path: /^\/api\/v1\/health$/, handler: health }),
  bodyRoute({
    name: 'create-link',
    method: 'POST',
    path: /^\/api\/v1\/links$/,
    body: CreateLink,
    handler: createLink,
  }),
  plainRoute({ name: 'read-link', method: 'GET', path: new RegExp(`${LINK}$`), handler: readLink }),
  bodyRoute({
    name: 'set-password',
    method: 'PUT',
    path: new RegExp(`${LINK}/password$`),
    body: NewPassword,
    handler: setPassword,
  }),
  bodyRoute({
    name: 'replace-gallery',
    method: 'PUT',
    path: new RegExp(`${LINK}/gallery$`),
    body: Gallery,
    check: checkGalleryPictures,
    handler: replaceGallery,
  }),
  bodyRoute({
    name: 'renew-pictures',
    method: 'PUT',
    path: new RegExp(`${LINK}/pictures$`),
    body: PictureRenewals,
    check: checkRenewalPictures,
    handler: renewPictures,
  }),
  plainRoute({
    name: 'delete-link',
    method: 'DELETE',
    path: new RegExp(`${LINK}$`),
    handler: removeLink,
  }),
]

export type RouteTables = { api?: ApiRoute[]; visitor?: VisitorRoute[] }

// Checks 4 to 6, after the key check: the body, the contract, the route's check, the handler.
async function apiRoute(request: Request, env: Env, parts: Parts, routes: ApiRoute[]) {
  const path = new URL(request.url).pathname
  for (const route of routes) {
    const match = route.path.exec(path)
    if (match === null || route.method !== request.method) continue
    try {
      return await route.run(request, { env, parts }, match.slice(1))
    } catch (error) {
      // spec "Logs": the route name and the error's name only.
      console.error(route.name, error instanceof Error ? error.name : 'unknown')
      return apiError(500, 'internal')
    }
  }
  return apiError(404, 'not_found')
}

// `tables` lets a test run the router over its own routes.
export function createApp(env: Env, parts: Parts, tables: RouteTables = {}) {
  const api = tables.api ?? API_ROUTES
  const visitor = tables.visitor ?? VISITOR_ROUTES
  return {
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname
      if (path === '/api/v1' || path.startsWith('/api/v1/')) {
        const refused = await checkKey(request, env)
        if (refused !== null) return refused
        return apiRoute(request, env, parts, api)
      }
      return visitorRoute(request, env, parts, visitor)
    },
  }
}
