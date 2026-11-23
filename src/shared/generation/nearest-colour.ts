// spec/brief-brand.md "Shared helpers": the nearest palette colour, used by the AI layout
// (layout-clamp.ts) and by the brand colours of a new master (templates/brand-colours.ts).
// Pure. Every colour is #RRGGBB in either letter case; the palette is not empty.

function channels(hex: string): number[] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
}

// The palette colour with the smallest sum of squared red, green and blue differences, as the
// palette writes it. On a tie the first one wins.
export function nearestColour(colour: string, palette: readonly string[]): string {
  const want = channels(colour)
  const distance = (hex: string) =>
    channels(hex).reduce((sum, value, i) => sum + (value - (want[i] ?? 0)) ** 2, 0)
  return palette.reduce((best, hex) => (distance(hex) < distance(best) ? hex : best))
}
