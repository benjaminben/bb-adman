// ST-11 (spec/app-style.md, "Campaign page, grid and tiles"): an approval mark's badge kind and
// icon, from its words (shared/approvals/marks.ts). Pure; the words are drawn unchanged.
import type { IconName } from '@/renderer/ui/icon'

export type MarkLook = { kind: 'ok' | 'warn' | 'neutral'; icon: IconName }

export function markLook(word: string): MarkLook {
  if (word.startsWith('Signed off by')) return { kind: 'ok', icon: 'check' }
  if (word.startsWith('Changed since')) return { kind: 'warn', icon: 'alert' }
  if (word === 'Not in the gallery') return { kind: 'neutral', icon: 'eye' }
  return { kind: 'neutral', icon: 'clock' }
}
