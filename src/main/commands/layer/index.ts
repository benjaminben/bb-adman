// The layer command domain (spec/structure.md, "Registering commands and queries";
// spec/editor-commands.md). Each slice adds its handlers to the list.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { layerUpdate } from './update'

export function layerCommands(deps: CoreDeps): CommandHandler[] {
  return [layerUpdate(deps)]
}
