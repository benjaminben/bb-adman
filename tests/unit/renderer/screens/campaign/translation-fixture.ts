// Rows of translation.forCampaign for the translation panel's tests. Made-up words only.
import type { TranslationForCampaign, TranslationRow } from '@/shared/schemas/queries/translation'

export function translationRow(
  layerId: string,
  over: Partial<TranslationRow> = {},
): TranslationRow {
  return {
    directionId: 'D1',
    variantId: `V-${layerId}`,
    title: 'Morning',
    sizeLabel: 'Story',
    language: 'de',
    layerId,
    layerKey: `key-${layerId}`,
    layerName: 'Headline',
    sourceText: 'Fresh coffee',
    text: 'Frischer Kaffee',
    status: 'proposed',
    source: 'ai',
    fontAssetId: null,
    copyRev: 1,
    ...over,
  }
}

export function translations(rows: TranslationRow[]): TranslationForCampaign {
  return { primaryLanguage: 'en', rows, jobs: [] }
}
