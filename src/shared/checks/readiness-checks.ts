import { CHECK_MESSAGES } from './messages'
import { shownTextLayers } from './shown'
import { checked, skipped, type CheckInput, type CheckResult } from './types'

// unapproved-translations [FR-116, R-18]: no text layer is missing or proposed.
export function unapprovedTranslationsCheck(input: CheckInput): CheckResult {
  if (input.variant.language === input.primaryLanguage) {
    return skipped('unapproved-translations', 'readiness', CHECK_MESSAGES.mainLanguage)
  }
  const findings = input.layers.flatMap((layer) => {
    if (layer.type !== 'text') return []
    if (layer.translationStatus === 'proposed') {
      return [{ layerId: layer.id, message: CHECK_MESSAGES.notApproved(layer.name) }]
    }
    if (layer.translationStatus === 'missing') {
      return [{ layerId: layer.id, message: CHECK_MESSAGES.noTranslation(layer.name) }]
    }
    return []
  })
  return checked('unapproved-translations', 'readiness', findings)
}

// text-overflow [FR-116, R-18]: no shown text layer overflows. Never skipped.
export function textOverflowCheck(input: CheckInput): CheckResult {
  const findings = shownTextLayers(input.layers, input.variant)
    .filter((layer) => layer.overflow)
    .map((layer) => ({ layerId: layer.id, message: CHECK_MESSAGES.overflows(layer.name) }))
  return checked('text-overflow', 'readiness', findings)
}
