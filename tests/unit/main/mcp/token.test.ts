import crypto from 'node:crypto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { bearerMatches, makeToken } from '../../../../src/main/mcp/token'

afterEach(() => vi.restoreAllMocks())

// Made-up values that do not look like any real key.
const TOKEN = 'made-up-local-token-for-tests-only'

describe('the MCP access token [SPEC 5.1, 5.3]', () => {
  it('is 32 random bytes written as base64url', () => {
    const token = makeToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(makeToken() === token).toBe(false)
  })
})

describe('checking the Authorization header [SPEC 5.1 step 3, 1.56 review point 2]', () => {
  it('accepts exactly "Bearer {token}"', () => {
    expect(bearerMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true)
  })

  it('refuses a missing header, another scheme, a wrong token and a token with extra text', () => {
    for (const header of [
      undefined,
      '',
      TOKEN,
      `Basic ${TOKEN}`,
      'Bearer ',
      'Bearer made-up-wrong-token',
      `Bearer ${TOKEN}x`,
      `Bearer ${TOKEN.slice(0, -1)}`,
      `Bearer  ${TOKEN}`,
    ]) {
      expect(bearerMatches(header, TOKEN), String(header?.length)).toBe(false)
    }
  })

  it('refuses everything when no token has been made', () => {
    expect(bearerMatches('Bearer ', '')).toBe(false)
    expect(bearerMatches(`Bearer ${TOKEN}`, null)).toBe(false)
  })

  it('compares in constant time, with timingSafeEqual on equal-length digests', () => {
    const spy = vi.spyOn(crypto, 'timingSafeEqual')
    bearerMatches('Bearer short', TOKEN)
    bearerMatches(`Bearer ${TOKEN}`, TOKEN)
    expect(spy).toHaveBeenCalledTimes(2)
    for (const [a, b] of spy.mock.calls) {
      expect((a as Buffer).length).toBe(32)
      expect((b as Buffer).length).toBe(32)
    }
  })
})
