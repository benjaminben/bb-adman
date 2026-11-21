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

export type VisitorRoute = {
  name: string
  method: 'GET' | 'POST'
  path: RegExp
  handler: VisitorHandler
}

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

// The fixed reply to an unexpected failure. The headers are the fixed set of "Headers on every
// page" that suits a plain text page; AP-3 moves this onto its header helper (adding HSTS).
function failed(): Response {
  return new Response('Something went wrong. Try again later.', {
    status: 500,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

const stub: VisitorHandler = async () => notFound()

const SLUG = '([0-9A-Za-z]{12})'
const VARIANT = '([23456789abcdefghjkmnpqrstuvwxyz]{6})'

export const VISITOR_ROUTES: VisitorRoute[] = [
  { name: 'gallery', method: 'GET', path: new RegExp(`^/l/${SLUG}$`), handler: stub },
  { name: 'enter', method: 'POST', path: new RegExp(`^/l/${SLUG}/enter$`), handler: stub },
  { name: 'sign-off', method: 'POST', path: new RegExp(`^/l/${SLUG}/signoffs$`), handler: stub },
  {
    name: 'remove-sign-off',
    method: 'POST',
    path: new RegExp(`^/l/${SLUG}/signoffs/([0-9A-Za-z]{24})/remove$`),
    handler: stub,
  },
  { name: 'leave', method: 'POST', path: new RegExp(`^/l/${SLUG}/leave$`), handler: stub },
  {
    name: 'picture',
    method: 'GET',
    path: new RegExp(`^/l/${SLUG}/p/${VARIANT}/([0-9]{1,16})$`),
    handler: stub,
  },
  { name: 'stylesheet', method: 'GET', path: /^\/gallery\.css$/, handler: stub },
  { name: 'robots', method: 'GET', path: /^\/robots\.txt$/, handler: stub },
]

// Anything else, or a slug of the wrong shape: the plain 404 page.
export async function visitorRoute(
  request: Request,
  env: Env,
  parts: Parts,
  routes: VisitorRoute[] = VISITOR_ROUTES,
): Promise<Response> {
  const path = new URL(request.url).pathname
  for (const route of routes) {
    const match = route.path.exec(path)
    if (match === null || route.method !== request.method) continue
    try {
      return await route.handler({ request, env, parts, params: match.slice(1) })
    } catch (error) {
      // spec "Logs": the route name and the error's name only; never the slug.
      console.error(route.name, error instanceof Error ? error.name : 'unknown')
      return failed()
    }
  }
  return notFound()
}
