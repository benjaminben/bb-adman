// spec/approvals-service.md "Headers on replies from the catch-all" and spec/approvals-gallery.md
// "The page policy and nonce". Each header set is fixed here, so one test can compare each whole.
import { Slug, VariantKey } from '../contract'
import { NOTICES, type NoticeKey } from './notices'

// A plain text reply loads nothing at all.
const TEXT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

// 16 random bytes as base64: nothing that could end the policy's quoted part.
const NONCE = /^[A-Za-z0-9+/]{22}==$/

const REFUSED = 'This form could not be sent. Open the link again and try once more.'

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

export function textHeaders(request: Request): Headers {
  const headers = common(request)
  headers.set('Content-Type', 'text/plain; charset=utf-8')
  headers.set('Content-Security-Policy', TEXT_CSP)
  return headers
}

// The page policy: our own address and the nonce only. `dev` (true only under `next dev`) adds
// the two pieces its development tools need. This file reads no environment, so the default is
// the strict policy that `next start` and Vercel get.
export function pagePolicy(nonce: string, dev = false): string {
  if (!NONCE.test(nonce)) throw new TypeError('bad nonce')
  const script = `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ''}`
  const style = `style-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-inline'" : ''}`
  return (
    `default-src 'none'; ${script}; ${style}; img-src 'self'; font-src 'self'; ` +
    "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; " +
    "object-src 'none'"
  )
}

// The page header set; Next.js sets the page's own Content-Type.
export function pageHeaders(request: Request, nonce: string, dev = false): Headers {
  const headers = common(request)
  headers.set('Content-Security-Policy', pagePolicy(nonce, dev))
  return headers
}

export function textReply(request: Request, text: string, status = 200): Response {
  return new Response(text, { status, headers: textHeaders(request) })
}

export const notFound = (request: Request) => textReply(request, 'Not found.', 404)

// The 403 of "Forms that write".
export const refused = (request: Request) => textReply(request, REFUSED, 403)

// A picture reply (spec/approvals-service-visitor.md "Pictures"): the type comes from the sniff.
export function pictureHeaders(type: 'image/png' | 'image/jpeg'): Headers {
  return new Headers({
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=300',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
  })
}

// Every failure of the picture route: nothing in the body to tell one cause from another.
export const emptyNotFound = (request: Request) =>
  new Response(null, { status: 404, headers: textHeaders(request) })

export type RedirectOptions = { m?: NoticeKey; cookie?: string; variant?: string }

// Every redirect is a 303 back to the page of the same link. The address is built here from the
// slug, which must have the checked shape, a notice key and a variant key of the checked shape;
// never from request text.
export function redirect(request: Request, slug: string, options: RedirectOptions = {}): Response {
  if (!Slug.safeParse(slug).success) throw new TypeError('unchecked slug')
  const { m, variant } = options
  if (m !== undefined && !Object.hasOwn(NOTICES, m)) throw new TypeError('unknown notice')
  if (variant !== undefined && !VariantKey.safeParse(variant).success) {
    throw new TypeError('unchecked variant')
  }
  const query = m === undefined ? '' : `?m=${m}`
  const anchor = variant === undefined ? '' : `#v-${variant}`
  const headers = textHeaders(request)
  headers.set('Location', `/l/${slug}${query}${anchor}`)
  if (options.cookie !== undefined) headers.set('Set-Cookie', options.cookie)
  return new Response(null, { status: 303, headers })
}
