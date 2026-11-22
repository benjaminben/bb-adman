// R2C-3 (spec/phases/round-2-campaign.md, design addition 3, A-312): where an arrow, Home or
// End key moves from a tile. Left and Right walk the row's tiles in reading order (an image then
// a video in a two-tile cell), skipping empty cells. Up and Down go to the row above or below:
// the same column if it has a tile, else the nearest column (the left one on a tie), and the
// first tile of that cell. Home and End: the row's first and last tile. At an edge: null.
import type { GridAxes, GridCell } from './grid-axes'

type Place = { cell: GridCell; index: number }

function find(axes: GridAxes, id: string): Place | null {
  for (const cell of axes.cells) {
    const index = cell.variants.findIndex((v) => v.id === id)
    if (index >= 0) return { cell, index }
  }
  return null
}

const rowTiles = (axes: GridAxes, row: number) =>
  axes.cells.filter((c) => c.row === row).flatMap((c) => c.variants.map((v) => v.id))

function upOrDown(axes: GridAxes, from: GridCell, row: number): string | null {
  const cells = axes.cells.filter((c) => c.row === row)
  let best: GridCell | null = null
  for (const cell of cells) {
    const distance = Math.abs(cell.column - from.column)
    if (!best || distance < Math.abs(best.column - from.column)) best = cell
  }
  return best?.variants[0]?.id ?? null
}

export function nextTile(axes: GridAxes, fromId: string, key: string): string | null {
  const place = find(axes, fromId)
  if (!place) return null
  const { row } = place.cell
  const tiles = rowTiles(axes, row)
  const at = tiles.indexOf(fromId)
  switch (key) {
    case 'ArrowLeft':
      return tiles[at - 1] ?? null
    case 'ArrowRight':
      return tiles[at + 1] ?? null
    case 'ArrowUp':
      return upOrDown(axes, place.cell, row - 1)
    case 'ArrowDown':
      return upOrDown(axes, place.cell, row + 1)
    case 'Home':
      return tiles[0] ?? null
    case 'End':
      return tiles[tiles.length - 1] ?? null
    default:
      return null
  }
}
