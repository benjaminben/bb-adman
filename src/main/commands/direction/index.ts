// The direction command domain (spec/links-and-sync.md, "Directions"). Every one is deny for
// agents. P5-11 replaces each file's body; this list does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { directionCreateFromMaster } from './create-from-master'
import { directionDelete } from './delete'
import { directionRename } from './rename'
import { directionRestore } from './restore'

export function directionCommands(deps: CoreDeps): CommandHandler[] {
  return [
    directionCreateFromMaster(deps),
    directionRename(deps),
    directionDelete(deps),
    directionRestore(deps),
  ]
}
