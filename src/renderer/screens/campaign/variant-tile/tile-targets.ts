// Design wave CAMP-1 (C-11): where a tile's marks lead, and whether its title shows, given by
// the direction that holds the tile (direction-grids/). A tile drawn outside a direction gets
// none: its marks are plain and its title is in its name and tooltip only. No target starts a
// run or sends a command.
import { createContext, useContext } from 'react'
import type { BadgeKey } from './badge-words'

export type TileView = 'checks' | 'translations'

export type TileTargets = {
  showTitle?: boolean
  onView?: (view: TileView) => void
  onActivity?: () => void
  onRelink?: () => void
}

export const TileTargetsContext = createContext<TileTargets>({})

export const useTileTargets = () => useContext(TileTargetsContext)

// The fix each mark leads to, where one exists today. "Out of date" is plain (CAMP-2 makes it
// open the sync).
export function markTarget(
  key: BadgeKey,
  targets: TileTargets,
  open: (() => void) | undefined,
): (() => void) | undefined {
  const view = targets.onView
  switch (key) {
    case 'jobRunning':
      return targets.onActivity
    case 'resultUnseen':
    case 'overflow':
      return open
    case 'missingFile':
      return targets.onRelink
    case 'translationUnapproved':
      return view && (() => view('translations'))
    case 'checkWarning':
    case 'checkStale':
      return view && (() => view('checks'))
    default:
      return undefined
  }
}
