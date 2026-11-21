// S2-4 [D-088] (spec/comfyui-workflows.md "Commercial-licence dialog"): a workflow whose
// model needs a commercial licence runs only when its model label is saved in
// settings.licenceConfirmed, or the user confirmed it in the input. An agent cannot confirm,
// so for an agent the flag is ignored. Called after the workflow is chosen and before any
// job row or request.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectContext } from '@/main/commands/types'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { licenceNotConfirmedMessage } from '@/shared/providers/messages'
import { AppError } from '@/shared/schemas/result'

type Deps = { settings: Pick<CoreDeps['settings'], 'get'> }

export function checkLicence(
  deps: Deps,
  ctx: Pick<ProjectContext, 'actor'>,
  spec: WorkflowSpec,
  confirmed: boolean | undefined,
): void {
  if (spec.licence.commercialNote === null) return
  const label = spec.model.label
  if (deps.settings.get().licenceConfirmed.includes(label)) return
  if (ctx.actor === 'user' && confirmed === true) return
  throw new AppError('INVALID_INPUT', licenceNotConfirmedMessage(label), {
    reason: 'licence_not_confirmed',
    workflow: spec.id,
  })
}
