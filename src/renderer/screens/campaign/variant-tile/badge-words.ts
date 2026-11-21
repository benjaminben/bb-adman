// The words for a variant tile's marks (spec/screens-campaign.md, "The campaign grid and the
// variant tile"), in the order the tile shows them. Pure.
import type { VariantBadges } from '@/shared/schemas/queries/campaign'

const BADGE_WORDS: [keyof VariantBadges, string][] = [
  ['jobRunning', 'Running'],
  ['resultUnseen', 'New result'],
  ['overflow', 'Text does not fit'],
  ['missingFile', 'File missing'],
  ['translationUnapproved', 'Translation not approved'],
  ['outOfDate', 'Out of date'],
  ['checkWarning', 'Check warning'],
  ['checkStale', 'Not checked'],
]

export function badgeWords(badges: VariantBadges): string[] {
  return BADGE_WORDS.filter(([key]) => badges[key]).map(([, word]) => word)
}
