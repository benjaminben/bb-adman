// SPEC 6.10.14 (security class): from which ComfyUI version `/interrupt` reads a run's ID is not
// verified. A server that does not read it stops whatever job is running, which could be the
// stakeholder's own work. So a case sends `interrupt` only to a server whose version can be read
// and is at least this one. CU-5a owns nothing under `src/`, so the constant lives here; CU-4
// adds the adapter's own to `comfyui/limits.ts` (1.43 K-3).
export const MIN_TARGETED_INTERRUPT = '0.30.0'

// A dotted version as numbers, or null when it cannot be read.
function numbersOf(text: string): number[] | null {
  const match = /^v?(\d+(?:\.\d+)*)/.exec(text.trim())
  return match?.[1] ? match[1].split('.').map(Number) : null
}

// True only when both versions can be read and the first is the second or later.
export function versionAtLeast(version: string, min: string): boolean {
  const a = numbersOf(version)
  const b = numbersOf(min)
  if (!a || !b) return false
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const gap = (a[i] ?? 0) - (b[i] ?? 0)
    if (gap !== 0) return gap > 0
  }
  return true
}
