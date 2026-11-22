// The approvals commands (spec/approvals.md "Commands"). Every one is deny for agents. Each
// file's slice replaces its body.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { approvalsCancelUpdate } from './cancel-update'
import { approvalsCheck } from './check'
import { approvalsCreateLink } from './create-link'
import { approvalsEndLink } from './end-link'
import { approvalsPublish } from './publish'
import { approvalsRefresh } from './refresh'
import { approvalsSetPassword } from './set-password'
import { approvalsSetService } from './set-service'

export function approvalsCommands(deps: CoreDeps): CommandHandler[] {
  return [
    approvalsSetService(deps),
    approvalsCheck(deps),
    approvalsCreateLink(deps),
    approvalsSetPassword(deps),
    approvalsPublish(deps),
    approvalsRefresh(deps),
    approvalsEndLink(deps),
    approvalsCancelUpdate(deps),
  ]
}
