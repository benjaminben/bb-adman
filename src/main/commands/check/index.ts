// The check command domain (spec/phases/phase-06.md, design addition 5). P6-3 replaces the
// body of run.ts; this list does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { checkRun } from './run'

export function checkCommands(deps: CoreDeps): CommandHandler[] {
  return [checkRun(deps)]
}
