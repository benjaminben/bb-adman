// The dev command domain (SPEC 12). Empty in Phase 2 step 0; slice I adds the handlers.
// Registered only when createCore gets devTools: true (SPEC 4.2, 13).
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'

const handlers: CommandHandler[] = []

export function devCommands(deps: CoreDeps): CommandHandler[] {
  return deps.devTools ? handlers : []
}
