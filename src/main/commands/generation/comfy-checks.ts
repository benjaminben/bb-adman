// SPEC 4.2 "No address yet" and "Not offered", 14 1.41 "trial workflows are picked by the
// command" and 1.46 part B (security class): the ComfyUI checks of generation.runImages,
// made before a job row. It gives back the chosen workflow. A proven workflow first; a trial
// one only while the hand-test tools are on, for the user and an agent alike; a draft is
// never sent. D-104: a named workflow, or a custom one when no shipped one is offered.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectContext } from '@/main/commands/types'
import {
  NO_CUSTOM,
  workflowPick,
  type CustomWorkflows,
} from '@/main/providers/comfyui/workflows/all'
import type { WorkflowChoice, WorkflowRefusal } from '@/main/providers/comfyui/workflows/offered'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import type { WorkflowJob } from '@/shared/schemas/queries/comfy'
import { checkLicence } from './licence-check'
import {
  COMFY_JOB_NOT_OFFERED_MESSAGE,
  COMFY_WORKFLOW_NOT_FOUND_MESSAGE,
  COMFY_WORKFLOW_WRONG_JOB_MESSAGE,
  reasonMessage,
  tooFewReferencesMessage,
  tooManyReferencesMessage,
} from '@/shared/providers/messages'
import { AppError } from '@/shared/schemas/result'

// Also given by generation.startVideo for too many references (SPEC 14 1.60 N-4).
export const tooManyReferences = (max: number) =>
  new AppError('RULE_VIOLATION', tooManyReferencesMessage(max), {
    reason: 'too_many_references',
    max,
  })

// D-104: fewer pictures than the chosen workflow's reference marks.
export const tooFewReferences = (min: number) =>
  new AppError('RULE_VIOLATION', tooFewReferencesMessage(min), {
    reason: 'too_few_references',
    min,
  })

// The store is optional, so a test of the shipped rule alone need not name it.
export type ComfyCheckDeps = Pick<CoreDeps, 'devTools'> & {
  settings: Pick<CoreDeps['settings'], 'get'>
  comfyWorkflows?: CustomWorkflows
}
type Deps = ComfyCheckDeps
type Ctx = Pick<ProjectContext, 'actor'>

const NAMED_REFUSALS: Record<Exclude<WorkflowRefusal, 'comfy_job_not_offered'>, string> = {
  comfy_workflow_not_found: COMFY_WORKFLOW_NOT_FOUND_MESSAGE,
  comfy_workflow_wrong_job: COMFY_WORKFLOW_WRONG_JOB_MESSAGE,
}

export function requireAddress(deps: Pick<Deps, 'settings'>): void {
  if (deps.settings.get().comfyui.baseUrl === null) {
    throw new AppError('RULE_VIOLATION', reasonMessage('address_needed'), {
      reason: 'comfy_address_needed',
    })
  }
}

// D-104 "Which workflow a run gets": the one rule (offered.ts) over the shipped and custom
// workflows. `notOffered` is the job's own comfy_job_not_offered refusal.
export function chosenWorkflow(
  deps: Deps,
  ctx: Ctx,
  choice: WorkflowChoice,
  workflowId: string | undefined,
  notOffered: () => AppError,
): WorkflowSpec {
  const who = { devTools: deps.devTools, actor: ctx.actor }
  const pick = workflowPick(choice, who, deps.comfyWorkflows ?? NO_CUSTOM, workflowId)
  if ('spec' in pick) return pick.spec
  if (pick.refusal === 'comfy_job_not_offered') throw notOffered()
  throw new AppError('RULE_VIOLATION', NAMED_REFUSALS[pick.refusal], { reason: pick.refusal })
}

const pictureNotOffered = () =>
  new AppError('RULE_VIOLATION', COMFY_JOB_NOT_OFFERED_MESSAGE, {
    reason: 'comfy_job_not_offered',
  })

// The reference count against the chosen workflow's slots (SPEC 6.10.6, D-104).
export function checkReferenceCount(spec: WorkflowSpec, count: number): void {
  const max = spec.slots.references?.length ?? 0
  if (count > max) throw tooManyReferences(max)
  const min = spec.slots.minReferences ?? 0
  if (count < min) throw tooFewReferences(min)
}

export function checkComfyRun(
  deps: Deps,
  ctx: Ctx,
  referenceCount: number,
  workflowId?: string,
): WorkflowSpec {
  requireAddress(deps)
  const job = referenceCount > 0 ? 'image_refs' : 'image'
  const spec = chosenWorkflow(deps, ctx, { job }, workflowId, pictureNotOffered)
  checkReferenceCount(spec, referenceCount)
  return spec
}

// Cut-out and extend stay shipped only and never take a workflow ID (D-104).
function shippedFor(deps: Deps, ctx: Ctx, job: WorkflowJob): WorkflowSpec {
  requireAddress(deps)
  const shipped = { ...deps, comfyWorkflows: NO_CUSTOM }
  return chosenWorkflow(shipped, ctx, { job }, undefined, pictureNotOffered)
}

// P4-11 (spec/ai-jobs.md "Cut-out" step 4): the cut-out's ComfyUI checks, the licence check
// last. An agent's licenceConfirmed is ignored there (checkLicence).
export function checkComfyCutout(
  deps: Deps,
  ctx: Ctx,
  licenceConfirmed: boolean | undefined,
): WorkflowSpec {
  const spec = shippedFor(deps, ctx, 'cutout')
  checkLicence(deps, ctx, spec, licenceConfirmed)
  return spec
}

// spec/links-and-sync.md "Generative fill" step 2: the fill's ComfyUI checks (the extend
// workflow; none while moss-extend is a draft), the licence check last. Used by
// generation.runFill and by job.retry of a ComfyUI fill. Nothing is sent to the server here.
export function checkComfyExtend(
  deps: Deps,
  ctx: Ctx,
  licenceConfirmed: boolean | undefined,
): WorkflowSpec {
  const spec = shippedFor(deps, ctx, 'extend')
  checkLicence(deps, ctx, spec, licenceConfirmed)
  return spec
}
