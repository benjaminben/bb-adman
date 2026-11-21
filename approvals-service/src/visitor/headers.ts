// spec/approvals-service.md "Headers on every page". Each reply's header set is fixed here, so
// one test can compare each whole.
import type { Html } from './html'

const PAGE_CSP =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; " +
  "frame-ancestors 'none'; base-uri 'none'"

// A plain text page loads nothing at all.
const TEXT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

function common(request: Request, type: string, csp: string): Headers {
  const headers = new Headers({
    'Content-Type': type,
    'Content-Security-Policy': csp,
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

export function pageHeaders(request: Request): Headers {
  return common(request, 'text/html; charset=utf-8', PAGE_CSP)
}

export function textHeaders(request: Request): Headers {
  return common(request, 'text/plain; charset=utf-8', TEXT_CSP)
}

export function stylesheetHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/css; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=3600',
  })
}

export function pageReply(request: Request, page: Html, status = 200): Response {
  return new Response(page.text, { status, headers: pageHeaders(request) })
}

// Every write ends in a 303 back to a page of the same link.
export function redirect(request: Request, location: string, cookie?: string): Response {
  const headers = pageHeaders(request)
  headers.set('Location', location)
  if (cookie !== undefined) headers.set('Set-Cookie', cookie)
  return new Response(null, { status: 303, headers })
}
