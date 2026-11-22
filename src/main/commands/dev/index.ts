// The dev command domain (SPEC 12). Its one command, the hand-test storage command, was removed
// in P9-14, so the list is empty; core.ts still spreads it in.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'

export function devCommands(_deps: CoreDeps): CommandHandler[] {
  return []
}
