// The visitor's routes (spec/approvals-service.md "Visitor pages"). The sign-off, remove and
// picture routes are stubs answering "Not found." until AP-4 gives them bodies.
import type { Parts } from '../app'
import type { Env } from '../env'
import { enterLink, leaveLink, openGallery } from './actions'
import { galleryPage } from './gallery-page'
import { htmlReply, notFound, redirect, stylesheetHeaders, textReply } from './headers'
import { passwordPage, refusedPage } from './password-page'
import { STYLES } from './styles'

export type VisitorContext = {
  request: Request
  env: Env
  parts: Parts
  // The path's captured parts, in order: slug, then variant key and version, or sign-off ID.
  params: string[]
}

export type VisitorHandler = (ctx: VisitorContext) => Promise<Response>

export type VisitorRoute = {
  name: string
  method: 'GET' | 'POST'
  path: RegExp
  handler: VisitorHandler
}

// The fixed reply to an unexpected failure, with the plain text headers.
const failed = (request: Request) =>
  textReply(request, 'Something went wrong. Try again later.', 500)

const stub: VisitorHandler = async ({ request }) => notFound(request)

// The logic is in actions.ts; these handlers only render its results.
const gallery: VisitorHandler = async ({ request, env, parts, params }) => {
  const slug = params[0] ?? ''
  const result = await openGallery(env.DB, request, slug, parts.now())
  if (result.kind === 'password') return htmlReply(request, passwordPage(slug, false))
  return htmlReply(request, galleryPage(result))
}

// Wrong password, unknown slug and too many tries all get this one reply.
const enter: VisitorHandler = async ({ request, env, parts, params }) => {
  const slug = params[0] ?? ''
  const result = await enterLink(env.DB, request, slug, parts)
  if (result.kind === 'refused') return htmlReply(request, refusedPage(), 403)
  if (result.kind === 'failed') return htmlReply(request, passwordPage(slug, true))
  return redirect(request, result.location, result.cookie)
}

const leave: VisitorHandler = async ({ request, env, parts, params }) => {
  const result = await leaveLink(env.DB, request, params[0] ?? '', parts.now())
  if (result.kind === 'refused') return htmlReply(request, refusedPage(), 403)
  return redirect(request, result.location, result.cookie)
}

const stylesheet: VisitorHandler = async () =>
  new Response(STYLES, { headers: stylesheetHeaders() })

const robots: VisitorHandler = async ({ request }) =>
  textReply(request, 'User-agent: *\nDisallow: /\n')

const SLUG = '([0-9A-Za-z]{12})'
const VARIANT = '([23456789abcdefghjkmnpqrstuvwxyz]{6})'

export const VISITOR_ROUTES: VisitorRoute[] = [
  { name: 'gallery', method: 'GET', path: new RegExp(`^/l/${SLUG}$`), handler: gallery },
  { name: 'enter', method: 'POST', path: new RegExp(`^/l/${SLUG}/enter$`), handler: enter },
  { name: 'sign-off', method: 'POST', path: new RegExp(`^/l/${SLUG}/signoffs$`), handler: stub },
  {
    name: 'remove-sign-off',
    method: 'POST',
    path: new RegExp(`^/l/${SLUG}/signoffs/([0-9A-Za-z]{24})/remove$`),
    handler: stub,
  },
  { name: 'leave', method: 'POST', path: new RegExp(`^/l/${SLUG}/leave$`), handler: leave },
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
  return notFound(request)
}
