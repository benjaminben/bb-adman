// SPEC 4.2 "No address yet" and "Not offered", 14 1.41 "trial workflows are picked by the
// command" and 1.46 part B (security class): the ComfyUI checks of generation.runImages,
// made before a job row. A proven workflow first; a trial one only for the user with the
// hand-test tools on; an agent never gets a trial one, and a draft is never sent.
import type { CoreDeps } from '../../core-deps'
import type { ProjectContext } from '../types'
import { offeredWorkflow } from '../../providers/comfyui/workflows/offered'
import { reasonMessage } from '../../../shared/providers/messages'
import { AppError } from '../../../shared/schemas/result'

export const COMFY_JOB_NOT_OFFERED_MESSAGE = 'ComfyUI cannot make this kind of picture yet.'

export function tooManyReferencesMessage(max: number): string {
  return `ComfyUI takes at most ${max} reference picture(s) for this run.`
}

export function checkComfyRun(
  deps: Pick<CoreDeps, 'devTools'> & { settings: Pick<CoreDeps['settings'], 'get'> },
  ctx: Pick<ProjectContext, 'actor'>,
  referenceCount: number,
): void {
  if (deps.settings.get().comfyui.baseUrl === null) {
    throw new AppError('RULE_VIOLATION', reasonMessage('address_needed'), {
      reason: 'comfy_address_needed',
    })
  }
  const job = referenceCount > 0 ? 'image_refs' : 'image'
  const spec = offeredWorkflow({ job }, { devTools: deps.devTools, actor: ctx.actor })
  if (!spec) {
    throw new AppError('RULE_VIOLATION', COMFY_JOB_NOT_OFFERED_MESSAGE, {
      reason: 'comfy_job_not_offered',
    })
  }
  const max = spec.slots.references?.length ?? 0
  if (referenceCount > max) {
    throw new AppError('RULE_VIOLATION', tooManyReferencesMessage(max), {
      reason: 'too_many_references',
      max,
    })
  }
}
