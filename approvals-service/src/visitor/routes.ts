// The visitor's routes (spec/approvals-service.md "Visitor pages"). The sign-off, remove and
// picture routes are stubs answering "Not found." until AP-4 gives them bodies.
import type { Parts } from '../app'
import type { Env } from '../env'
import { pageReply, stylesheetHeaders, textHeaders } from './headers'
import { passwordPage } from './password-page'
import { STYLES } from './styles'

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

// The fixed reply to an unexpected failure, with the plain text page headers.
function failed(request: Request): Response {
  return new Response('Something went wrong. Try again later.', {
    status: 500,
    headers: textHeaders(request),
  })
}

const stub: VisitorHandler = async () => notFound()

const gallery: VisitorHandler = async ({ request, params }) =>
  pageReply(request, passwordPage(params[0] ?? '', false))

const stylesheet: VisitorHandler = async () =>
  new Response(STYLES, { headers: stylesheetHeaders() })

const robots: VisitorHandler = async ({ request }) =>
  new Response('User-agent: *\nDisallow: /\n', { headers: textHeaders(request) })

const SLUG = '([0-9A-Za-z]{12})'
const VARIANT = '([23456789abcdefghjkmnpqrstuvwxyz]{6})'

export const VISITOR_ROUTES: VisitorRoute[] = [
  { name: 'gallery', method: 'GET', path: new RegExp(`^/l/${SLUG}$`), handler: gallery },
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
  { name: 'stylesheet', method: 'GET', path: /^\/gallery\.css$/, handler: stylesheet },
  { name: 'robots', method: 'GET', path: /^\/robots\.txt$/, handler: robots },
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
      return failed(request)
    }
  }
  return notFound()
}
