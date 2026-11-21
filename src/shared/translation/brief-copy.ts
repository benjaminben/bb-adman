// A-163 (spec/phases/phase-06.md, design addition 2, "Brief-supplied copy"): the brief's own
// copy for a language, by slot, trimmed; empty or absent gives null. Used at fan-out (P6-15).
import type { Brief } from '@/shared/schemas/brief'

export function briefCopyFor(brief: Brief, language: string, slot: string | null): string | null {
  const copy = brief.copy
  // Only the brief's own languages: a language named like an object key reads nothing.
  if (!copy || !Object.hasOwn(copy, language)) return null
  const entry = copy[language]
  const text =
    slot === 'headline'
      ? entry?.headline
      : slot === 'call-to-action'
        ? entry?.callToAction
        : undefined
  const trimmed = text?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}
