// check.run (spec/phases/phase-06.md, design additions 1 and 5). Runs and stores the checks of
// a campaign's variants or of the named ones, in the command's own project file. Agent policy
// allow: the caller names targets only; the results are the engine's. No rev change, no undo.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { runChecksFor } from '@/main/checks/run-checks'
import { targetVariantIds } from '@/main/checks/read-input'
import { checkRunInput } from '@/shared/schemas/commands/check'

export function checkRun(deps: Pick<CoreDeps, 'now'>) {
  return defineCommand({
    name: 'check.run',
    input: checkRunInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const ids = targetVariantIds(ctx.project.db, input)
      const ranAt = deps.now().toISOString()
      const variants = runChecksFor(ctx, ids, ctx.actor, ranAt)
      return {
        data: { variants },
        log: input.campaignId === undefined ? {} : { campaignId: input.campaignId },
      }
    },
  })
}
