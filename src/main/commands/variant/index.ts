// The variant command domain (spec/structure.md, "Registering commands and queries";
// spec/editor-commands.md).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { variantUpdate } from './update'
import { variantFanOut } from './fan-out'
import { variantAdd } from './add'
import { variantDelete } from './delete'
import { variantRemove } from './remove'
import { variantRestore } from './restore'
import { variantRestoreLayers } from './restore-layers'

export function variantCommands(deps: CoreDeps): CommandHandler[] {
  return [
    variantUpdate(deps),
    variantFanOut(deps),
    variantAdd(deps),
    variantDelete(deps),
    variantRemove(deps),
    variantRestore(deps),
    variantRestoreLayers(deps),
  ]
}
