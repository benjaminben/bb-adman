// The export command domain (spec/phases/phase-08.md "Export run", "Report"). Both are deny for
// agents; report.add is internal. Each file's slice replaces its body; this list does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { reportAdd } from './report-add'
import { exportRun } from './run'

export function exportCommands(deps: CoreDeps): CommandHandler[] {
  return [exportRun(deps), reportAdd(deps)]
}
