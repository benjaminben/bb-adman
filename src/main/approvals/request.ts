// How every request to the approvals service is sent (spec/approvals.md "The service client",
// security class). Used only by client.ts, which passes constant paths with checked IDs.
// - The saved origin is checked again with parseApprovalsAddress at each call; host and port
//   come only from it.
// - Node's https (http only for the dev-tools test origin), with a new Agent of its own made
//   with no proxy option, keepAlive off and certificate checks on, so no proxy or TLS setting
//   from the environment applies.
// - The key goes only into the Authorization header. No Origin, Referer or Cookie is sent.
// - Nothing is written until the socket is connected (for https, the certificate passed).
// - For https, the name is resolved here and refused when any address is loopback, private,
//   link-local or otherwise not public; the socket gets only the address that was checked.
// - A 3xx is never followed. The whole request has a time limit; the reply is read with a cap.
import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { parseApprovalsAddress } from '@/shared/approvals/address'
import { approvalsRefusal } from '@/shared/approvals/messages'
import { ApprovalsFailure } from './failure'

export type Resolved = { address: string; family: number }
export type Resolve = (host: string) => Promise<Resolved[]>

export const systemResolve: Resolve = (host) => dns.promises.lookup(host, { all: true })

// Addresses the key is never sent to: this computer, private and shared networks, link-local
// (cloud metadata), multicast and reserved ranges, and NAT64 forms of them. An IPv4 address
// written as IPv6 (::ffff:a.b.c.d) is checked as the IPv4 address.
const REFUSED = new net.BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) {
  REFUSED.addSubnet(address, prefix, 'ipv4')
}
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  REFUSED.addSubnet(address, prefix, 'ipv6')
}

export function isRefusedAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 0) return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1]
  if (mapped !== undefined) return isRefusedAddress(mapped)
  return REFUSED.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

type LookupCallback = (error: Error | null, address: string | Resolved[], family?: number) => void

// The lookup handed to https.request: every address the name gives must pass.
function checkedLookup(resolve: Resolve) {
  return (hostname: string, options: { all?: boolean }, callback: LookupCallback) => {
    const refuse = () =>
      callback(Object.assign(new Error('Address refused'), { code: 'EREFUSED' }), '')
    resolve(hostname).then((list) => {
      const first = list[0]
      if (!first || list.some((a) => isRefusedAddress(a.address))) return refuse()
      if (options.all) callback(null, list)
      else callback(null, first.address, first.family)
    }, refuse)
  }
}

export type Target = {
  origin: string
  key: string
  allowLocalHttp: boolean
  totalMs: number
  maxBytes: number
  resolve: Resolve
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
        ...(secure && { rejectUnauthorized: true, lookup: checkedLookup(target.resolve) }),
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
