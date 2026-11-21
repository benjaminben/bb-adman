// The sync command domain (spec/links-and-sync.md, "Sync"). sync.apply is deny for agents.
// P5-13 replaces the body of apply.ts; this list does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { syncApply } from './apply'

export function syncCommands(deps: CoreDeps): CommandHandler[] {
  return [syncApply(deps)]
}
