// R3-2: the run tools' words for the model each provider uses. A registry model is named with
// its model ID ('Nano Banana 2.1, model ID "gemini-nano-banana-2.1"'); ComfyUI has no fixed
// model, so its words name the models of the shipped workflows for the job. Static: built from
// the registry and the shipped workflow list, never from the user's server.
import { NON_DRAFT_WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { listProviders } from '@/main/providers/registry'
import type { WorkflowJob } from '@/shared/schemas/queries/comfy'

const PROVIDERS = listProviders({})

// "{name}, model ID "{id}"", or '' when the provider has no model for the job.
export function registryModel(providerId: string, job: string): string {
  const p = PROVIDERS.find((x) => x.id === providerId)
  const id = p?.defaultModels[job]
  const name = p?.modelLabels?.[job as keyof NonNullable<typeof p.modelLabels>]
  return id && name ? `${name}, model ID "${id}"` : ''
}

// The models of the shipped ComfyUI workflows for these jobs, once each: "MOSS-Image or FLUX 3
// klein".
export function comfyModels(jobs: readonly WorkflowJob[]): string {
  const names = NON_DRAFT_WORKFLOWS.filter((w) => jobs.includes(w.job)).map((w) => w.model.label)
  return [...new Set(names)].join(' or ')
}
