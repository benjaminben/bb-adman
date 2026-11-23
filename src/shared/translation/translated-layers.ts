// spec/phases/phase-06.md, design addition 2, "Status on new layers" and "Brief-supplied copy"
// (A-163): a new variant's planned layers with their first translation state and the brief's
// copy. A text layer in another language starts `missing`; the brief's copy for the language
// fills its slot (`proposed`, source `brief`). Shared by fan-out and the quickstart CLI. Pure.
import type { PlannedLayer } from '@/shared/links/fan-out-plan'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import { briefCopyFor } from '@/shared/translation/brief-copy'
import { initialTranslation } from '@/shared/translation/initial'

export function translatedLayers(
  campaign: Pick<CampaignRow, 'primaryLanguage' | 'brief'>,
  language: string,
  layers: PlannedLayer[],
): PlannedLayer[] {
  return layers.map((layer) => {
    const first = {
      ...layer,
      ...initialTranslation(language, campaign.primaryLanguage, layer.type),
    }
    if (first.translationStatus !== 'missing') return first
    const copy = briefCopyFor(campaign.brief, language, layer.slot)
    if (copy === null) return first
    return { ...first, copy, translationStatus: 'proposed', translationSource: 'brief' }
  })
}
