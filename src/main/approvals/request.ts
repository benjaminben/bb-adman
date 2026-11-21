// How every request to the approvals service is sent (spec/approvals.md "The service client",
// security class). Used only by client.ts, which passes constant paths with checked IDs.
// - The saved origin is checked again with parseApprovalsAddress at each call; host and port
//   come only from it.
// - Node's https (http only for the dev-tools test origin), with a new Agent of its own made
//   with no proxy option, keepAlive off and certificate checks on, so no proxy or TLS setting
//   from the environment applies.
// - The key goes only into the Authorization header. No Origin, Referer or Cookie is sent.
// - Nothing is written until the socket is connected (for https, the certificate passed).
// - A 3xx is never followed. The whole request has a time limit; the reply is read with a cap.
import http from 'node:http'
import https from 'node:https'
import { parseApprovalsAddress } from '@/shared/approvals/address'
import { approvalsRefusal } from '@/shared/approvals/messages'
import { ApprovalsFailure } from './failure'

export type Target = {
  origin: string
  key: string
  allowLocalHttp: boolean
  totalMs: number
  maxBytes: number
}

export type Call = { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown }

export type Answer = { status: number; bytes: Buffer }

// A bearer token is printable ASCII with no space, so it cannot break the header.
const KEY_SHAPE = /^[\x21-\x7e]{1,4096}$/

export function send(target: Target, call: Call): Promise<Answer> {
  const origin = parseApprovalsAddress(target.origin, { allowLocalHttp: target.allowLocalHttp })
  if (origin === null) return Promise.reject(approvalsRefusal('approvals_not_set_up'))
  if (!KEY_SHAPE.test(target.key)) return Promise.reject(new ApprovalsFailure('bad_key'))
  const url = new URL(origin)
  const secure = url.protocol === 'https:'
  const body = call.body === undefined ? null : Buffer.from(JSON.stringify(call.body), 'utf8')
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Adman',
    Authorization: `Bearer ${target.key}`,
    ...(body && { 'Content-Type': 'application/json', 'Content-Length': String(body.byteLength) }),
  }
  const agent = secure
    ? new https.Agent({ keepAlive: false, rejectUnauthorized: true })
    : new http.Agent({ keepAlive: false })
  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (outcome: ApprovalsFailure | Answer) => {
      if (settled) return
      settled = true
      if (outcome instanceof ApprovalsFailure) reject(outcome)
      else resolve(outcome)
    }
    let req: http.ClientRequest
    try {
      req = (secure ? https : http).request({
        protocol: url.protocol,
        hostname: url.hostname,
        port: Number(url.port) || (secure ? 443 : 80),
        path: call.path,
        method: call.method,
        headers,
        agent,
        ...(secure && { rejectUnauthorized: true }),
      })
    } catch {
      return settle(new ApprovalsFailure('other'))
    }
    const stop = (outcome: ApprovalsFailure) => {
      settle(outcome)
      req.destroy()
    }
    setTimeout(() => stop(new ApprovalsFailure('timeout')), target.totalMs).unref()
    req.on('error', () => settle(new ApprovalsFailure('offline')))
    req.on('close', () => settle(new ApprovalsFailure('offline')))
    req.once('socket', (socket) => {
      socket.once(secure ? 'secureConnect' : 'connect', () => req.end(body ?? undefined))
    })
    req.on('response', (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400) return stop(new ApprovalsFailure('other', status))
      if (Number(res.headers['content-length']) > target.maxBytes) {
        return stop(new ApprovalsFailure('other', status))
      }
      const chunks: Buffer[] = []
      let count = 0
      res.on('data', (chunk: Buffer) => {
        count += chunk.byteLength
        if (count > target.maxBytes) return stop(new ApprovalsFailure('other', status))
        chunks.push(chunk)
      })
      res.on('end', () => settle({ status, bytes: Buffer.concat(chunks) }))
      res.on('error', () => settle(new ApprovalsFailure('offline', status)))
    })
  })
}
