// comfy.getInfo (SPEC 4.3, 6.10.1, 6.10.10; FR-253, FR-263, FR-285). User-only: an agent is
// refused with AGENT_DENIED and gets no address. It contacts nothing. The graph, the slots
// and the source of a workflow stay in the main process. D-104: the custom workflows follow
// the shipped ones, each offered, with when and by whom it was added.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { AppError } from '@/shared/schemas/result'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { LEAVES_ORDER } from '@/main/providers/comfyui/workflows/common'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { offeredWorkflow } from '@/main/providers/comfyui/workflows/offered'
import { isDefaultWorkflow, type Who } from '@/main/providers/comfyui/workflows/all'
import type { CustomEntry } from '@/main/providers/comfyui/custom/store'

type Deps = Pick<CoreDeps, 'settings' | 'devTools' | 'comfyWorkflows'>

export const COMFY_INFO_DENIED =
  'Agents cannot read the ComfyUI settings in this version. Ask the user to do it in the app.'

// S2-4: true for the workflow offeredWorkflow gives the user for its job and start pair.
function offeredToUser(w: WorkflowSpec, devTools: boolean): boolean {
  const choice = { job: w.job, ...(w.videoStart && { videoStart: w.videoStart }) }
  return offeredWorkflow(choice, { devTools, actor: 'user' }) === w
}

function factsOf(w: WorkflowSpec) {
  return {
    id: w.id,
    label: w.label,
    job: w.job,
    ...(w.videoStart && { videoStart: w.videoStart }),
    status: w.status,
    model: w.model,
    needs: w.needs,
    size: w.size,
    ...(w.video && { video: w.video }),
    licence: w.licence,
    leavesOnServer: w.leavesOnServer,
  }
}

function shippedInfo(w: WorkflowSpec, who: Who, deps: Deps): WorkflowInfo {
  return {
    ...factsOf(w),
    offered: offeredToUser(w, who.devTools),
    isDefault: isDefaultWorkflow(w, who, deps.comfyWorkflows),
  }
}

function customInfo({ spec, stored, checked }: CustomEntry, who: Who, deps: Deps): WorkflowInfo {
  return {
    ...factsOf(spec),
    offered: true,
    isDefault: isDefaultWorkflow(spec, who, deps.comfyWorkflows),
    custom: { addedBy: stored.addedBy, addedAt: stored.addedAt, nodeCount: checked.nodeCount },
  }
}

export function comfyGetInfo(deps: Deps): QueryFn {
  return (_input, opts): ComfyInfo => {
    if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', COMFY_INFO_DENIED)
    const who: Who = { devTools: deps.devTools, actor: 'user' }
    const workflows = [
      ...WORKFLOWS.map((w) => shippedInfo(w, who, deps)),
      ...deps.comfyWorkflows.list().map((e) => customInfo(e, who, deps)),
    ]
    const used = new Set(workflows.flatMap((w) => w.leavesOnServer))
    return {
      address: deps.settings.get().comfyui.baseUrl,
      workflows,
      leavesOnServer: LEAVES_ORDER.filter((s) => used.has(s)),
    }
  }
}

export function comfyQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'comfy.getInfo': comfyGetInfo(deps) }
}
