// Replies of the keyed API (spec/approvals-service.md "The keyed API", error body). A message
// is a fixed sentence per code: it never holds input, a stack or SQL text.
import type { z } from 'zod'
import type { ErrorCode } from '../contract'

export type Code = z.infer<typeof ErrorCode>

const MESSAGES: Record<Code, string> = {
  bad_request: 'The request was refused.',
  not_set_up: 'The approvals service has no key set up.',
  bad_key: 'The key is missing or wrong.',
  too_large: 'The request body is too large.',
  invalid_input: 'The request does not match the contract.',
  not_found: 'Not found.',
  link_exists: 'This campaign already has a link.',
  internal: 'The approvals service failed.',
}

// Every reply: no caching, no type sniffing, and no CORS header.
export function apiJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function apiError(status: number, code: Code): Response {
  return apiJson({ error: { code, message: MESSAGES[code] } }, status)
}

// The one stub handler: a route that answers this has no body yet (AP-1). Taking no argument,
// it fits a handler of any body type.
export const notBuilt = async (): Promise<Response> => apiError(404, 'not_found')
