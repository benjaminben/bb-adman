import { cleanList, matches } from './match'
import { CHECK_MESSAGES } from './messages'
import { shownTextLayers } from './shown'
import { checked, skipped, type CheckInput, type CheckResult } from './types'

// prohibited-words [FR-113, FR-240, A-150]: every text layer, hidden ones included.
export function prohibitedWordsCheck(input: CheckInput): CheckResult {
  const { language } = input.variant
  const entries = cleanList(input.ruleSet.prohibitedWords[language])
  if (entries.length === 0) {
    return skipped('prohibited-words', 'brand-legal', CHECK_MESSAGES.noProhibitedWords(language))
  }
  const findings = input.layers
    .filter((layer) => layer.type === 'text')
    .flatMap((layer) =>
      entries
        .filter((entry) => matches(layer.copy ?? '', entry, language))
        .map((entry) => ({
          layerId: layer.id,
          message: CHECK_MESSAGES.containsProhibited(layer.name, entry),
        })),
    )
  return checked('prohibited-words', 'brand-legal', findings)
}

// required-words [FR-113, A-150]: shown text layers' copy, joined with a line break.
export function requiredWordsCheck(input: CheckInput): CheckResult {
  const { language } = input.variant
  const entries = cleanList(input.ruleSet.requiredWords[language])
  if (entries.length === 0) {
    return skipped('required-words', 'brand-legal', CHECK_MESSAGES.noRequiredWords(language))
  }
  const joined = shownTextLayers(input.layers, input.variant)
    .map((layer) => layer.copy ?? '')
    .join('\n')
  const findings = entries
    .filter((entry) => !matches(joined, entry, language))
    .map((entry) => ({ message: CHECK_MESSAGES.requiredMissing(entry) }))
  return checked('required-words', 'brand-legal', findings)
}
