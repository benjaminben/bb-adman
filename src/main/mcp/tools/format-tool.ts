// set_variant_format (spec/phases/phase-10.md, the Phase 7 tool; D-025). Not built: P10-13
// replaces this row.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const FORMAT_TOOLS: readonly ToolDef[] = [
  notBuilt('set_variant_format', 'command', 'variant.setFormat'),
]
