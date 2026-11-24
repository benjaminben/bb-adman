// The brief_extraction job kind (spec/ai-jobs.md "Brief reading"; FR-022, FR-023). The key
// guard, one call to the text adapter with the brief's whole text, then the answer goes through
// briefDraftFrom: unknown and wrong-typed fields are dropped. The draft is untrusted data that
// the user reviews in the brief form before anything is a brief. No word of it is logged.
// The AI reader gives no photos: pictures are removed from every subject, so a path an answer
// made up is never stored or shown (spec/subject-photos.md "The AI brief reader", A-114).
// For the same reason the brand's logo and fonts are removed; its colours stay, and so do
// layout, artDirection and adsPer, which are no paths (spec/brief-brand.md, A-404).
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { runOptions } from '@/main/jobs/progress'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { ProviderFailure } from '@/main/providers/types'
import { briefDraftFrom } from '@/shared/brief/draft'
import { primaryLanguageOf } from '@/shared/brief/primary-language'
import type { BriefDraft } from '@/shared/schemas/brief'
import { briefJobRequest, type BriefJobResult } from '@/shared/schemas/jobs/brief-extraction'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { TextAdapterFor } from './copy-options'

const noFields = () =>
  new ProviderFailure({ kind: 'other', detail: 'No brief fields in the answer' })

function withoutPictures(draft: BriefDraft): BriefDraft {
  if (draft.subjects === undefined) return draft
  const subjects = draft.subjects.map(({ pictures: _pictures, ...subject }) => subject)
  return { ...draft, subjects }
}

// A brand left with no field is removed, so an answer that named only brand files has no
// brief fields.
function withoutBrandFiles(draft: BriefDraft): BriefDraft {
  if (draft.brand === undefined) return draft
  const brand = { ...draft.brand }
  delete brand.logo
  delete brand.fonts
  const empty = Object.values(brand).every((value) => value === undefined)
  return { ...draft, brand: empty ? undefined : brand }
}

async function runBriefJob(
  jc: JobRunContext,
  job: JobRow,
  textFor: TextAdapterFor,
): Promise<BriefJobResult> {
  const request = briefJobRequest.parse(job.request)
  const providerId = job.provider ?? ''
  requireProviderKeys(jc.deps, providerId, 'read a brief with AI')
  const provider = textFor(jc.deps, providerId)
  const answer = await jc.call(() => provider.extractBrief({ text: request.text }, runOptions(jc)))
  const parsed = briefDraftFrom(answer)
  if (!parsed.ok) throw noFields()
  const draft = withoutBrandFiles(withoutPictures(parsed.data))
  if (Object.values(draft).every((value) => value === undefined)) throw noFields()
  return { draft, primaryLanguage: primaryLanguageOf(draft) }
}

const defaultTextFor: TextAdapterFor = (deps, providerId) => adapterFor(deps, providerId, 'text')

export function briefExtractionKind(textFor: TextAdapterFor = defaultTextFor): JobKindHandler {
  return { kind: 'brief_extraction', run: (jc, job) => runBriefJob(jc, job, textFor) }
}
