// P7-18: the ruler's seconds marks. The step is the first of a fixed list that gives at most
// ten marks, so a long variant (up to 86,400 s) keeps a readable ruler.
const STEPS_S = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10_800, 21_600]
const MOST_MARKS = 10

export function markStep(durationMs: number): number {
  const seconds = durationMs / 1000
  return STEPS_S.find((step) => seconds / step <= MOST_MARKS) ?? STEPS_S[STEPS_S.length - 1]!
}

// Each mark's time in milliseconds, from 0, before the end (a mark at the end would have its
// label cut off at the right edge).
export function markTimes(durationMs: number): number[] {
  const step = markStep(durationMs) * 1000
  const count = Math.ceil(durationMs / step)
  return Array.from({ length: Math.max(count, 1) }, (_, i) => i * step)
}

// m:ss, for a mark on a whole second.
export function markLabel(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
