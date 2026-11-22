// import_assets (spec/phases/round-2-platform.md, D5): an agent imports files by their full
// paths, asked every time. R2P-1 adds the row as notBuilt (A-230); R2P-5 fills it.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const IMPORT_TOOLS: readonly ToolDef[] = [
  notBuilt('import_assets', 'command', 'asset.importFiles'),
]
