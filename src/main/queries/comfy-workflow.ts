// comfyWorkflow.list (spec/comfyui-custom.md "Commands, queries and events", D-104), both
// actors, security class: every workflow the caller may name for a picture or a video run.
// Shipped ones as the named-workflow rule allows (never a draft; a trial only with the dev
// tools on, for both actors), then every custom one. Five fields only: never a graph, a node,
// a file path or the address.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { AppError } from '@/shared/schemas/result'
import type { CustomJob } from '@/shared/comfy/custom-workflow'
import type { WorkflowJob } from '@/shared/schemas/queries/comfy'
import {
  comfyWorkflowListInput,
  type ComfyWorkflowList,
  type ListedWorkflow,
} from '@/shared/schemas/queries/comfy-workflow'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import {
  allWorkflows,
  isDefaultWorkflow,
  startOf,
  type Who,
} from '@/main/providers/comfyui/workflows/all'

const isListedJob = (job: WorkflowJob): job is CustomJob =>
  job === 'image' || job === 'image_refs' || job === 'video'

function mayName(w: WorkflowSpec, devTools: boolean): boolean {
  return w.status !== 'draft' && (w.status !== 'trial' || devTools)
}

export function comfyWorkflowList(deps: Pick<CoreDeps, 'comfyWorkflows' | 'devTools'>): QueryFn {
  return (input, opts): ComfyWorkflowList => {
    if (!comfyWorkflowListInput.safeParse(input).success) {
      throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    }
    const who: Who = { devTools: deps.devTools, actor: opts.actor }
    const workflows = allWorkflows(deps.comfyWorkflows).flatMap((w): ListedWorkflow[] =>
      isListedJob(w.job) && mayName(w, deps.devTools)
        ? [
            {
              id: w.id,
              name: w.label,
              job: w.job,
              start: startOf(w),
              isDefault: isDefaultWorkflow(w, who, deps.comfyWorkflows),
            },
          ]
        : [],
    )
    return { workflows }
  }
}

export function comfyWorkflowQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'comfyWorkflow.list': comfyWorkflowList(deps) }
}
