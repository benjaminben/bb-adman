// agentRuns.setAllowed (spec/agent-runs.md, api-commands.md; FR-279, FR-280): the one writer
// of settings.agentRuns. Security class. Agent policy deny. A tick is set only for a provider
// agentRunsOffered accepts; a tick is always cleared.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { agentRunsNotOfferedMessage, agentRunsOffered } from '@/shared/config/agent-runs'
import { agentRunsSetAllowedInput } from '@/shared/schemas/commands/agent-runs'
import { AppError } from '@/shared/schemas/result'

export function agentRunsSetAllowed(deps: Pick<CoreDeps, 'settings' | 'providers'>) {
  return defineCommand({
    name: 'agentRuns.setAllowed',
    input: agentRunsSetAllowedInput,
    changesAppState: true,
    run(_ctx, input) {
      const info = deps.providers.find((p) => p.id === input.provider)
      if (!info) throw new AppError('INVALID_INPUT', 'That provider is not in this app.')
      const refusal = agentRunsOffered(info)
      if (input.allowed && refusal) {
        throw new AppError('RULE_VIOLATION', agentRunsNotOfferedMessage(info.label), {
          reason: refusal,
        })
      }
      deps.settings.setAgentRunAllowed(info.id, input.allowed)
      return { data: { provider: info.id, allowed: input.allowed } }
    },
  })
}
