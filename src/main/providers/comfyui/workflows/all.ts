// spec/comfyui-custom.md "The ID type, with the least ripple" (D-104), security class: the
// shipped workflows and the ones a person or an agent added, as one list. WORKFLOWS and
// NON_DRAFT_WORKFLOWS stay shipped only. The custom ones come from the store, in order of
// addedAt, so the first custom one that fits is the oldest.
import type { Actor } from '@/shared/schemas/events'
import type { WorkflowStart } from '@/shared/comfy/custom-workflow'
import type { CustomWorkflowStore } from '@/main/providers/comfyui/custom/store'
import type { WorkflowSpec } from './types'
import { offeredWorkflow, type WorkflowChoice } from './offered'
import { NON_DRAFT_WORKFLOWS, WORKFLOWS } from '.'

export type CustomWorkflows = Pick<CustomWorkflowStore, 'specs'>
export type Who = { devTools: boolean; actor: Actor }

// The shipped list, then the custom ones by addedAt.
export function allWorkflows(custom: CustomWorkflows): readonly WorkflowSpec[] {
  return [...WORKFLOWS, ...custom.specs()]
}

// The list the check compares: the shipped ones that are not drafts, then the custom ones.
export function checkedWorkflows(custom: CustomWorkflows): readonly WorkflowSpec[] {
  return [...NON_DRAFT_WORKFLOWS, ...custom.specs()]
}

export function choiceOf(w: WorkflowSpec): WorkflowChoice {
  return { job: w.job, ...(w.videoStart && { videoStart: w.videoStart }) }
}

// How a video starts, or null for any other job.
export function startOf(w: WorkflowSpec): WorkflowStart | null {
  if (w.job !== 'video') return null
  if (w.videoStart?.firstFrame) return 'first_frame'
  return w.videoStart?.references ? 'references' : 'prompt'
}

function fits(w: WorkflowSpec, choice: WorkflowChoice): boolean {
  if (w.job !== choice.job) return false
  if (choice.job !== 'video') return true
  return (
    w.videoStart?.firstFrame === choice.videoStart?.firstFrame &&
    w.videoStart?.references === choice.videoStart?.references
  )
}

// "Which workflow a run gets", no workflow named: the shipped rule as today, else the oldest
// custom one that fits.
export function defaultWorkflow(
  choice: WorkflowChoice,
  who: Who,
  custom: CustomWorkflows,
): WorkflowSpec | null {
  return offeredWorkflow(choice, who) ?? custom.specs().find((w) => fits(w, choice)) ?? null
}

export function isDefaultWorkflow(w: WorkflowSpec, who: Who, custom: CustomWorkflows): boolean {
  return defaultWorkflow(choiceOf(w), who, custom) === w
}
