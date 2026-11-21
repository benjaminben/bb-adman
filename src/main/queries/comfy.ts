// comfy.getInfo (SPEC 4.3, 6.10.1, 6.10.10; FR-253, FR-263, FR-285). User-only: an agent is
// refused with AGENT_DENIED and gets no address. It contacts nothing. The graph, the slots
// and the source of a workflow stay in the main process.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { AppError } from '@/shared/schemas/result'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { LEAVES_ORDER } from '@/main/providers/comfyui/workflows/common'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'

export const COMFY_INFO_DENIED =
  'Agents cannot read the ComfyUI settings in this version. Ask the user to do it in the app.'

function infoOf(w: WorkflowSpec): WorkflowInfo {
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

export function comfyGetInfo(deps: Pick<CoreDeps, 'settings'>): QueryFn {
  return (_input, opts): ComfyInfo => {
    if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', COMFY_INFO_DENIED)
    const used = new Set(WORKFLOWS.flatMap((w) => w.leavesOnServer))
    return {
      address: deps.settings.get().comfyui.baseUrl,
      workflows: WORKFLOWS.map(infoOf),
      leavesOnServer: LEAVES_ORDER.filter((s) => used.has(s)),
    }
  }
}

export function comfyQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'comfy.getInfo': comfyGetInfo(deps) }
}
