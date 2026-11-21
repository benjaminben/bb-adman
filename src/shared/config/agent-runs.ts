// SPEC agent-runs.md (security class): the one owner of which providers an agent run may be
// ticked for, and of the bounds of agentRunLimit. Shared, so Settings shows the list the gate
// checks.
import type { ProviderInfo } from '@/shared/schemas/queries/app'

// The default of agentRunLimit: queued or running agent jobs per provider, over every open
// project.
export const AGENT_MAX_ACTIVE_RUNS = 4
export const AGENT_RUN_LIMIT_MIN = 1
export const AGENT_RUN_LIMIT_MAX = 16

export type AgentRunsRefusal = 'agent_runs_not_offered'

// The only "tick offered" function. Its callers: the gate, agentRuns.setAllowed and the
// runner's check before a job's first call.
export function agentRunsOffered(info: ProviderInfo): AgentRunsRefusal | null {
  const makesRuns = info.jobs.includes('image') || info.jobs.includes('video')
  if (!info.available || !makesRuns) return 'agent_runs_not_offered'
  return null
}

// The sentence of gate step 1, also agentRuns.setAllowed's refusal.
export function agentRunsNotOfferedMessage(label: string): string {
  return `Agents cannot start runs with ${label}.`
}
