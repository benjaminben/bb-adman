// The variant command domain (spec/structure.md, "Registering commands and queries";
// spec/editor-commands.md).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { variantUpdate } from './update'

export function variantCommands(deps: CoreDeps): CommandHandler[] {
  return [variantUpdate(deps)]
}
