// add_variant and delete_variant (spec/phases/phase-10.md, the Phase 5 tools). Not built:
// P10-11 replaces these rows.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const VARIANT_EDIT_TOOLS: readonly ToolDef[] = [
  notBuilt('add_variant', 'command', 'variant.add'),
  notBuilt('delete_variant', 'command', 'variant.delete'),
]
