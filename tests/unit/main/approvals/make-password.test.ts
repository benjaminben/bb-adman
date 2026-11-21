// makePassword (spec/approvals.md "approvals.createLink" step 1): 16 letters from a 31-letter
// alphabet, drawn without bias, in four groups of four joined by '-'.
import { describe, it, expect } from 'vitest'
import { makePassword, PASSWORD_ALPHABET } from '@/main/approvals/make-password'
import { Password } from '@/shared/approvals/contract'

const SHAPE = /^[23456789abcdefghjkmnpqrstuvwxyz]{4}(-[23456789abcdefghjkmnpqrstuvwxyz]{4}){3}$/

// Hands out the given bytes in order, then zeros, and counts what was asked for.
function fixedBytes(bytes: number[]) {
  let at = 0
  return (n: number): Buffer => {
    const out = Buffer.alloc(n)
    for (let i = 0; i < n; i++) out[i] = at < bytes.length ? (bytes[at++] ?? 0) : 0
    return out
  }
}

describe('makePassword [spec/approvals.md "approvals.createLink"]', () => {
  it('has the alphabet of the spec', () => {
    expect(PASSWORD_ALPHABET).toBe('23456789abcdefghjkmnpqrstuvwxyz')
  })

  it('gives four groups of four letters from the alphabet, 19 characters, a valid password', () => {
    for (let i = 0; i < 200; i++) {
      const made = makePassword()
      expect(made).toMatch(SHAPE)
      expect(made).toHaveLength(19)
      expect(Password.safeParse(made).success).toBe(true)
    }
  })

  it('differs from one call to the next', () => {
    const seen = new Set(Array.from({ length: 50 }, () => makePassword()))
    expect(seen.size).toBe(50)
  })

  it.each([
    ['byte 0 gives the first letter', [0], '2'],
    ['byte 30 gives the last letter', [30], 'z'],
    ['byte 31 wraps to the first letter', [31], '2'],
    ['byte 247 gives the last letter (247 % 31 = 30)', [247], 'z'],
    ['bytes 248 to 255 are skipped', [248, 249, 250, 251, 252, 253, 254, 255, 1], '3'],
  ])('with a fixed byte source: %s', (_name, bytes, first) => {
    expect(makePassword(fixedBytes(bytes)).charAt(0)).toBe(first)
  })

  it('draws again until it has 16 letters when bytes are skipped', () => {
    const skipped = Array.from({ length: 40 }, () => 255)
    expect(makePassword(fixedBytes(skipped))).toBe('2222-2222-2222-2222')
  })

  it('uses every letter equally often over every byte that is kept', () => {
    const counts = new Map<string, number>()
    for (let b = 0; b < 256; b++) {
      const letter = makePassword(fixedBytes([b])).charAt(0)
      if (b < 248) counts.set(letter, (counts.get(letter) ?? 0) + 1)
    }
    expect(counts.size).toBe(31)
    expect(new Set(counts.values())).toEqual(new Set([8]))
  })
})
