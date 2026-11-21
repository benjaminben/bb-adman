// The storage command domain (SPEC 12). Empty in Phase 2 step 0; its slice adds the handlers.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'

export function storageCommands(_deps: CoreDeps): CommandHandler[] {
  return []
}
