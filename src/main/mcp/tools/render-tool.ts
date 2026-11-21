// render_variant (spec/phases/phase-10.md, A-234). Not built: P10-3 replaces this row.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const RENDER_TOOLS: readonly ToolDef[] = [
  notBuilt('render_variant', 'query', 'variant.render'),
]
