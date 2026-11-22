// The clip command domain (spec/phases/phase-07.md, "Clips and the track").
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { clipAdd } from './add'
import { clipUpdate } from './update'
import { clipRemove } from './remove'
import { clipReorder } from './reorder'
import { clipRestore } from './restore'
import { clipAddGenerated } from './add-generated'

export function clipCommands(deps: CoreDeps): CommandHandler[] {
  return [
    clipAdd(deps),
    clipUpdate(deps),
    clipRemove(deps),
    clipReorder(deps),
    clipRestore(deps),
    clipAddGenerated(deps),
  ]
}
