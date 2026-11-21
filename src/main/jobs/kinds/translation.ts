// The translation job kind (spec/phases/phase-06.md, design addition 2; attached [D-036]). The
// key guard; one TextProvider.translate call through jc.call, so paid_calls counts it; the
// answer cleaned (A-168); in 'write' mode, then translation.write with the cleaned items. Only
// the texts, the language tags, the region and the audience go to the provider, through the
// adapter's fixed instruction. A failure carries a fixed sentence, never the answer's text.
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { LocalFailure } from '@/main/jobs/local-failure'
import { runOptions } from '@/main/jobs/progress'
import { readWireRow } from '@/main/db/rows'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'
import { cleanAnswer } from '@/main/translation/clean-answer'
import { translationJobRequest, type TranslationJobResult } from '@/shared/schemas/jobs/translation'
import type { JobRow } from '@/shared/schemas/rows/job'

export const NO_USABLE_TRANSLATION = 'No usable translation in the answer'

async function runTranslationJob(jc: JobRunContext, job: JobRow): Promise<TranslationJobResult> {
  const request = translationJobRequest.parse(job.request)
  const providerId = job.provider ?? ''
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  requireProviderKeys(jc.deps, providerId, 'translate')
  // spec/ai-jobs.md OI-68: the campaign deleted after the run was queued.
  const campaign = job.campaignId && readWireRow(project.db, 'campaign', { id: job.campaignId })
  if (!campaign) throw new LocalFailure('target_gone')
  const provider = adapterFor(jc.deps, providerId, 'text')
  const { from, to, region, audience } = request
  const items = request.items.map(({ key, text }) => ({ key, text }))
  const answer = await jc.call(() =>
    provider.translate({ items, from, to, region, audience }, runOptions(jc)),
  )
  const cleaned = cleanAnswer(
    answer,
    request.items.map((i) => i.key),
  )
  if (cleaned.length === 0) {
    throw new ProviderFailure({ kind: 'other', detail: NO_USABLE_TRANSLATION })
  }
  if (jc.cancelled()) throw new ProviderCancelled()
  if (request.mode === 'sync') return { items: cleaned, written: 0 }
  const reply = await jc.system('translation.write', {
    projectId: jc.projectId,
    jobId: job.id,
    items: cleaned,
  })
  if (!reply.ok) throw new LocalFailure('results_not_added')
  const { written } = reply.data as { written: number }
  return { items: cleaned, written }
}

export function translationKind(): JobKindHandler {
  return { kind: 'translation', run: runTranslationJob }
}
