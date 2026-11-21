// The checks every MCP request passes before the MCP SDK sees it (SPEC 6.8, 5.1).
// Order: Origin, Host, token. A refusal names no header value, so nothing sent is echoed.
import type { IncomingHttpHeaders } from 'node:http'
import { bearerMatches } from './token'

export type Refusal = { status: 401 | 403; message: string }

export const ORIGIN_REFUSED = 'Requests from web pages are not accepted.'
export const HOST_REFUSED = 'This address is not accepted.'
export const TOKEN_REFUSED = 'A valid access token is needed.'

export function checkRequest(
  headers: IncomingHttpHeaders,
  opts: { port: number; token: string | null },
): Refusal | null {
  // Any Origin at all means a web page sent it (SPEC 6.8).
  if (headers.origin !== undefined) return { status: 403, message: ORIGIN_REFUSED }
  const allowed = [`127.0.0.1:${opts.port}`, `localhost:${opts.port}`]
  if (!allowed.includes(headers.host ?? '')) return { status: 403, message: HOST_REFUSED }
  if (!bearerMatches(headers.authorization, opts.token)) {
    return { status: 401, message: TOKEN_REFUSED }
  }
  return null
}
