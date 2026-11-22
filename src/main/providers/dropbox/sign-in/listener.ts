// The one-use listener for the Dropbox sign-in redirect (spec/phases/phase-09.md "The sign-in
// redirect"; spec/security.md "Rules: network requests"). It binds 127.0.0.1 only, lives for
// one sign-in, and closes on every path: an answer, the time-out, or close() (app quit).
// It answers only GET {DROPBOX_REDIRECT_PATH} with the exact Host and the matching state, once.
// Every reply is a fixed page. The state and the code are secrets: neither goes into a log
// line, an error or a reply.
import crypto from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { publishRefusal, signInPortBusy } from '@/shared/publish/messages'
import { AppError } from '@/shared/schemas/result'
import { DROPBOX_REDIRECT_HOST, DROPBOX_REDIRECT_PATH } from './authorize-url'
import { signInPage, type SignInPageKind } from './pages'

export type RedirectResult = { code: string } | { refused: true } | { failed: true }

export type RedirectWait = {
  port: number
  address: string
  // Rejects with sign_in_timed_out after timeoutMs, or sign_in_failed after close().
  result: Promise<RedirectResult>
  close(): void
}

type Outcome = { page: SignInPageKind; end?: RedirectResult }

const CODE = /^[A-Za-z0-9\-_.~]{1,512}$/

const digest = (text: string): Buffer => crypto.createHash('sha256').update(text, 'utf8').digest()

// Both sides are hashed first, so the comparison takes the same time whatever was sent.
function sameState(sent: string, expected: string): boolean {
  return crypto.timingSafeEqual(digest(sent), digest(expected))
}

// A value given exactly once; a missing or repeated name gives null.
function single(query: URLSearchParams, name: string): string | null {
  const all = query.getAll(name)
  return all.length === 1 ? all[0] : null
}

function judge(req: http.IncomingMessage, host: string, state: string): Outcome {
  const raw = req.url ?? ''
  if (req.method !== 'GET' || req.headers.host !== host) return { page: 'notFound' }
  if (!raw.startsWith('/') || raw.startsWith('//')) return { page: 'notFound' }
  const url = new URL(raw, `http://${host}`)
  if (url.pathname !== DROPBOX_REDIRECT_PATH) return { page: 'notFound' }
  const query = url.searchParams
  const sent = single(query, 'state')
  if (sent === null || !sameState(sent, state)) return { page: 'wrongState' }
  if (query.has('error')) return { page: 'done', end: { refused: true } }
  if (!query.has('code')) return { page: 'done', end: { failed: true } }
  const code = single(query, 'code')
  if (code === null || !CODE.test(code)) return { page: 'wrongState' }
  return { page: 'done', end: { code } }
}

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', (e: NodeJS.ErrnoException) =>
      reject(e.code === 'EADDRINUSE' ? signInPortBusy(port) : publishRefusal('sign_in_failed')),
    )
    server.listen({ port, host: DROPBOX_REDIRECT_HOST }, resolve)
  })
}

// Listens on 127.0.0.1:{port} before anything else happens; a taken port refuses
// sign_in_port_busy and nothing is left open.
export async function waitForRedirect(opts: {
  port: number
  state: string
  timeoutMs: number
}): Promise<RedirectWait> {
  const server = http.createServer()
  await listen(server, opts.port)
  server.unref()
  const { port, address } = server.address() as AddressInfo
  const host = `${DROPBOX_REDIRECT_HOST}:${port}`

  let settle: (outcome: RedirectResult | AppError) => void = () => undefined
  const result = new Promise<RedirectResult>((resolve, reject) => {
    settle = (outcome) => (outcome instanceof AppError ? reject(outcome) : resolve(outcome))
  })
  let open = true
  const timer = setTimeout(() => end(publishRefusal('sign_in_timed_out')), opts.timeoutMs)
  timer.unref()

  // Stops accepting at once, so no second connection reaches it. `drop` closes every
  // connection still open; the winning reply passes false and drops them once it is sent.
  function end(outcome: RedirectResult | AppError, drop = true): void {
    if (!open) return
    open = false
    clearTimeout(timer)
    server.close()
    if (drop) server.closeAllConnections()
    settle(outcome)
  }

  server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
    const outcome: Outcome = open ? judge(req, host, opts.state) : { page: 'notFound' }
    const page = signInPage(outcome.page)
    res.writeHead(page.status, page.headers)
    res.end(page.body, () => {
      if (!open) server.closeAllConnections()
    })
    if (outcome.end) end(outcome.end, false)
  })

  return { port, address, result, close: () => end(publishRefusal('sign_in_failed')) }
}
