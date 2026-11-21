// The translate answer's cleaning (spec/phases/phase-06.md, section 3; A-168), in the job, not
// the adapter. The answer is untrusted: an item is kept only when its key was asked and not
// seen before, and its text is a string, trimmed non-empty and at most 5000 code points. Keys
// are matched through a Map built from the keys sent; an answer's key never indexes an object.
// Each kept item is a new pair of plain strings, the key as it was asked.
import { MAX_TRANSLATION_CHARS } from '@/shared/schemas/commands/translation'

export type CleanItem = { key: string; text: string }

function fieldOf(item: unknown, name: 'key' | 'text'): unknown {
  if (typeof item !== 'object' || item === null || !Object.hasOwn(item, name)) return undefined
  return (item as Record<typeof name, unknown>)[name]
}

export function cleanAnswer(answer: unknown, askedKeys: readonly string[]): CleanItem[] {
  if (!Array.isArray(answer)) return []
  const asked = new Map(askedKeys.map((key) => [key, key]))
  const kept: CleanItem[] = []
  for (const item of answer) {
    const key = fieldOf(item, 'key')
    const text = fieldOf(item, 'text')
    const askedKey = typeof key === 'string' ? asked.get(key) : undefined
    if (askedKey === undefined) continue
    asked.delete(askedKey)
    if (typeof text !== 'string') continue
    const trimmed = text.trim()
    if (trimmed === '' || [...trimmed].length > MAX_TRANSLATION_CHARS) continue
    kept.push({ key: askedKey, text: trimmed })
  }
  return kept
}
