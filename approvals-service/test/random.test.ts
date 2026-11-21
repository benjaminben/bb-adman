import { describe, it, expect } from 'vitest'
import { LETTERS, randomLetters } from '../src/crypto/random'

// A byte source that hands out the given bytes in order, then repeats them.
function fixedBytes(bytes: number[]) {
  let at = 0
  return (length: number) => Uint8Array.from({ length }, () => bytes[at++ % bytes.length] ?? 0)
}

describe('randomLetters [approvals-service.md "Random values and passwords"]', () => {
  it('uses the 62-letter alphabet 0-9A-Za-z', () => {
    expect(LETTERS).toBe('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
  })

  it.each([12, 24])('gives %i letters, only from the alphabet', (n) => {
    for (let i = 0; i < 50; i++) expect(randomLetters(n)).toMatch(new RegExp(`^[0-9A-Za-z]{${n}}$`))
  })

  it('skips bytes 248 to 255, and 247 gives z', () => {
    const source = fixedBytes([248, 249, 250, 251, 252, 253, 254, 255, 247, 0, 61, 62])
    expect(randomLetters(4, source)).toBe('z0z0')
  })

  it('can give every letter of the alphabet and no other', () => {
    const source = fixedBytes(Array.from({ length: 256 }, (_, i) => i))
    const seen = new Set(randomLetters(248, source))
    expect([...seen].sort().join('')).toBe([...LETTERS].sort().join(''))
  })

  it('gives every letter from the real source over many draws', () => {
    const seen = new Set(randomLetters(5000))
    expect([...seen].sort().join('')).toBe([...LETTERS].sort().join(''))
  })
})
