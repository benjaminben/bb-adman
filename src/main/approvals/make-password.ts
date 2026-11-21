// makePassword (spec/approvals.md "approvals.createLink" step 1, security class): 16 letters
// from a 31-letter alphabet, shown as four groups of four joined by '-' (about 79 bits).
import { randomBytes } from 'node:crypto'

export const PASSWORD_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

const LETTERS = 16
// The largest multiple of 31 that fits in a byte: 248 = 8 × 31. A byte of 248 or more is
// dropped, so every letter comes from exactly 8 byte values and none is more likely.
const LIMIT = Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length

export function makePassword(source: (n: number) => Buffer = randomBytes): string {
  const letters: string[] = []
  while (letters.length < LETTERS) {
    for (const byte of source(LETTERS - letters.length)) {
      if (byte < LIMIT) letters.push(PASSWORD_ALPHABET.charAt(byte % PASSWORD_ALPHABET.length))
    }
  }
  const groups = [0, 4, 8, 12].map((at) => letters.slice(at, at + 4).join(''))
  return groups.join('-')
}
