// The AI tools over the Phase 4 jobs (spec/phases/phase-10.md, A-231, A-232). Not built: P10-5
// replaces these rows.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const AI_TOOLS: readonly ToolDef[] = [
  notBuilt('propose_layout', 'command', 'generation.proposeLayout'),
  notBuilt('copy_options', 'command', 'generation.copyOptions'),
  notBuilt('cut_out', 'command', 'generation.cutOut'),
]
