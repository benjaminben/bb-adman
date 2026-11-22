// The order the start pictures play in (design/audit/spec-start.md "The crossfade", Order):
// all of them once, shuffled (Fisher–Yates). When a new round would start with the picture
// just shown, its first two swap, so no picture shows twice in a row.
export type RandomSource = () => number

export function shuffleOrder(count: number, random: RandomSource, justShown?: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j] as number, order[i] as number]
  }
  if (count > 1 && justShown !== undefined && order[0] === justShown) {
    ;[order[0], order[1]] = [order[1] as number, justShown]
  }
  return order
}
