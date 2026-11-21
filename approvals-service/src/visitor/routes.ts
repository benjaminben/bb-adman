// The visitor's routes (spec/approvals-service.md "Visitor pages"). Every handler is a stub
// answering "Not found." until AP-3 and AP-4 give them bodies.
import type { Parts } from '../app'
import type { Env } from '../env'

export type VisitorContext = {
  request: Request
  env: Env
  parts: Parts
  // The path's captured parts, in order: slug, then variant key and version, or sign-off ID.
  params: string[]
}

type VisitorHandler = (ctx: VisitorContext) => Promise<Response>

type VisitorRoute = { method: 'GET' | 'POST'; path: RegExp; handler: VisitorHandler }

export function notFound(): Response {
  return new Response('Not found.', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

const stub: VisitorHandler = async () => notFound()

const SLUG = '([0-9A-Za-z]{12})'

const ROUTES: VisitorRoute[] = [
  { method: 'GET', path: new RegExp(`^/l/${SLUG}$`), handler: stub },
  { method: 'POST', path: new RegExp(`^/l/${SLUG}/enter$`), handler: stub },
  { method: 'POST', path: new RegExp(`^/l/${SLUG}/signoffs$`), handler: stub },
  {
    method: 'POST',
    path: new RegExp(`^/l/${SLUG}/signoffs/([0-9A-Za-z]{24})/remove$`),
    handler: stub,
  },
  { method: 'POST', path: new RegExp(`^/l/${SLUG}/leave$`), handler: stub },
  {
    method: 'GET',
    path: new RegExp(`^/l/${SLUG}/p/([23456789abcdefghjkmnpqrstuvwxyz]{6})/([0-9]{1,16})$`),
    handler: stub,
  },
  { method: 'GET', path: /^\/gallery\.css$/, handler: stub },
  { method: 'GET', path: /^\/robots\.txt$/, handler: stub },
]

// Anything else, or a slug of the wrong shape: the plain 404 page.
export async function visitorRoute(request: Request, env: Env, parts: Parts): Promise<Response> {
  const path = new URL(request.url).pathname
  for (const route of ROUTES) {
    const match = route.path.exec(path)
    if (match === null || route.method !== request.method) continue
    return route.handler({ request, env, parts, params: match.slice(1) })
  }
  return notFound()
}
