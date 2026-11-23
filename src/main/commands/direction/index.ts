// The direction command domain (spec/links-and-sync.md, "Directions"). An agent may add
// and rename a direction; its delete asks the user (D-105).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { directionCreateFromMaster } from './create-from-master'
import { directionDelete } from './delete'
import { directionRename } from './rename'

export function directionCommands(deps: CoreDeps): CommandHandler[] {
  return [directionCreateFromMaster(deps), directionRename(deps), directionDelete(deps)]
}
