// SPEC 4.2 "No address yet" and "Not offered", 14 1.41 "trial workflows are picked by the
// command" and 1.46 part B (security class): the ComfyUI checks of generation.runImages,
// made before a job row. It gives back the chosen workflow. A proven workflow first; a trial one only while the hand-test tools
// are on, for the user and an agent alike; a draft is never sent.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectContext } from '@/main/commands/types'
import { offeredWorkflow } from '@/main/providers/comfyui/workflows/offered'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import {
  COMFY_JOB_NOT_OFFERED_MESSAGE,
  reasonMessage,
  tooManyReferencesMessage,
} from '@/shared/providers/messages'
import { AppError } from '@/shared/schemas/result'

// Also given by generation.startVideo for too many references (SPEC 14 1.60 N-4).
export const tooManyReferences = (max: number) =>
  new AppError('RULE_VIOLATION', tooManyReferencesMessage(max), {
    reason: 'too_many_references',
    max,
  })

export function checkComfyRun(
  deps: Pick<CoreDeps, 'devTools'> & { settings: Pick<CoreDeps['settings'], 'get'> },
  ctx: Pick<ProjectContext, 'actor'>,
  referenceCount: number,
): WorkflowSpec {
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
  if (referenceCount > max) throw tooManyReferences(max)
  return spec
}
