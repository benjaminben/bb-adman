// What the run costs, one line (spec/screens-ai.md, "The run confirmation dialog"; DLG-4a,
// choice C-15). A paid provider (not local, not the fake one) gets the MoneyLine words "Paid:
// {what} → {Provider}", naming the count, references, seconds and pictures the run sends. A
// ComfyUI run names its server and workflow, the fake provider says nothing is charged; both
// keep today's words. The ComfyUI address is allowed here (FR-256). A provider the app does
// not know reaches here with `local: false`, so it counts as paid. Fan-out uses `runCost` too.
import { paidLine } from '@/renderer/ui/paid-confirm/paid-confirm'
import { plural } from '@/renderer/ui/plural'
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

export type RunCost = { paid: boolean; words: string }

const FREE = 'Nothing is charged.'

function localLine(input: SummaryInput): string {
  const { provider } = input
  if (provider.id === 'fake') return `This uses the fake provider. ${FREE}`
  if (provider.id !== 'comfyui') return `This runs on ${provider.label}. ${FREE}`
  const at = input.comfy?.address ? ` at ${input.comfy.address}` : ''
  const workflow = input.comfy ? ` with the workflow ${input.comfy.label}` : ''
  return `This runs on your ComfyUI server${at}${workflow}. ${FREE}`
}

// What a paid run sends, before the arrow.
function paidWhat(input: SummaryInput): string {
  const { job } = input
  if (job === 'cutout') return '1 cut-out'
  if (job === 'video') {
    if (!input.video) return '1 video'
    const { seconds, pictures } = input.video
    const sends = pictures > 0 ? ` + ${plural(pictures, 'picture')}` : ''
    return `1 video, ${plural(seconds, 'second')}${sends}`
  }
  const m = input.referenceCount ?? 0
  const refs = m > 0 ? ` + ${plural(m, 'reference')}` : ''
  // No count (a retry whose stored request cannot be read) names no number, never a guess.
  const pictures = input.count === undefined ? 'pictures' : plural(input.count, 'picture')
  return `${pictures}${refs}`
}

export function runCost(input: SummaryInput): RunCost {
  const { job, provider } = input
  const paid = !provider.local && provider.id !== 'fake'
  if (!paid) return { paid, words: localLine(input) }
  if (job === 'layout' || job === 'text') {
    return { paid, words: paidLine(job === 'text' ? (input.requests ?? 1) : 1, provider.label) }
  }
  return { paid, words: `Paid: ${paidWhat(input)} → ${provider.label}` }
}

export function runSummary(input: SummaryInput): string {
  return runCost(input).words
}

// The line above the cost when the provider makes another length than the one typed.
export function lengthLine(
  label: string,
  bounds: { min: number; max: number | null },
  seconds: number,
): string {
  const range = bounds.max === null ? `at least ${bounds.min}` : `${bounds.min} to ${bounds.max}`
  return `${label} makes clips of ${range} seconds, so this one will be ${seconds} seconds.`
}
