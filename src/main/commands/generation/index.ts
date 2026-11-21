// The generation command domain (SPEC 12). Empty in Phase 2 step 0; its slice adds the handlers.
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'

export function generationCommands(_deps: CoreDeps): CommandHandler[] {
  return []
}
