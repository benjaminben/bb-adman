import 'server-only'
// spec/approvals-service.md "Comparing": secrets are compared with timingSafeEqual on
// equal-length buffers, never with ===.
import { timingSafeEqual } from 'node:crypto'

function view(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
}

// Unequal lengths answer false before any byte is read: the length alone decides, never the
// content, and timingSafeEqual (which throws on unequal lengths) is never reached.
export function sameBytes(a: ArrayBuffer | Uint8Array, b: ArrayBuffer | Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  return timingSafeEqual(view(a), view(b))
}

// For a key: the SHA-256 of each side, so the two buffers always have the same length and the
// time taken does not depend on where the texts first differ.
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  return sameBytes(hashA, hashB)
}
