// The campaign command domain (SPEC 12; SPEC 14, slice C).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { campaignCreate } from './create'
import { campaignDelete } from './delete'
import { campaignUpdate } from './update'

export function campaignCommands(deps: CoreDeps): CommandHandler[] {
  return [campaignCreate(deps), campaignUpdate(), campaignDelete()]
}
