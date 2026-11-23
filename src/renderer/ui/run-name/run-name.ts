// R3-2: the words that name the service and model of one job row, for job progress, failure
// and run lines: "{provider} · {model}". The model is the one the row stored (its name, or the
// ID itself when the name is unknown). A ComfyUI row stores no fixed model, so its model is
// that of the workflow the run named (request.workflowId, D-104), else that of the workflow
// comfy.getInfo offers for the row's kind. Pure.
import { offeredFor } from '@/renderer/screens/campaign/offered-workflow'
import {
  COMFY_ID,
  modelNameOf,
  providerModelWords,
  workflowModel,
} from '@/shared/providers/model-words'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { isCustomWorkflowId } from '@/shared/comfy/custom-workflow'
import type { ComfyInfo, WorkflowJob } from '@/shared/schemas/queries/comfy'
import type { JobRow } from '@/shared/schemas/rows/job'

type Named = Pick<ProviderInfo, 'id' | 'label'> &
  Partial<Pick<ProviderInfo, 'defaultModels' | 'modelLabels'>>
type Row = Pick<JobRow, 'kind' | 'provider' | 'model' | 'request'>

function comfyJob(row: Row): WorkflowJob | null {
  if (row.kind === 'image_generation') {
    const refs = (row.request as { referenceAssetIds?: unknown } | null)?.referenceAssetIds
    return Array.isArray(refs) && refs.length > 0 ? 'image_refs' : 'image'
  }
  if (row.kind === 'cutout') return 'cutout'
  if (row.kind === 'generative_fill') return 'extend'
  return row.kind === 'video_generation' ? 'video' : null
}

// D-104: the workflow the run named. A custom one reads by its own name, a shipped one by its
// model; a custom one no longer on this computer reads "Custom workflow". Undefined when the
// row named none, or one this list does not know.
function namedModel(row: Row, info: ComfyInfo | null): string | null | undefined {
  const id = (row.request as { workflowId?: unknown } | null)?.workflowId
  if (typeof id !== 'string' || info === null) return undefined
  const found = info.workflows.find((w) => w.id === id)
  if (found) return found.status === 'custom' ? found.label : workflowModel(found)
  return isCustomWorkflowId(id) ? 'Custom workflow' : undefined
}

export function rowModel(row: Row, providers: readonly Named[], info: ComfyInfo | null) {
  if (row.model) return modelNameOf(row.model, providers, info?.workflows)
  if (row.provider !== COMFY_ID) return null
  const named = namedModel(row, info)
  if (named !== undefined) return named
  const job = comfyJob(row)
  return job === null ? null : workflowModel(offeredFor(info, job))
}

// Whether the row's words wait on comfy.getInfo.
export const needsComfyInfo = (row: Row | null) =>
  row !== null && row.provider === COMFY_ID && !row.model

export function runName(
  row: Row,
  providers: readonly Named[],
  info: ComfyInfo | null,
  fallback: string,
): string {
  const label = providers.find((p) => p.id === row.provider)?.label ?? row.provider ?? fallback
  return providerModelWords(label, rowModel(row, providers, info))
}
