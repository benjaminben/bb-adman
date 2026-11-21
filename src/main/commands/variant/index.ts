// The variant command domain (spec/structure.md, "Registering commands and queries";
// spec/editor-commands.md). Registered empty by slice P3-0; slice P3-1 adds variant.update.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'

export function variantCommands(_deps: CoreDeps): CommandHandler[] {
  return []
}
