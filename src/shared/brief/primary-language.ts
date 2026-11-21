// spec/brief-and-templates.md "The brief.parse command": a draft's primary language is the first
// entry of its languages if there is one, otherwise the region's language, otherwise null.
// Used by brief.parse and by the brief_extraction job.
import { primaryLanguageFor } from '@/shared/brief/languages'
import type { BriefDraft } from '@/shared/schemas/brief'

export function primaryLanguageOf(draft: Pick<BriefDraft, 'languages' | 'region'>): string | null {
  return draft.languages?.[0] ?? (draft.region ? primaryLanguageFor(draft.region) : null)
}
