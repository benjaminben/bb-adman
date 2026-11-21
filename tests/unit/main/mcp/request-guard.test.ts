import { describe, it, expect } from 'vitest'
import { checkRequest } from '../../../../src/main/mcp/request-guard'

const PORT = 47999
const TOKEN = 'made-up-local-token-for-tests-only'
const opts = { port: PORT, token: TOKEN }
const good = { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${TOKEN}` }

describe('the request guard [SPEC 6.8, 1.56 review points 2 and 3]', () => {
  it('passes a request with an allowed Host, no Origin and the right token', () => {
    expect(checkRequest(good, opts)).toBeNull()
    expect(checkRequest({ ...good, host: `localhost:${PORT}` }, opts)).toBeNull()
  })

  it('refuses any Origin header with 403, even an empty one or a local one', () => {
    for (const origin of ['', 'null', 'https://example.com', `http://127.0.0.1:${PORT}`]) {
      expect(checkRequest({ ...good, origin }, opts)?.status, origin).toBe(403)
    }
  })

  it('refuses a Host other than 127.0.0.1:{port} or localhost:{port} with 403', () => {
    for (const host of [
      undefined,
      '',
      '127.0.0.1',
      'localhost',
      `127.0.0.1:${PORT + 1}`,
      `evil.example:${PORT}`,
      `localhost.evil.example:${PORT}`,
      `[::1]:${PORT}`,
      `0.0.0.0:${PORT}`,
      `127.0.0.1:${PORT}.evil.example`,
    ]) {
      expect(checkRequest({ ...good, host }, opts)?.status, String(host)).toBe(403)
    }
  })

  it('refuses a missing or wrong token with 401', () => {
    expect(checkRequest({ host: good.host }, opts)?.status).toBe(401)
    const wrong = { ...good, authorization: 'Bearer made-up-wrong-token' }
    expect(checkRequest(wrong, opts)?.status).toBe(401)
  })

  it('refuses every request with 401 when no token has been made', () => {
    expect(checkRequest(good, { port: PORT, token: null })?.status).toBe(401)
  })

  it('puts no header value in the message it sends back', () => {
    const sent = [
      checkRequest({ ...good, origin: 'https://made-up-origin.example' }, opts),
      checkRequest({ ...good, host: 'made-up-host.example' }, opts),
      checkRequest({ ...good, authorization: 'Bearer made-up-wrong-token' }, opts),
    ]
    for (const refusal of sent) {
      expect(refusal?.message).not.toMatch(/made-up|127\.0\.0\.1|Bearer/)
    }
  })
})
