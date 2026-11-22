// The visitor's routes (spec/approvals-service.md "Visitor routes and logic"). Every reply is
// plain text, a 303 or a picture; the gallery page itself comes in AP-16.
import type { Parts } from '../app'
import type { Env } from '../env'
import { enterLink, leaveLink, saveReviewer } from './actions'
import { clipRoute } from './clip-route'
import { notFound, redirect, refused, textReply } from './headers'
import { pictureRoute } from './picture-route'
import { clearedReviewerCookie } from './reviewer'
import { removeSignoff, signOff } from './signoffs'

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

// The logic is in actions.ts; these handlers only turn its results into replies. The slug is
// the path's, already of the SLUG shape, and redirect checks it again.
// Wrong password, unknown slug and too many tries all get this one reply.
const enter: VisitorHandler = async ({ request, env, parts, params }) => {
  const slug = params[0] ?? ''
  const result = await enterLink(env.DB, request, slug, parts)
  if (result.kind === 'refused') return refused(request)
  if (result.kind === 'failed') return redirect(request, slug, { m: 'wrong-password' })
  // A new entry starts with no saved reviewer email, so a later person on a shared browser
  // never signs off under an earlier person's email.
  return redirect(request, slug, { cookies: [result.cookie, clearedReviewerCookie(slug)] })
}

const leave: VisitorHandler = async ({ request, env, parts, params }) => {
  const slug = params[0] ?? ''
  const result = await leaveLink(env.DB, request, slug, parts.now())
  if (result.kind === 'refused') return refused(request)
  return redirect(request, slug, { cookies: result.cookies })
}

const reviewer: VisitorHandler = async ({ request, env, parts, params }) => {
  const slug = params[0] ?? ''
  const result = await saveReviewer(env.DB, request, slug, parts.now())
  if (result.kind === 'refused') return refused(request)
  if (result.kind === 'bad-email') return redirect(request, slug, { m: 'bad-email' })
  return redirect(request, slug, { m: 'email-saved', cookies: [result.cookie] })
}

const signOffRoute: VisitorHandler = async ({ request, env, parts, params }) => {
  const slug = params[0] ?? ''
  const result = await signOff(env.DB, request, slug, parts)
  if (result.kind === 'refused') return refused(request)
  return redirect(request, slug, { m: result.m, variant: result.variant, cookies: result.cookies })
}

const removeRoute: VisitorHandler = async ({ request, env, parts, params }) => {
  const [slug = '', id = ''] = params
  const result = await removeSignoff(env.DB, request, slug, id, parts.now())
  if (result.kind === 'refused') return refused(request)
  return redirect(request, slug, { m: result.m, variant: result.variant })
}

const robots: VisitorHandler = async ({ request }) =>
  textReply(request, 'User-agent: *\nDisallow: /\n')

const SLUG = '([0-9A-Za-z]{12})'
const VARIANT = '([23456789abcdefghjkmnpqrstuvwxyz]{6})'

export const VISITOR_ROUTES: VisitorRoute[] = [
  { name: 'enter', method: 'POST', path: new RegExp(`^/l/${SLUG}/enter$`), handler: enter },
  {
    name: 'sign-off',
    method: 'POST',
    path: new RegExp(`^/l/${SLUG}/signoffs$`),
    handler: signOffRoute,
  },
  {
    name: 'remove-sign-off',
    method: 'POST',
    path: new RegExp(`^/l/${SLUG}/signoffs/([0-9A-Za-z]{24})/remove$`),
    handler: removeRoute,
  },
  {
    name: 'reviewer',
    method: 'POST',
    path: new RegExp(`^/l/${SLUG}/reviewer$`),
    handler: reviewer,
  },
  { name: 'leave', method: 'POST', path: new RegExp(`^/l/${SLUG}/leave$`), handler: leave },
  {
    name: 'picture',
    method: 'GET',
    path: new RegExp(`^/l/${SLUG}/p/${VARIANT}/([0-9]{1,16})$`),
    handler: pictureRoute,
  },
  {
    name: 'clip',
    method: 'GET',
    path: new RegExp(`^/l/${SLUG}/c/${VARIANT}/([0-9]{1,16})$`),
    handler: clipRoute,
  },
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
