import { describe, it, expect, vi } from 'vitest'
import crypto from 'node:crypto'
import { challengeFor, makePkce } from '@/main/providers/dropbox/sign-in/pkce'

const BASE64URL = /^[A-Za-z0-9_-]+$/

describe('makePkce [phase-09 "The sign-in redirect", PKCE]', () => {
  it('gives an 86-character verifier and a 43-character state, both base64url', () => {
    const { verifier, state, challenge } = makePkce()
    expect(verifier).toHaveLength(86)
    expect(state).toHaveLength(43)
    expect(challenge).toHaveLength(43)
    for (const value of [verifier, state, challenge]) expect(value).toMatch(BASE64URL)
  })

  it('takes 64 bytes for the verifier and 32 for the state from the byte source', () => {
    const source = vi.fn((size: number) => Buffer.alloc(size, 7))
    const { verifier, state } = makePkce(source)
    expect(source.mock.calls.map(([size]) => size)).toEqual([64, 32])
    expect(verifier).toBe(Buffer.alloc(64, 7).toString('base64url'))
    expect(state).toBe(Buffer.alloc(32, 7).toString('base64url'))
  })

  it('uses the system secure random source by default', () => {
    const spy = vi.spyOn(crypto, 'randomBytes')
    makePkce()
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })

  it('makes the challenge as the S256 of the verifier', () => {
    const { verifier, challenge } = makePkce()
    expect(challenge).toBe(challengeFor(verifier))
  })

  it('gives different values on two calls', () => {
    const one = makePkce()
    const two = makePkce()
    expect(one.verifier).not.toBe(two.verifier)
    expect(one.state).not.toBe(two.state)
    expect(one.challenge).not.toBe(two.challenge)
  })
})

describe('challengeFor [RFC 7636 Appendix B]', () => {
  it('gives the challenge of the example verifier', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })
})
