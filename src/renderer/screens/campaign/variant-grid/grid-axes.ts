// R2C-2 (spec/phases/round-2-campaign.md, design addition 2): a direction's variants as a
// table. Rows are size labels, columns language codes, each in the order first met in the list
// (direction-order.ts order, so the master's size and language come first). One cell per size
// and language that has a variant, in reading order; an image and a video share a cell (A-308).
import type { VariantSummary } from '@/shared/schemas/queries/campaign'

export type GridRow = { sizeLabel: string; width: number; height: number }

// Row and column are 1-based; variants keep the list's order.
export type GridCell = { row: number; column: number; variants: VariantSummary[] }

export type GridAxes = { rows: GridRow[]; columns: string[]; cells: GridCell[] }

export function gridAxes(variants: VariantSummary[]): GridAxes {
  const rows: GridRow[] = []
  const columns: string[] = []
  const cells = new Map<string, GridCell>()
  for (const v of variants) {
    let row = rows.findIndex((r) => r.sizeLabel === v.sizeLabel) + 1
    if (row === 0) row = rows.push({ sizeLabel: v.sizeLabel, width: v.width, height: v.height })
    let column = columns.indexOf(v.language) + 1
    if (column === 0) column = columns.push(v.language)
    const key = `${row}:${column}`
    const cell = cells.get(key)
    if (cell) cell.variants.push(v)
    else cells.set(key, { row, column, variants: [v] })
  }
  const ordered = [...cells.values()].sort((a, b) => a.row - b.row || a.column - b.column)
  return { rows, columns, cells: ordered }
}
