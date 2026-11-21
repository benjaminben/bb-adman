// spec/approvals-service.md "Headers on replies from the catch-all" and spec/approvals-gallery.md
// "The page policy and nonce". Each header set is fixed here, so one test can compare each whole.
import type { Html } from './html'

const HTML_CSP =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; " +
  "frame-ancestors 'none'; base-uri 'none'"

// A plain text reply loads nothing at all.
const TEXT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

// The headers every visitor reply shares, without Content-Type or the policy.
function common(request: Request): Headers {
  const headers = new Headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  })
  if (new URL(request.url).protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000')
  }
  return headers
}

function withType(request: Request, type: string, csp: string): Headers {
  const headers = common(request)
  headers.set('Content-Type', type)
  headers.set('Content-Security-Policy', csp)
  return headers
}

export function textHeaders(request: Request): Headers {
  return withType(request, 'text/plain; charset=utf-8', TEXT_CSP)
}

// The page policy: our own address and the nonce only. `dev` (true only under `next dev`) adds
// the two pieces its development tools need. This file reads no environment, so the default is
// the strict policy that `next start` and Vercel get.
export function pagePolicy(nonce: string, dev = false): string {
  const script = `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ''}`
  const style = `style-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-inline'" : ''}`
  return (
    `default-src 'none'; ${script}; ${style}; img-src 'self'; font-src 'self'; ` +
    "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; " +
    "object-src 'none'"
  )
}

// The page header set; Next.js sets the page's own Content-Type.
export function pageHeaders(request: Request, nonce: string): Headers {
  const headers = common(request)
  headers.set('Content-Security-Policy', pagePolicy(nonce))
  return headers
}

export function textReply(request: Request, text: string, status = 200): Response {
  return new Response(text, { status, headers: textHeaders(request) })
}

export const notFound = (request: Request) => textReply(request, 'Not found.', 404)

export function stylesheetHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/css; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=3600',
  })
}

export function htmlReply(request: Request, page: Html, status = 200): Response {
  return new Response(page.text, { status, headers: htmlHeaders(request) })
}

function htmlHeaders(request: Request): Headers {
  return withType(request, 'text/html; charset=utf-8', HTML_CSP)
}

// Every redirect is a 303 back to a page of the same link, built from the checked slug.
export function redirect(request: Request, location: string, cookie?: string): Response {
  const headers = htmlHeaders(request)
  headers.set('Location', location)
  if (cookie !== undefined) headers.set('Set-Cookie', cookie)
  return new Response(null, { status: 303, headers })
}
