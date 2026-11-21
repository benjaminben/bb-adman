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
// (cloud metadata), multicast and reserved ranges. An IPv6 address that carries an IPv4 one
// (::ffff:a.b.c.d, 6to4 2002::/16, NAT64 64:ff9b::/96) is judged by that IPv4 address, so a
// public address behind NAT64 passes; the other IPv6 forms that can carry one are refused.
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
  ['::ffff:0:0:0', 96], // IPv4-translated
  ['64:ff9b:1::', 48], // local-use NAT64
  ['2001::', 32], // Teredo
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // old site-local
  ['ff00::', 8], // multicast
] as const) {
  REFUSED.addSubnet(address, prefix, 'ipv6')
}

// The 16 bytes of an IPv6 address that net.isIP accepted, a dotted IPv4 tail included.
function ipv6Bytes(address: string): number[] {
  let text = address.toLowerCase().replace(/%.*$/, '')
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text)
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number) as [number, number, number, number]
    const tail = `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
    text = text.slice(0, dotted.index) + tail
  }
  const [head = '', rest] = text.split('::')
  const groups = (part: string) => (part === '' ? [] : part.split(':'))
  const left = groups(head)
  const right = rest === undefined ? [] : groups(rest)
  const zeros = Array<string>(8 - left.length - right.length).fill('0')
  return [...left, ...zeros, ...right].flatMap((g) => {
    const n = parseInt(g, 16)
    return [n >> 8, n & 0xff]
  })
}

const zero = (bytes: number[]) => bytes.every((b) => b === 0)
const v4At = (bytes: number[], at: number) => bytes.slice(at, at + 4).join('.')

export function isRefusedAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 0) return true
  if (family === 4) return REFUSED.check(address, 'ipv4')
  const b = ipv6Bytes(address)
  const mapped = zero(b.slice(0, 10)) && b[10] === 0xff && b[11] === 0xff
  if (mapped) return isRefusedAddress(v4At(b, 12))
  if (zero(b.slice(0, 12))) return true // ::/96, with :: and ::1
  if (b[0] === 0x20 && b[1] === 0x02) return isRefusedAddress(v4At(b, 2))
  const nat64 = b[0] === 0 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b
  if (nat64 && zero(b.slice(4, 12))) return isRefusedAddress(v4At(b, 12))
  return REFUSED.check(address, 'ipv6')
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
  // Nothing is sent, so this is not the service refusing the key: the key needs entering again.
  if (!KEY_SHAPE.test(target.key)) return Promise.reject(approvalsRefusal('approvals_not_set_up'))
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
        ...(secure && {
          rejectUnauthorized: true,
          servername: url.hostname,
          lookup: checkedLookup(target.resolve),
        }),
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
