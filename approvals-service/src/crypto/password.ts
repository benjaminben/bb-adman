// spec/approvals-service.md "Random values and passwords": PBKDF2 with HMAC-SHA-256, a 16-byte
// random salt per link, 32 bytes out. The iteration count is stored per link.
import { sameBytes } from './compare'

// The most PBKDF2 iterations the Workers runtime allows.
export const PASSWORD_ITERATIONS = 100_000

const SALT_BYTES = 16
const HASH_BITS = 256

// Used when a slug has no link, so the time taken does not tell a real slug from an unknown one.
const DUMMY: StoredPassword = {
  hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  salt: 'YWRtYW4tZHVtbXktc2FsdA==',
  iterations: PASSWORD_ITERATIONS,
}

export type StoredPassword = { hash: string; salt: string; iterations: number }

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0))
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const params = { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }
  return new Uint8Array(await crypto.subtle.deriveBits(params, key, HASH_BITS))
}

export async function hashPassword(
  password: string,
  iterations = PASSWORD_ITERATIONS,
): Promise<StoredPassword> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, iterations)
  return { hash: toBase64(hash), salt: toBase64(salt), iterations }
}

// Null stands for "no link": the hash still runs once, and the answer is no.
export async function checkPassword(
  password: string,
  stored: StoredPassword | null,
): Promise<boolean> {
  const against = stored ?? DUMMY
  const hash = await derive(password, fromBase64(against.salt), against.iterations)
  const same = sameBytes(hash, fromBase64(against.hash))
  return stored !== null && same
}
