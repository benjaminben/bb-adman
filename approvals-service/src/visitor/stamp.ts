// spec/phases/round-2-approvals.md "Sign off all: one request for all", steps 1 and 2: the set a
// reviewer can sign is exactly what the page showed, and the stamp names that set.

export type Signable = { variantKey: string; version: number }

// The variants whose picture has not expired at `now`, in the order given (position order).
export function signableSet(
  rows: { variantKey: string; version: number; pictureExpiresAt: number }[],
  now: number,
): Signable[] {
  return rows
    .filter((row) => row.pictureExpiresAt > now)
    .map((row) => ({ variantKey: row.variantKey, version: row.version }))
}

// The SHA-256 of the lines `{variantKey}.{version}\n`, as 64 lower-case hex letters.
export async function galleryStamp(set: Signable[]): Promise<string> {
  const text = set.map((row) => `${row.variantKey}.${row.version}\n`).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
