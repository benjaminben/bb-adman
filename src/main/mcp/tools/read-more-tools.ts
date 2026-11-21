// list_subjects and get_variant (spec/phases/phase-10.md, A-235, A-249). Not built: P10-2
// replaces these rows.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const READ_MORE_TOOLS: readonly ToolDef[] = [
  notBuilt('list_subjects', 'query', 'subject.list'),
  notBuilt('get_variant', 'query', 'variant.get'),
]
