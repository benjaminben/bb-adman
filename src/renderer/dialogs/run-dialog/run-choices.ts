// The run dialog's provider choices (spec/screens-ai.md, "The run confirmation dialog"): every
// provider whose `jobs` holds the job. One not available is disabled; ComfyUI is disabled when
// comfy.getInfo offers no workflow for the run, and an offered `trial` workflow is marked
// (spec/screens-campaign.md, "The trial mark in the panels"). For a cut-out ComfyUI is listed
// first (OI-55). R2E-8 (round-2-editor.md D4): for a video, a provider with an offer
// (video-offers.ts) that lacks the start is disabled; ComfyUI needs an offered workflow for the
// start's pair. DLG-4a: a disabled choice keeps only its name; `reason` says why.
import { offeredFor } from '@/renderer/screens/campaign/offered-workflow'
import { STARTS } from '@/renderer/editor/generate-panel/video-start'
import { videoOffer, type VideoStartKind } from '@/shared/config/video-offers'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { RunJob } from './run-summary'

export type Choice = {
  provider: ProviderInfo
  enabled: boolean
  label: string
  reason?: string
  trial: boolean
  workflow?: WorkflowInfo
}

const COMFY = 'comfyui'

export const REASONS = {
  unavailable: 'Not yet available',
  noWorkflow: 'No workflow for this yet',
  cannotStart: 'Cannot start this way',
} as const

const off = (base: Choice, reason: string): Choice => ({ ...base, enabled: false, reason })

// The workflow job a ComfyUI run of this kind needs: pictures with a reference are
// `image_refs`. Layout and text have none.
function comfyJob(job: RunJob, referenceCount: number): string | null {
  if (job === 'image') return referenceCount > 0 ? 'image_refs' : 'image'
  return job === 'cutout' ? 'cutout' : null
}

// A video choice once the provider is available: the start must be one it offers.
function videoChoice(base: Choice, start: VideoStartKind, info: ComfyInfo | null): Choice {
  const { provider } = base
  const offer = videoOffer(provider.id)
  if (offer) return offer.starts.includes(start) ? base : off(base, REASONS.cannotStart)
  if (provider.id !== COMFY) return start === 'prompt' ? base : off(base, REASONS.cannotStart)
  const pair = STARTS.find((s) => s.id === start)?.pair
  if (!pair) return off(base, REASONS.cannotStart)
  const workflow = offeredFor(info, 'video', pair)
  if (!workflow) return off(base, REASONS.noWorkflow)
  return { ...base, trial: workflow.status === 'trial', workflow }
}

function choiceFor(
  provider: ProviderInfo,
  wanted: string | null,
  info: ComfyInfo | null,
  start: VideoStartKind | undefined,
): Choice {
  const base = { provider, enabled: true, label: provider.label, trial: false }
  if (!provider.available) return off(base, REASONS.unavailable)
  if (start !== undefined) return videoChoice(base, start, info)
  if (provider.id !== COMFY) return base
  // Before comfy.getInfo answers, no workflow is known.
  const workflow = info?.workflows.find((w) => w.offered && w.job === wanted)
  if (!workflow) return off(base, REASONS.noWorkflow)
  return { ...base, trial: workflow.status === 'trial', workflow }
}

export function runChoices(
  job: RunJob,
  providers: ProviderInfo[],
  info: ComfyInfo | null,
  referenceCount: number,
  videoStart?: VideoStartKind,
): Choice[] {
  const listed = providers.filter((p) => p.jobs.includes(job))
  if (job === 'cutout') listed.sort((a, b) => Number(b.id === COMFY) - Number(a.id === COMFY))
  const wanted = comfyJob(job, referenceCount)
  const start = job === 'video' ? (videoStart ?? 'prompt') : undefined
  return listed.map((p) => choiceFor(p, wanted, info, start))
}

// The saved default for the job when it is enabled, else the first enabled choice.
export function startChoice(choices: Choice[], preferred: string | undefined): string | null {
  const enabled = choices.filter((c) => c.enabled)
  const saved = enabled.find((c) => c.provider.id === preferred)
  return (saved ?? enabled[0])?.provider.id ?? null
}
