import { describe, it, expect, afterEach } from 'vitest'
import http from 'node:http'
import net from 'node:net'
import { waitForRedirect, type RedirectWait } from '@/main/providers/dropbox/sign-in/listener'
import { SIGN_IN_PAGES } from '@/shared/publish/messages'
import { AppError } from '@/shared/schemas/result'
import { connectError } from '../../../../integration/mcp/http-client'

const STATE = 'made-up-state-0123456789-abcdefghijklmnopqrstu'
const MARK = 'echoMark42'
const LONG_WAIT = 60_000

type Sent = { method?: string; path: string; host?: string }
type Reply = { status: number; headers: http.IncomingHttpHeaders; body: string }

function send(port: number, sent: Sent): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      method: sent.method ?? 'GET',
      path: sent.path,
      setHost: false,
      agent: false,
      headers: { host: sent.host ?? `127.0.0.1:${port}` },
    })
    req.once('response', (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => (body += chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }))
    })
    req.once('error', reject)
    req.end()
  })
}

const query = (values: Record<string, string>) => `/oauth/dropbox?${new URLSearchParams(values)}`

function expectFixedPage(reply: Reply): void {
  expect(reply.headers['content-type']).toBe('text/html; charset=utf-8')
  expect(reply.headers['content-security-policy']).toBe("default-src 'none'")
  expect(reply.headers['cache-control']).toBe('no-store')
  expect(reply.headers['referrer-policy']).toBe('no-referrer')
  expect(reply.body).not.toContain(MARK)
  expect(JSON.stringify(reply.headers)).not.toContain(MARK)
}

let wait: RedirectWait | undefined
afterEach(() => {
  wait?.close()
  wait?.result.catch(() => undefined)
  wait = undefined
})

async function start(timeoutMs = LONG_WAIT): Promise<RedirectWait> {
  wait = await waitForRedirect({ port: 0, state: STATE, timeoutMs })
  return wait
}

async function reasonOf(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(AppError)
  const { message, details } = error as AppError
  expect(`${message} ${JSON.stringify(details)}`).not.toContain(STATE)
  return details
}

describe('waitForRedirect: where it listens [phase-09 "The sign-in redirect"]', () => {
  it('binds 127.0.0.1 only, on the port the operating system gave for port 0', async () => {
    const w = await start()
    expect(w.address).toBe('127.0.0.1')
    expect(w.port).toBeGreaterThan(0)
    expect(await connectError('127.0.0.1', w.port)).toBeNull()
    expect(await connectError('::1', w.port)).not.toBeNull()
  })

  it('refuses sign_in_port_busy, naming the port, when the port is taken', async () => {
    const taken = net.createServer()
    await new Promise<void>((resolve) => taken.listen(0, '127.0.0.1', resolve))
    const port = (taken.address() as net.AddressInfo).port
    try {
      const error = await waitForRedirect({ port, state: STATE, timeoutMs: LONG_WAIT }).catch(
        (e: unknown) => e,
      )
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).details).toEqual({ reason: 'sign_in_port_busy' })
      expect((error as AppError).message).toContain(String(port))
    } finally {
      await new Promise((resolve) => taken.close(resolve))
    }
  })
})

describe('waitForRedirect: requests answered and ignored [A-214]', () => {
  const longCode = 'a'.repeat(513)
  const table: { name: string; sent: (port: number) => Sent; status: number; text?: string }[] = [
    {
      name: 'a wrong path',
      sent: () => ({ path: `/oauth/other?state=${STATE}&code=${MARK}` }),
      status: 404,
    },
    {
      name: 'an encoded path',
      sent: () => ({ path: `/oauth/%64ropbox?state=${STATE}&code=${MARK}` }),
      status: 404,
    },
    {
      name: 'a POST',
      sent: () => ({ method: 'POST', path: query({ state: STATE, code: MARK }) }),
      status: 404,
    },
    {
      name: 'a wrong Host',
      sent: (p) => ({ path: query({ state: STATE, code: MARK }), host: `localhost:${p}` }),
      status: 404,
    },
    {
      name: 'a Host naming the value',
      sent: () => ({ path: query({ state: STATE, code: MARK }), host: `${MARK}.example.com` }),
      status: 404,
    },
    {
      name: 'a missing state',
      sent: () => ({ path: query({ code: MARK }) }),
      status: 400,
      text: SIGN_IN_PAGES.wrongState,
    },
    {
      name: 'a wrong state',
      sent: () => ({ path: query({ state: `${STATE}x${MARK}`, code: MARK }) }),
      status: 400,
      text: SIGN_IN_PAGES.wrongState,
    },
    {
      name: 'a shorter state',
      sent: () => ({ path: query({ state: STATE.slice(1), code: MARK }) }),
      status: 400,
      text: SIGN_IN_PAGES.wrongState,
    },
    {
      name: 'state sent twice',
      sent: () => ({ path: `/oauth/dropbox?state=${STATE}&state=${STATE}&code=${MARK}` }),
      status: 400,
      text: SIGN_IN_PAGES.wrongState,
    },
    {
      name: 'a code with a bad character',
      sent: () => ({ path: query({ state: STATE, code: `${MARK}<b>` }) }),
      status: 400,
      text: SIGN_IN_PAGES.wrongState,
    },
    {
      name: 'a code of 513 characters',
      sent: () => ({ path: query({ state: STATE, code: longCode }) }),
      status: 400,
      text: SIGN_IN_PAGES.wrongState,
    },
    {
      name: 'an empty code',
      sent: () => ({ path: query({ state: STATE, code: '' }) }),
      status: 400,
      text: SIGN_IN_PAGES.wrongState,
    },
    {
      name: 'a code sent twice',
      sent: () => ({ path: `/oauth/dropbox?state=${STATE}&code=a&code=b` }),
      status: 400,
      text: SIGN_IN_PAGES.wrongState,
    },
  ]

  it.each(table)('answers $name with $status, a fixed page, and keeps waiting', async (row) => {
    const w = await start()
    const reply = await send(w.port, row.sent(w.port))
    expect(reply.status).toBe(row.status)
    expectFixedPage(reply)
    if (row.text) expect(reply.body).toContain(row.text)
    expect(reply.body).not.toContain(longCode)

    const done = await send(w.port, { path: query({ state: STATE, code: 'good-code_1.~' }) })
    expect(done.status).toBe(200)
    expect(await w.result).toEqual({ code: 'good-code_1.~' })
  })
})

describe('waitForRedirect: the matching request', () => {
  it('resolves with the code, answers the fixed page, and closes the listener at once', async () => {
    const w = await start()
    const code = `${MARK}-${'Z'.repeat(400)}`
    const reply = await send(w.port, { path: query({ state: STATE, code }) })
    expect(reply.status).toBe(200)
    expectFixedPage(reply)
    expect(reply.body).toContain(SIGN_IN_PAGES.done)
    expect(reply.body).not.toContain(code)
    expect(await w.result).toEqual({ code })
    expect(await connectError('127.0.0.1', w.port)).toBe('ECONNREFUSED')
  })

  it('accepts a code of 512 characters', async () => {
    const w = await start()
    const code = 'b'.repeat(512)
    await send(w.port, { path: query({ state: STATE, code }) })
    expect(await w.result).toEqual({ code })
  })

  it('resolves refused on error=access_denied, with the fixed page, and closes', async () => {
    const w = await start()
    const reply = await send(w.port, {
      path: query({ state: STATE, error: 'access_denied', error_description: MARK }),
    })
    expect(reply.status).toBe(200)
    expectFixedPage(reply)
    expect(await w.result).toEqual({ refused: true })
    expect(await connectError('127.0.0.1', w.port)).toBe('ECONNREFUSED')
  })

  it('resolves failed when the matching state has neither a code nor an error', async () => {
    const w = await start()
    const reply = await send(w.port, { path: query({ state: STATE, other: MARK }) })
    expectFixedPage(reply)
    expect(await w.result).toEqual({ failed: true })
    expect(await connectError('127.0.0.1', w.port)).toBe('ECONNREFUSED')
  })
})

describe('waitForRedirect: ending without an answer', () => {
  it('ends sign_in_timed_out after timeoutMs and closes the listener', async () => {
    const w = await start(50)
    expect(await reasonOf(w.result)).toEqual({ reason: 'sign_in_timed_out' })
    expect(await connectError('127.0.0.1', w.port)).toBe('ECONNREFUSED')
  })

  it('ends sign_in_failed when the caller closes it first (app quit), and frees the port', async () => {
    const w = await start()
    w.close()
    expect(await reasonOf(w.result)).toEqual({ reason: 'sign_in_failed' })
    expect(await connectError('127.0.0.1', w.port)).toBe('ECONNREFUSED')
  })
})
