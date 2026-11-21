// agentRuns.setLimit (spec/agent-runs.md, api-commands.md): the one writer of
// settings.agentRunLimit. Security class. Agent policy deny. The input schema holds the bounds.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { agentRunsSetLimitInput } from '@/shared/schemas/commands/agent-runs'

export function agentRunsSetLimit(deps: Pick<CoreDeps, 'settings'>) {
  return defineCommand({
    name: 'agentRuns.setLimit',
    input: agentRunsSetLimitInput,
    changesAppState: true,
    run(_ctx, input) {
      deps.settings.setAgentRunLimit(input.limit)
      return { data: { limit: input.limit } }
    },
  })
}
