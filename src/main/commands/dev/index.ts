// The dev command domain (SPEC 12): the hand-test command dev.storage (slice I).
// Registered only when createCore gets devTools: true (SPEC 4.2, 13).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { devStorage } from './storage'

export function devCommands(deps: CoreDeps): CommandHandler[] {
  return deps.devTools ? [devStorage(deps)] : []
}
