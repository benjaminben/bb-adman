// spec/comfyui-custom.md "The ID type, with the least ripple" (D-104), security class: the
// shipped workflows and the ones a person or an agent added, as one list. WORKFLOWS and
// NON_DRAFT_WORKFLOWS stay shipped only. The custom ones come from the store, in order of
// addedAt, so the first custom one that fits is the oldest.
import type { WorkflowStart } from '@/shared/comfy/custom-workflow'
import type { CustomWorkflowStore } from '@/main/providers/comfyui/custom/store'
import type { WorkflowSpec } from './types'
import {
  offeredWorkflow,
  pickWorkflow,
  type Who,
  type WorkflowChoice,
  type WorkflowPick,
} from './offered'
import { NON_DRAFT_WORKFLOWS, WORKFLOWS } from '.'

export type CustomWorkflows = Pick<CustomWorkflowStore, 'specs'>
export type { Who }

// No custom workflows: for the shipped-only jobs and for tests of the shipped rule alone.
export const NO_CUSTOM: CustomWorkflows = { specs: () => [] }

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

// "Which workflow a run gets": the one rule (offered.ts) over the shipped and custom lists.
export function defaultWorkflow(
  choice: WorkflowChoice,
  who: Who,
  custom: CustomWorkflows,
): WorkflowSpec | null {
  return offeredWorkflow(choice, who, allWorkflows(custom))
}

// The workflow a run gets for this choice, named or not, or why there is none.
export function workflowPick(
  choice: WorkflowChoice,
  who: Who,
  custom: CustomWorkflows,
  workflowId?: string,
): WorkflowPick {
  return pickWorkflow(choice, who, allWorkflows(custom), workflowId)
}

// Whether the caller may name it for a run of its own job and start.
export function mayName(w: WorkflowSpec, who: Who, custom: CustomWorkflows): boolean {
  return 'spec' in workflowPick(choiceOf(w), who, custom, w.id)
}

export function isDefaultWorkflow(w: WorkflowSpec, who: Who, custom: CustomWorkflows): boolean {
  return defaultWorkflow(choiceOf(w), who, custom)?.id === w.id
}
