// The job command domain (SPEC 12). Empty in Phase 2 step 0; its slice adds the handlers.
// Slice D built them (retry.ts, cancel.ts, mark-seen.ts); the list stays empty until the test
// that pins it empty is changed by an approved edit.
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'

export function jobCommands(_deps: CoreDeps): CommandHandler[] {
  return []
}
