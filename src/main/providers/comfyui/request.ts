// SPEC 6.10.2 (security class): how every ComfyUI request is sent. Used only by client.ts,
// whose functions are the only callers and pass constant paths. The request is an options
// object for http.request or https.request, built from the parsed origin; the client's own
// Agent, made with no proxy; the checked lookup; fixed headers; certificate checks on. A 3xx
// is never followed; the byte and time limits stop the read.
import http from 'node:http'
import https from 'node:https'
import { isRefusedHost } from '../../../shared/comfy/refused-hosts'
import type { ProviderErrorReason } from '../../../shared/schemas/queries/app'
import { ProviderFailure } from '../types'
import { CONNECT_MS } from './limits'
import { AddressRefused, checkedLookup } from './lookup'

export type Connection = {
  secure: boolean
  hostname: string
  port: number
  agent: http.Agent
  ownPorts: () => readonly number[]
}

export type Call = {
  method: 'GET' | 'POST'
  path: string
  accept: string
  body?: { type: string; bytes: Uint8Array }
  maxBytes: number
  totalMs: number
  // The reason for an answer the app cannot use: too large, or the wrong shape.
  badAnswer: ProviderErrorReason
  // A status whose answer is read as a refusal, even when it is over the limit (SPEC 14 1.43 K-1).
  refusedStatus?: number
}

export type Answer = { status: number; bytes: Buffer }

const CERTIFICATE_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_UNTRUSTED',
  'CERT_REVOKED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
])

// No detail holds the address (SPEC 6.10.1): every one is a fixed text.
export function failure(
  kind: 'other' | 'offline',
  reason: ProviderErrorReason | undefined,
  detail: string,
): ProviderFailure {
  return new ProviderFailure({ kind, ...(reason && { reason }), detail })
}

function noAnswer(detail: string): ProviderFailure {
  return failure('offline', 'no_answer', detail)
}

function fromError(error: unknown): ProviderFailure {
  if (error instanceof AddressRefused) {
    return failure('other', 'address_refused', 'The resolved address is refused')
  }
  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && CERTIFICATE_CODES.has(code)) {
    return failure('other', 'certificate', `The certificate could not be checked (${code})`)
  }
  const shown = typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? code : 'unknown'
  return noAnswer(`Could not reach the server (${shown})`)
}

export function openConnection(origin: string, ownPorts: () => readonly number[]): Connection {
  const url = new URL(origin)
  const secure = url.protocol === 'https:'
  const port = Number(url.port) || (secure ? 443 : 80)
  // keepAlive off: a fresh socket for each request, so its connect event is always seen.
  const agent = secure
    ? new https.Agent({ keepAlive: false, rejectUnauthorized: true })
    : new http.Agent({ keepAlive: false })
  return { secure, hostname: url.hostname.replace(/^\[(.*)\]$/, '$1'), port, agent, ownPorts }
}

export function send(conn: Connection, call: Call): Promise<Answer> {
  // The typed host, checked again with the ports as they are now. A literal address is not
  // passed to the lookup, so this is its connection-time check.
  if (isRefusedHost(conn.hostname, conn.port, conn.ownPorts())) {
    return Promise.reject(failure('other', 'address_refused', 'The address is refused'))
  }
  return new Promise((resolve, reject) => {
    let settled = false
    let answered = false
    const headers: Record<string, string> = { Accept: call.accept, 'User-Agent': 'Adman' }
    if (call.body) {
      headers['Content-Type'] = call.body.type
      headers['Content-Length'] = String(call.body.bytes.byteLength)
    }
    const req = (conn.secure ? https : http).request({
      protocol: conn.secure ? 'https:' : 'http:',
      hostname: conn.hostname,
      port: conn.port,
      path: call.path,
      method: call.method,
      headers,
      agent: conn.agent,
      lookup: checkedLookup(conn.port, conn.ownPorts),
      ...(conn.secure && { rejectUnauthorized: true }),
    })
    const settle = (outcome: ProviderFailure | Answer) => {
      if (settled) return
      settled = true
      if (outcome instanceof ProviderFailure) reject(outcome)
      else resolve(outcome)
    }
    const stop = (outcome: ProviderFailure) => {
      settle(outcome)
      req.destroy()
    }
    setTimeout(() => {
      if (!answered) stop(noAnswer('No answer within the connect wait'))
    }, CONNECT_MS).unref()
    setTimeout(() => stop(noAnswer('The call went over its time limit')), call.totalMs).unref()
    req.on('error', (error) => settle(fromError(error)))
    req.on('close', () => settle(noAnswer('The connection closed before the answer ended')))
    // Nothing is written until the connection is made and, for https, the certificate passed.
    req.once('socket', (socket) => {
      socket.once(conn.secure ? 'secureConnect' : 'connect', () => req.end(call.body?.bytes))
    })
    req.on('response', (res) => {
      answered = true
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400) {
        return stop(failure('other', 'redirect_refused', `HTTP ${status}, not followed`))
      }
      if (status === 401 || status === 403 || status === 407) {
        return stop(failure('other', 'sign_in_needed', `HTTP ${status}`))
      }
      // At the refused status, an answer over the limit is a refusal with no body.
      const tooLarge = () => {
        if (status !== call.refusedStatus) {
          return stop(failure('other', call.badAnswer, 'The answer is over its size limit'))
        }
        settle({ status, bytes: Buffer.alloc(0) })
        req.destroy()
      }
      if (Number(res.headers['content-length']) > call.maxBytes) return tooLarge()
      const chunks: Buffer[] = []
      let count = 0
      res.on('data', (chunk: Buffer) => {
        count += chunk.byteLength
        if (count > call.maxBytes) return tooLarge()
        chunks.push(chunk)
      })
      res.on('end', () => settle({ status, bytes: Buffer.concat(chunks) }))
      res.on('error', () => settle(noAnswer('The answer broke off')))
    })
  })
}
