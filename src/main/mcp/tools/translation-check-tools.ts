// set_translation, run_checks and get_check_results (spec/phases/phase-10.md, the Phase 6 tools,
// A-236). Not built: P10-12 replaces these rows.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const TRANSLATION_CHECK_TOOLS: readonly ToolDef[] = [
  notBuilt('set_translation', 'command', 'translation.set'),
  notBuilt('run_checks', 'command', 'check.run'),
  notBuilt('get_check_results', 'query', 'check.results'),
]
