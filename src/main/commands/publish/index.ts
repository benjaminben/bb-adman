// The publish command domain (spec/phases/phase-09.md "Publishing"). publish.run is deny for
// agents. Its slice replaces the body of run.ts; this list does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { publishRun } from './run'

export function publishCommands(deps: CoreDeps): CommandHandler[] {
  return [publishRun(deps)]
}
