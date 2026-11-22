// spec/phases/phase-08.md, "Drawing at full size" [A-190]: a picture over the render window's
// limit is drawn in tiles of at most `max` a side, left to right, then top to bottom. Pure.
export type Tile = { x: number; y: number; width: number; height: number }

const whole = (n: number) => Number.isInteger(n) && n > 0

// Each row and column is `max` wide, the last one holds what is left.
function spans(length: number, max: number): Array<{ start: number; size: number }> {
  const out = []
  for (let start = 0; start < length; start += max) {
    out.push({ start, size: Math.min(max, length - start) })
  }
  return out
}

export function tilePlan(width: number, height: number, max: number): Tile[] {
  if (!whole(width) || !whole(height) || !whole(max)) {
    throw new Error('A tile plan needs whole, positive sizes.')
  }
  const tiles: Tile[] = []
  for (const row of spans(height, max)) {
    for (const col of spans(width, max)) {
      tiles.push({ x: col.start, y: row.start, width: col.size, height: row.size })
    }
  }
  return tiles
}
