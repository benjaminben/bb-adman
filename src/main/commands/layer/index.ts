// The layer command domain (spec/structure.md, "Registering commands and queries";
// spec/editor-commands.md). Registered empty by slice P3-0; later slices add the handlers.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'

export function layerCommands(_deps: CoreDeps): CommandHandler[] {
  return []
}
