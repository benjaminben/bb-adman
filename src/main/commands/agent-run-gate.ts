// The agent run gate (spec/agent-runs.md "Policy and bus", "Gate steps for a run"; FR-279,
// FR-280, FR-281; D-080). Security class. The bus calls it for actor agent and policy tick,
// after the project is found and before ask, prepare and run, so a refused agent causes no
// file read, no job row and no provider call. This file holds the only code in src/main/ that
// reads settings.agentRuns.
import { denialMessage } from './agent-policy'
import { requireJob } from './job/find-job'
import type { ProjectRegistry } from '@/main/db/project-registry'
import { agentRunsNotOfferedMessage, agentRunsOffered } from '@/shared/config/agent-runs'
import { jobCancelInput } from '@/shared/schemas/commands/job'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'
import type { Settings } from '@/shared/schemas/settings'
import { z } from 'zod'

export type AgentRunGateDeps = {
  projects: Pick<ProjectRegistry, 'requireOpen' | 'all'>
  providers: readonly ProviderInfo[]
  settings: { get(): Pick<Settings, 'agentRuns' | 'agentRunLimit'> }
  // Agent runs per provider that passed the gate and have no job row yet. Counted at step 3,
  // so calls sent together cannot pass the limit.
  passed: Map<string, number>
}

// What the bus calls once the command has ended, whatever its outcome.
export type GateRelease = () => void
const NOTHING_HELD: GateRelease = () => undefined

// P4-1 (spec/ai-jobs.md): the three Phase 4 runs take the same three steps.
const RUN_COMMANDS = new Set([
  'generation.runImages',
  'generation.startVideo',
  'generation.proposeLayout',
  'generation.copyOptions',
  'generation.cutOut',
])
// Every run input requires provider, so an agent never runs on the user's default provider.
const runInput = z.object({ provider: z.string() })

const denied = (message: string) => new AppError('AGENT_DENIED', message)

// The one reader of a tick: true only for a registry row agentRunsOffered accepts whose own
// entry in settings.agentRuns says allowed. An entry for any other ID is never read.
export function agentRunAllowed(
  deps: Pick<AgentRunGateDeps, 'providers' | 'settings'>,
  providerId: string,
): boolean {
  const info = deps.providers.find((p) => p.id === providerId)
  if (!info || agentRunsOffered(info) !== null) return false
  const ticks = deps.settings.get().agentRuns
  return Object.hasOwn(ticks, info.id) && ticks[info.id]?.allowed === true
}

// The sentence of gate step 3. It holds no number, so an agent learns neither the limit nor
// how many runs other projects hold.
export function agentRunLimitMessage(label: string): string {
  return `Agents already have the most runs allowed with ${label}. Wait for one to finish.`
}

// Jobs an agent started that are queued or running with this provider, in every open project.
function agentActiveRuns(deps: AgentRunGateDeps, providerId: string): number {
  let count = 0
  for (const handle of deps.projects.all()) {
    const row = handle.db
      .prepare(
        `SELECT COUNT(*) AS n FROM "job" WHERE "started_by" = 'agent'
         AND "status" IN ('queued', 'running') AND "provider" = ?`,
      )
      .get(providerId) as { n: number }
    count += row.n
  }
  return count
}

function hold(passed: Map<string, number>, providerId: string): GateRelease {
  passed.set(providerId, (passed.get(providerId) ?? 0) + 1)
  return () => {
    const left = (passed.get(providerId) ?? 1) - 1
    if (left > 0) passed.set(providerId, left)
    else passed.delete(providerId)
  }
}

function gateRun(deps: AgentRunGateDeps, providerId: string): GateRelease {
  const info = deps.providers.find((p) => p.id === providerId)
  if (!info) throw denied('Agents cannot start runs with that provider.')
  if (agentRunsOffered(info) !== null) throw denied(agentRunsNotOfferedMessage(info.label))
  if (!agentRunAllowed(deps, info.id)) {
    throw denied(
      `The user has not allowed agents to start runs with ${info.label}. They can allow it in Adman's Settings.`,
    )
  }
  const active = agentActiveRuns(deps, info.id) + (deps.passed.get(info.id) ?? 0)
  if (active >= deps.settings.get().agentRunLimit) {
    throw denied(agentRunLimitMessage(info.label))
  }
  return hold(deps.passed, info.id)
}

// job.cancel: no tick needed, only a run the agent started. cancelRefusal follows in the
// command, as for the user.
function gateCancel(deps: AgentRunGateDeps, input: unknown): void {
  const parsed = jobCancelInput.safeParse(input)
  if (!parsed.success) throw denied(denialMessage('job.cancel'))
  const { projectId, jobId } = parsed.data
  const row = requireJob(deps.projects.requireOpen(projectId), jobId)
  if (row.startedBy !== 'agent') throw denied('Agents can cancel only runs they started.')
}

// Throws AGENT_DENIED on a refusal. On a pass it gives the release the bus calls once the
// command has ended.
export function agentRunGate(deps: AgentRunGateDeps, name: string, input: unknown): GateRelease {
  if (RUN_COMMANDS.has(name)) {
    const parsed = runInput.safeParse(input)
    if (!parsed.success) throw denied(denialMessage(name))
    return gateRun(deps, parsed.data.provider)
  }
  if (name === 'job.cancel') {
    gateCancel(deps, input)
    return NOTHING_HELD
  }
  // Any other tick command is refused, generation.runFill included.
  throw denied(denialMessage(name))
}
