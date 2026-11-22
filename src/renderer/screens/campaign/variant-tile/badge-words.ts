// The words for a variant tile's marks (spec/screens-campaign.md, "The campaign grid and the
// variant tile"), in the order the tile shows them. Pure. ST-11 (spec/app-style.md, "Campaign
// page, grid and tiles"): each mark is drawn as a badge of its kind with an icon: out of date
// and missing file warn, text does not fit danger, generating accent, others neutral.
import type { IconName } from '@/renderer/ui/icon'
import type { VariantBadges } from '@/shared/schemas/queries/campaign'

export type BadgeKind = 'warn' | 'danger' | 'accent' | 'neutral'
export type BadgeMark = { word: string; kind: BadgeKind; icon: IconName }

const BADGE_MARKS: [keyof VariantBadges, BadgeMark][] = [
  ['jobRunning', { word: 'Running', kind: 'accent', icon: 'spinner' }],
  ['resultUnseen', { word: 'New result', kind: 'neutral', icon: 'sparkle' }],
  ['overflow', { word: 'Text does not fit', kind: 'danger', icon: 'text' }],
  ['missingFile', { word: 'File missing', kind: 'warn', icon: 'file' }],
  ['translationUnapproved', { word: 'Translation not approved', kind: 'neutral', icon: 'globe' }],
  ['outOfDate', { word: 'Out of date', kind: 'warn', icon: 'clock' }],
  ['checkWarning', { word: 'Check warning', kind: 'neutral', icon: 'alert' }],
  ['checkStale', { word: 'Not checked', kind: 'neutral', icon: 'shield' }],
]

export function badgeMarks(badges: VariantBadges): BadgeMark[] {
  return BADGE_MARKS.filter(([key]) => badges[key]).map(([, mark]) => mark)
}

export function badgeWords(badges: VariantBadges): string[] {
  return badgeMarks(badges).map((mark) => mark.word)
}
