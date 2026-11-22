// The words for a variant tile's marks (spec/screens-campaign.md, "The campaign grid and the
// variant tile"), in the order the tile shows them. Pure. Design wave CAMP-1 (C-11): each is a
// StatusMark of its tone with no label; the word is its tip and accessible name. New result is
// an accent dot with no icon; running draws the spinner.
import type { IconName } from '@/renderer/ui/icon'
import type { StatusTone } from '@/renderer/ui/status-mark'
import type { VariantBadges } from '@/shared/schemas/queries/campaign'

export type BadgeKind = StatusTone
export type BadgeKey = keyof VariantBadges
export type BadgeMark = { key: BadgeKey; word: string; kind: BadgeKind; icon?: IconName }

const BADGE_MARKS: BadgeMark[] = [
  { key: 'jobRunning', word: 'Running', kind: 'running', icon: 'spinner' },
  { key: 'resultUnseen', word: 'New result', kind: 'accent' },
  { key: 'overflow', word: 'Text does not fit', kind: 'danger', icon: 'text' },
  { key: 'missingFile', word: 'File missing', kind: 'warn', icon: 'file' },
  { key: 'translationUnapproved', word: 'Translation not approved', kind: 'none', icon: 'globe' },
  { key: 'outOfDate', word: 'Out of date', kind: 'warn', icon: 'clock' },
  { key: 'checkWarning', word: 'Check warning', kind: 'warn', icon: 'alert' },
  { key: 'checkStale', word: 'Not checked', kind: 'none', icon: 'shield' },
]

export function badgeMarks(badges: VariantBadges): BadgeMark[] {
  return BADGE_MARKS.filter((mark) => badges[mark.key])
}

export function badgeWords(badges: VariantBadges): string[] {
  return badgeMarks(badges).map((mark) => mark.word)
}
