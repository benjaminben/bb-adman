// What the run does, one line (spec/screens-ai.md, "The run confirmation dialog"): a paid run
// names its count and provider, a ComfyUI run its server and workflow, the fake provider says
// nothing is charged. The ComfyUI address is allowed here (FR-256).
import type { ProviderInfo } from '@/shared/schemas/queries/app'

export type RunJob = 'image' | 'cutout' | 'layout' | 'text'

export type SummaryInput = {
  job: RunJob
  provider: Pick<ProviderInfo, 'id' | 'label' | 'local'>
  count?: number
  referenceCount?: number
  // The saved address and the offered workflow's label, from comfy.getInfo.
  comfy?: { address: string | null; label: string }
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
  if (job === 'layout' || job === 'text') return `This sends 1 paid request to ${provider.label}.`
  const n = input.count ?? 1
  const m = input.referenceCount ?? 0
  const refs = m > 0 ? ` It sends ${m} reference picture(s).` : ''
  return `This will use ${n} generation(s) with ${provider.label}.${refs}`
}
