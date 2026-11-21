// SPEC 6.10.11 and 14 "[1.41] The test path" (security class): the one rule for which
// shipped workflow a run gets. A proven one first. A trial one only for the user with the
// hand-test tools on, where no proven one exists. An agent never gets a trial one, and a
// draft is never sent to any server. Null means the job is not offered.
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
  if (!who.devTools || who.actor !== 'user') return null
  return fitting.find((w) => w.status === 'trial') ?? null
}
