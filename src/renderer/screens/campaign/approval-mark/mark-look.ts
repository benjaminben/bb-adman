// A tile's approval mark as a StatusMark (design wave CAMP-1), from its words
// (shared/approvals/marks.ts). Pure; the words are the mark's tip, unchanged. "Signed off by
// {n}" shows its count as the label.
import type { IconName } from '@/renderer/ui/icon'
import type { StatusTone } from '@/renderer/ui/status-mark'

export type MarkLook = { tone: StatusTone; icon: IconName; label?: string }

export function markLook(word: string): MarkLook {
  if (word.startsWith('Signed off by')) {
    return { tone: 'ok', icon: 'check', label: word.slice('Signed off by '.length) }
  }
  if (word.startsWith('Changed since')) return { tone: 'warn', icon: 'sync' }
  if (word === 'Not in the gallery') return { tone: 'none', icon: 'eyeOff' }
  return { tone: 'none', icon: 'clock' }
}
