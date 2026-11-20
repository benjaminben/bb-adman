import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { projectCreate } from './create'
import { projectOpen } from './open'
import { projectClose } from './close'

export function projectCommands(deps: CoreDeps): CommandHandler[] {
  return [projectCreate(deps), projectOpen(deps), projectClose(deps)]
}
