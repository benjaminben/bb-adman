// R3-2: the words that name the service and the model doing a generative job, "{provider} ·
// {model}". The registry owns the model names (ProviderInfo.modelLabels); ComfyUI has no fixed
// model, so its name comes from the workflow the run would get (WorkflowFacts.model.label).
// One rule keeps a word from being said twice: when the provider's label ends with the
// model's first word, the label drops that word ("fal.ai Seedance" + "Seedance 2.0" gives
// "fal.ai · Seedance 2.0"). A provider with no model for the job keeps its plain label. Pure.
import type { ProviderInfo, ProviderJob } from '@/shared/schemas/queries/app'

export const COMFY_ID = 'comfyui'

type Named = Pick<ProviderInfo, 'id' | 'label'> &
  Partial<Pick<ProviderInfo, 'defaultModels' | 'modelLabels'>>
type WorkflowModel = { model: { label: string; mainFile: string } }

export type ProviderModelParts = { provider: string; model: string | null }

export function providerModelParts(label: string, model?: string | null): ProviderModelParts {
  if (!model) return { provider: label, model: null }
  const words = label.split(' ')
  const first = model.split(' ')[0]!.toLowerCase()
  if (words.length > 0 && words[words.length - 1]!.toLowerCase() === first) words.pop()
  return { provider: words.join(' '), model }
}

export function providerModelWords(label: string, model?: string | null): string {
  const parts = providerModelParts(label, model)
  if (parts.model === null) return parts.provider
  return parts.provider === '' ? parts.model : `${parts.provider} · ${parts.model}`
}

// The model a provider runs for a job: the registry's name, or for ComfyUI the model of the
// workflow the run would get (null before that is known).
export function jobModel(provider: Named, job: string, comfyModel?: string | null): string | null {
  if (provider.id === COMFY_ID) return comfyModel ?? null
  return provider.modelLabels?.[job as ProviderJob] ?? null
}

// The model of a ComfyUI workflow from comfy.getInfo, or null when none is known.
export function workflowModel(workflow?: { model?: { label: string } } | null): string | null {
  return workflow?.model?.label ?? null
}

export function serviceWords(provider: Named, job: string, comfyModel?: string | null): string {
  return providerModelWords(provider.label, jobModel(provider, job, comfyModel))
}

// A run's words from the model ID it stored: the model's name, or the ID itself; the plain
// label when it stored none.
export function storedWords(provider: Named, modelId: string | null): string {
  return providerModelWords(provider.label, modelId ? modelNameOf(modelId, [provider]) : null)
}

// As storedWords, for a sentence an agent or the log may read (a command's refusal): an ID the
// registry has no name for is left out, never shown.
export function namedWords(provider: Named, modelId: string | null): string {
  return providerModelWords(provider.label, modelId ? registryName(modelId, [provider]) : null)
}

// The models a provider runs, once each in job order, for a line that lists them ("Nano Banana
// 2.1, Gemini 3.5 Flash-Lite"); null when it has no fixed model.
export function modelList(provider: Named): string | null {
  const names = [...new Set(Object.values(provider.modelLabels ?? {}))]
  return names.length === 0 ? null : names.join(', ')
}

// fal's endpoints are one app with a path per start ("bytedance/seedance-2.0/text-to-video"):
// an ID with a slash names the same model as a default that shares everything before the last
// slash.
function appOf(id: string): string | null {
  const cut = id.lastIndexOf('/')
  return cut > 0 ? id.slice(0, cut) : null
}

function registryName(id: string, providers: readonly Named[]): string | null {
  for (const p of providers) {
    for (const [job, defaultId] of Object.entries(p.defaultModels ?? {})) {
      const app = appOf(id)
      if (defaultId !== id && (app === null || appOf(defaultId) !== app)) continue
      const name = jobModel(p, job)
      if (name) return name
    }
  }
  return null
}

// A stored model ID's name (a job row's or an asset's): the registry's name for it, else the
// model of a ComfyUI workflow whose main file it is, else the ID itself.
export function modelNameOf(
  id: string,
  providers: readonly Named[],
  workflows: readonly WorkflowModel[] = [],
): string {
  const found = registryName(id, providers)
  if (found) return found
  return workflows.find((w) => w.model.mainFile === id)?.model.label ?? id
}
