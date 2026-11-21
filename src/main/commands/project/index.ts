import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { projectCreate } from './create'
import { projectOpen } from './open'
import { projectClose } from './close'
import { projectPackage } from './package'
import { projectSetAssetsDir } from './set-assets-dir'

export function projectCommands(deps: CoreDeps): CommandHandler[] {
  return [
    projectCreate(deps),
    projectOpen(deps),
    projectClose(deps),
    projectPackage(),
    projectSetAssetsDir(deps),
  ]
}
