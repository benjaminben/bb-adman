// approvals.check (spec/approvals.md "approvals.check"): asks the service's health route with
// the saved address and key, read afresh at each press. Security class; agent policy deny.
// Writes nothing. Failures are the client's fixed sentences.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { approvalsCheckInput, type ApprovalsCheckReply } from '@/shared/schemas/commands/approvals'
import { createApprovalsClient, TOTAL_MS } from '@/main/approvals/client'
import { requireApprovalsService } from '@/main/approvals/ready'

export function approvalsCheck(
  deps: Pick<CoreDeps, 'settings' | 'secrets' | 'devTools' | 'log'>,
  limits: { totalMs: number } = { totalMs: TOTAL_MS },
) {
  return defineCommand({
    name: 'approvals.check',
    input: approvalsCheckInput,
    async run(): Promise<HandlerResult<ApprovalsCheckReply>> {
      const service = requireApprovalsService(deps)
      const client = createApprovalsClient(service, {
        allowLocalHttp: deps.devTools,
        log: deps.log,
        totalMs: limits.totalMs,
      })
      await client.health()
      return { data: { ok: true } }
    },
  })
}
