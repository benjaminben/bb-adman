// spec/approvals-gallery.md "The page policy and nonce": a new nonce for each page request, put in
// the request's policy header so Next.js puts it on its own script and style tags. Nothing else:
// no session, no try count, no database. Those live in src/visitor/ only.
import { NextResponse, type NextRequest } from 'next/server'
import { Slug } from './src/contract'
import { isDev } from './src/server/env'
import { notFound, pageHeaders, pagePolicy } from './src/visitor/headers'

// One path part only; the API and the catch-all's routes never pass here.
export const config = { matcher: ['/l/:slug'] }

// The raw path, so a percent-encoded character never passes as a slug letter.
const PAGE = /^\/l\/([^/]*)$/

// 16 random bytes as base64: 22 letters and `==`.
function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export function proxy(request: NextRequest): Response {
  const slug = PAGE.exec(new URL(request.url).pathname)?.[1] ?? ''
  const method = request.method
  if ((method !== 'GET' && method !== 'HEAD') || !Slug.safeParse(slug).success) {
    return notFound(request)
  }
  const nonce = newNonce()
  const dev = isDev()
  const headers = new Headers(request.headers)
  // Next.js reads the nonce from these headers: never one the visitor chose.
  headers.delete('Content-Security-Policy')
  headers.delete('Content-Security-Policy-Report-Only')
  headers.delete('x-nonce')
  headers.set('Content-Security-Policy', pagePolicy(nonce, dev))
  const response = NextResponse.next({ request: { headers } })
  for (const [name, value] of pageHeaders(request, nonce, dev)) response.headers.set(name, value)
  return response
}
