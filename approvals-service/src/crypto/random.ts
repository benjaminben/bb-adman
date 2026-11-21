import 'server-only'
// spec/approvals-service.md "Random values and passwords": letters without bias.

export const LETTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

// 248 = 4 × 62. A byte of 248 or more is dropped, so every letter is equally likely.
const BYTE_LIMIT = 248

export type RandomBytes = (length: number) => Uint8Array

export const cryptoBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length))

export function randomLetters(n: number, source: RandomBytes = cryptoBytes): string {
  let out = ''
  while (out.length < n) {
    for (const byte of source(n - out.length)) {
      if (byte < BYTE_LIMIT) out += LETTERS[byte % LETTERS.length]
    }
  }
  return out
}
