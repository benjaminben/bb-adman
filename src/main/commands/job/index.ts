// The job command domain (SPEC 12; SPEC 14 slice D, 1.38 Y12).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { jobRetry } from './retry'
import { jobCancel } from './cancel'
import { jobMarkSeen } from './mark-seen'

export function jobCommands(deps: CoreDeps): CommandHandler[] {
  return [jobRetry(deps), jobCancel(deps), jobMarkSeen(deps)]
}
