// approvals.cancelUpdate, "Stop" beside the waiting line of "Update gallery" (round-2-approvals-
// video.md "Progress and Stop"). App scope: no project transaction, so it runs while the update
// waits. Agent policy deny. Stops the campaign's run unless its gallery request has gone; the
// run itself removes its uploads and fails with publish_cancelled. Writes and sends nothing.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsCancelUpdateInput,
  type ApprovalsCancelUpdateReply,
} from '@/shared/schemas/commands/approvals'

export function approvalsCancelUpdate(deps: Pick<CoreDeps, 'approvals'>) {
  return defineCommand({
    name: 'approvals.cancelUpdate',
    input: approvalsCancelUpdateInput,
    run(_ctx, input): HandlerResult<ApprovalsCancelUpdateReply> {
      return { data: { stopped: deps.approvals.runs.cancel(input) } }
    },
  })
}
