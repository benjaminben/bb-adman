// spec/screens-ai.md, "Attached jobs and the close warning": the words of the warning. A kind
// the spec gives no task words for (generative fill; or a job whose first row has not come yet)
// is "the AI task". A translation job is "translating" (P6-13).
import type { JobKind } from '@/shared/config/job-kinds'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { AttachedJob } from '@/renderer/stores/attached-store'

export type ClosePlace = 'tab' | 'dialog'

const TASKS: Partial<Record<JobKind, string>> = {
  layout_proposal: 'placing text with AI',
  copy_options: 'writing copy options',
  brief_extraction: 'reading the brief',
  translation: 'translating',
}
const ANY_TASK = 'the AI task'

export const PAID_LINE = 'A request already sent may still be charged.'

const task = (job: AttachedJob) => (job.kind && TASKS[job.kind]) ?? ANY_TASK
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function closeTitle(jobs: AttachedJob[]): string {
  const [only] = jobs
  return jobs.length === 1 && only ? `Stop ${task(only)}?` : `Stop ${jobs.length} AI tasks?`
}

export function closeBody(jobs: AttachedJob[], place: ClosePlace): string {
  const [only] = jobs
  if (jobs.length === 1 && only)
    return `${capital(task(only))} is still running. Closing this ${place} stops it.`
  return `${jobs.length} AI tasks are still running. Closing this ${place} stops them.`
}

// P7-13 (A-174): started paid video runs a close leaves running for the next open.
export function leftRunningLine(provider: string, n: number): string {
  return n === 1
    ? `${provider} has started 1 video and will charge for it. It keeps running; open the project again to collect it.`
    : `${provider} has started ${n} videos and will charge for them. They keep running; open the project again to collect them.`
}

// A provider the window does not know is not called paid.
export function anyPaid(jobs: AttachedJob[], providers: readonly ProviderInfo[]): boolean {
  return jobs.some((j) => providers.some((p) => p.id === j.provider && !p.local))
}
