// spec/approvals-service.md "Comparing": secrets are compared with timingSafeEqual on
// equal-length buffers, never with ===.

export function sameBytes(a: ArrayBuffer | Uint8Array, b: ArrayBuffer | Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  return crypto.subtle.timingSafeEqual(a, b)
}

// For a key: the SHA-256 of each side, so the two buffers always have the same length and the
// time taken does not depend on where the texts first differ.
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  return crypto.subtle.timingSafeEqual(hashA, hashB)
}
