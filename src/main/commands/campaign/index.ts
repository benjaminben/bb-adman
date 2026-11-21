// The campaign command domain (SPEC 12; SPEC 14, slice C).
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { campaignCreate } from './create'

export function campaignCommands(deps: CoreDeps): CommandHandler[] {
  return [campaignCreate(deps)]
}
