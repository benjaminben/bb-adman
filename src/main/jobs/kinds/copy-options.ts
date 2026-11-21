// The copy_options job kind (spec/ai-jobs.md "Copy options"; FR-045). The key guard, the
// campaign's stored brief, one call to the text adapter, then the options are cleaned: trimmed;
// empty ones, ones over maxChars code points and repeats (in lower case) dropped; cut to count.
// The answer is untrusted data and leaves only as plain strings (spec/ai-jobs.md "Security notes").
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { runOptions } from '@/main/jobs/progress'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRow } from '@/main/db/rows'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { ProviderCancelled, ProviderFailure, type TextProvider } from '@/main/providers/types'
import type { Brief } from '@/shared/schemas/brief'
import {
  copyJobRequest,
  type CopyJobRequest,
  type CopyJobResult,
} from '@/shared/schemas/jobs/copy-options'
import type { JobRow } from '@/shared/schemas/rows/job'

export type TextAdapterFor = (deps: CoreDeps, providerId: string) => TextProvider

function cleanOptions(options: readonly unknown[], request: CopyJobRequest): string[] {
  const kept: string[] = []
  const seen = new Set<string>()
  for (const option of options) {
    if (typeof option !== 'string') continue
    const text = option.trim()
    const key = text.toLowerCase()
    if (text === '' || [...text].length > request.maxChars || seen.has(key)) continue
    seen.add(key)
    kept.push(text)
    if (kept.length === request.count) break
  }
  return kept
}

// spec/ai-jobs.md OI-68: the campaign deleted after the run was queued.
const targetGone = () =>
  new ProviderFailure({ kind: 'other', reason: 'target_gone', detail: 'target_gone' })

async function runCopyJob(
  jc: JobRunContext,
  job: JobRow,
  textFor: TextAdapterFor,
): Promise<CopyJobResult> {
  const request = copyJobRequest.parse(job.request)
  const providerId = job.provider ?? ''
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  requireProviderKeys(jc.deps, providerId, 'suggest copy')
  const campaign =
    job.campaignId === null
      ? null
      : (readWireRow(project.db, 'campaign', { id: job.campaignId }) as { brief: Brief } | null)
  if (!campaign) throw targetGone()
  const provider = textFor(jc.deps, providerId)
  const answer = await jc.call(() =>
    provider.copyOptions(
      {
        role: request.role,
        brief: campaign.brief,
        language: request.language,
        count: request.count,
        maxChars: request.maxChars,
      },
      runOptions(jc),
    ),
  )
  const options = cleanOptions(Array.isArray(answer) ? answer : [], request)
  if (options.length === 0) {
    throw new ProviderFailure({ kind: 'other', detail: 'No usable copy in the answer' })
  }
  return { options }
}

const defaultTextFor: TextAdapterFor = (deps, providerId) => adapterFor(deps, providerId, 'text')

export function copyOptionsKind(textFor: TextAdapterFor = defaultTextFor): JobKindHandler {
  return { kind: 'copy_options', run: (jc, job) => runCopyJob(jc, job, textFor) }
}
