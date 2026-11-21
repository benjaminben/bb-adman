// SPEC 6.10.11 and spec/agent-runs.md "trial workflows, same rule for both actors" (security
// class): the one rule for which shipped workflow a run gets. A proven one first, for anyone.
// Else a trial one while the hand-test tools are on, whoever asks [D-080]. A draft is never
// sent to any server. Null means the job is not offered. A packaged app never has the tools,
// so there only proven workflows are offered.
import type { Actor } from '@/shared/schemas/events'
import type { WorkflowJob } from '@/shared/schemas/queries/comfy'
import type { WorkflowSpec } from './types'
import { WORKFLOWS } from '.'

export type WorkflowChoice = {
  job: WorkflowJob
  videoStart?: { firstFrame: boolean; references: boolean }
}

function fits(spec: WorkflowSpec, choice: WorkflowChoice): boolean {
  if (spec.job !== choice.job) return false
  if (choice.job !== 'video') return true
  return (
    spec.videoStart?.firstFrame === choice.videoStart?.firstFrame &&
    spec.videoStart?.references === choice.videoStart?.references
  )
}

export function offeredWorkflow(
  choice: WorkflowChoice,
  who: { devTools: boolean; actor: Actor },
  workflows: readonly WorkflowSpec[] = WORKFLOWS,
): WorkflowSpec | null {
  const fitting = workflows.filter((w) => fits(w, choice))
  const proven = fitting.find((w) => w.status === 'proven')
  if (proven) return proven
  if (!who.devTools) return null
  return fitting.find((w) => w.status === 'trial') ?? null
}
