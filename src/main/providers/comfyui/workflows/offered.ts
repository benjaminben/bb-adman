// SPEC 6.10.11, spec/agent-runs.md "trial workflows, same rule for both actors" and
// spec/comfyui-custom.md "Which workflow a run gets" (D-104), security class: the one rule
// for which workflow a run gets, for the commands, the list and the adapters alike.
// No workflow named: a proven shipped one first, for anyone; else a trial one while the
// hand-test tools are on, whoever asks [D-080]; else the oldest custom one that fits.
// A named one: found in the list, not a draft, a trial only with the tools on, a custom one
// always, and it must fit the job and the video start. A draft is never sent to any server.
// A packaged app never has the tools, so there only proven and custom workflows are offered.
import type { Actor } from '@/shared/schemas/events'
import type { WorkflowJob } from '@/shared/schemas/queries/comfy'
import type { WorkflowSpec } from './types'
import { WORKFLOWS } from '.'

export type WorkflowChoice = {
  job: WorkflowJob
  videoStart?: { firstFrame: boolean; references: boolean }
}

export type Who = { devTools: boolean; actor: Actor }

export type WorkflowRefusal =
  'comfy_workflow_not_found' | 'comfy_job_not_offered' | 'comfy_workflow_wrong_job'

export type WorkflowPick = { spec: WorkflowSpec } | { refusal: WorkflowRefusal }

export function fits(spec: WorkflowSpec, choice: WorkflowChoice): boolean {
  if (spec.job !== choice.job) return false
  if (choice.job !== 'video') return true
  return (
    spec.videoStart?.firstFrame === choice.videoStart?.firstFrame &&
    spec.videoStart?.references === choice.videoStart?.references
  )
}

function byDefault(
  choice: WorkflowChoice,
  who: Who,
  workflows: readonly WorkflowSpec[],
): WorkflowSpec | null {
  const fitting = workflows.filter((w) => fits(w, choice))
  const proven = fitting.find((w) => w.status === 'proven')
  if (proven) return proven
  const trial = who.devTools ? fitting.find((w) => w.status === 'trial') : undefined
  return trial ?? fitting.find((w) => w.status === 'custom') ?? null
}

function byName(
  choice: WorkflowChoice,
  who: Who,
  workflows: readonly WorkflowSpec[],
  workflowId: string,
): WorkflowPick {
  const named = workflows.find((w) => w.id === workflowId)
  if (!named || named.status === 'draft') return { refusal: 'comfy_workflow_not_found' }
  if (named.status === 'trial' && !who.devTools) return { refusal: 'comfy_job_not_offered' }
  if (!fits(named, choice)) return { refusal: 'comfy_workflow_wrong_job' }
  return { spec: named }
}

// The workflow a run gets, or why there is none. `workflows` is the shipped list, then the
// custom ones by addedAt (allWorkflows).
export function pickWorkflow(
  choice: WorkflowChoice,
  who: Who,
  workflows: readonly WorkflowSpec[],
  workflowId?: string,
): WorkflowPick {
  if (workflowId !== undefined) return byName(choice, who, workflows, workflowId)
  const spec = byDefault(choice, who, workflows)
  return spec ? { spec } : { refusal: 'comfy_job_not_offered' }
}

// The same rule, as the workflow or null.
export function offeredWorkflow(
  choice: WorkflowChoice,
  who: Who,
  workflows: readonly WorkflowSpec[] = WORKFLOWS,
  workflowId?: string,
): WorkflowSpec | null {
  const pick = pickWorkflow(choice, who, workflows, workflowId)
  return 'spec' in pick ? pick.spec : null
}
