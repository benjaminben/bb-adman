// R2C-3 (spec/phases/round-2-campaign.md, design addition 3, A-312): the grid list's keys, only
// while a tile's main button has the focus. An arrow, Home or End focuses the tile grid-moves.ts
// names and selects it; Delete or Backspace asks to delete the tile, never the master. Keys held
// with Cmd, Ctrl or Alt are left to others.
import type { KeyboardEvent } from 'react'
import type { GridAxes } from './grid-axes'
import { nextTile } from './grid-moves'

const MOVES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])
const MAIN = 'button[aria-pressed]'

type Options = {
  onChoose: (variantId: string) => void
  onDelete?: (variantId: string) => void
}

function tileOf(target: EventTarget): string | null {
  if (!(target instanceof HTMLElement) || !target.matches(MAIN)) return null
  return target.closest<HTMLElement>('[data-variant]')?.dataset.variant ?? null
}

function focusTile(list: HTMLElement, id: string) {
  const tiles = [...list.querySelectorAll<HTMLElement>('[data-variant]')]
  tiles
    .find((el) => el.dataset.variant === id)
    ?.querySelector<HTMLElement>(MAIN)
    ?.focus()
}

export function useGridKeys(axes: GridAxes, options: Options) {
  const { onChoose, onDelete } = options
  return (event: KeyboardEvent<HTMLElement>) => {
    const id = tileOf(event.target)
    if (id === null || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const master = axes.cells.some((c) => c.variants.some((v) => v.id === id && v.isMaster))
      event.preventDefault()
      if (!master) onDelete?.(id)
      return
    }
    if (!MOVES.has(event.key)) return
    event.preventDefault()
    const next = nextTile(axes, id, event.key)
    if (next === null) return
    focusTile(event.currentTarget, next)
    onChoose(next)
  }
}
