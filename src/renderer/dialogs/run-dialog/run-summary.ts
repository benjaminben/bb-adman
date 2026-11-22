// What the run does, one line (spec/screens-ai.md, "The run confirmation dialog"): a paid run
// names its count and provider, a ComfyUI run its server and workflow, the fake provider says
// nothing is charged. The ComfyUI address is allowed here (FR-256). R2E-8 (round-2-editor.md
// D4): a paid video names the length and the pictures it sends, and a length the provider
// changes gets a second line.
import { paidLine } from '@/renderer/screens/campaign/paid-confirm/paid-confirm'
import type { ProviderInfo } from '@/shared/schemas/queries/app'

export type RunJob = 'image' | 'cutout' | 'layout' | 'text' | 'video'

// What a video run sends: whole seconds and the pictures.
export type VideoSent = { seconds: number; pictures: number }

export type SummaryInput = {
  job: RunJob
  provider: Pick<ProviderInfo, 'id' | 'label' | 'local'>
  count?: number
  referenceCount?: number
  // P6-18: the paid requests a text run sends (one per translation job); 1 when not given.
  requests?: number
  // The saved address and the offered workflow's label, from comfy.getInfo.
  comfy?: { address: string | null; label: string }
  video?: VideoSent
}

const FREE = 'Nothing is charged.'

export function runSummary(input: SummaryInput): string {
  const { job, provider } = input
  if (provider.id === 'fake') return `This uses the fake provider. ${FREE}`
  if (provider.id === 'comfyui') {
    const at = input.comfy?.address ? ` at ${input.comfy.address}` : ''
    const workflow = input.comfy ? ` with the workflow ${input.comfy.label}` : ''
    return `This runs on your ComfyUI server${at}${workflow}. ${FREE}`
  }
  const requests = input.requests ?? 1
  if (job === 'text' && requests > 1) return paidLine(requests, provider.label)
  if (job === 'layout' || job === 'text') return `This sends 1 paid request to ${provider.label}.`
  if (job === 'video' && input.video) {
    const { seconds, pictures } = input.video
    const sends = pictures > 0 ? ` It sends ${pictures} picture(s).` : ''
    return `This will use 1 video generation of ${seconds} seconds with ${provider.label}.${sends}`
  }
  const n = input.count ?? 1
  const m = input.referenceCount ?? 0
  const refs = m > 0 ? ` It sends ${m} reference picture(s).` : ''
  return `This will use ${n} generation(s) with ${provider.label}.${refs}`
}

// The second line when the provider makes another length than the one typed.
export function lengthLine(
  label: string,
  bounds: { min: number; max: number | null },
  seconds: number,
): string {
  const range = bounds.max === null ? `at least ${bounds.min}` : `${bounds.min} to ${bounds.max}`
  return `${label} makes clips of ${range} seconds, so this one will be ${seconds} seconds.`
}
