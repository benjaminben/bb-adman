// spec/phases/phase-06.md, design addition 2, "Status on new layers": a text layer copied into
// a variant in another language starts as a missing translation; every other layer has none.
// Phase 5's fan-out and variant.add use it for every copied layer.
import type { LayerRow } from '@/shared/schemas/rows/layer'

export type TranslationFields = Pick<LayerRow, 'translationStatus' | 'translationSource'>

export function initialTranslation(
  variantLanguage: string,
  primaryLanguage: string,
  layerType: LayerRow['type'],
): TranslationFields {
  const translated = layerType === 'text' && variantLanguage !== primaryLanguage
  return { translationStatus: translated ? 'missing' : null, translationSource: null }
}
