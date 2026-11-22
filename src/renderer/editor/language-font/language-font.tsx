// spec/phases/phase-06.md, design additions 6 and 8 (P6-14, A-166): under the font field of a
// translated text layer, "Use this font for every {language} post" sends one layer.setFonts that
// gives the layer's stored font (null for the default) to every layer of the same direction,
// language and key. {language} is the variant's language tag, as the editor's other lines show
// it. Hidden on a layer in the campaign's main language and outside a campaign.
// ED-2: a quiet button "All {language} posts" with the longer words in an InfoTip.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { useSameLanguageLayers } from './use-same-language-layers'
import styles from './language-font.module.css'

export type LanguageFontProps = {
  projectId: string
  campaignId: string | null
  layer: LayerRow
}

const fontOf = (layer: LayerRow): string | null =>
  'fontAssetId' in layer.style ? layer.style.fontAssetId : null

export function LanguageFont(props: LanguageFontProps) {
  const { layer } = props
  const api = useApi()
  const same = useSameLanguageLayers(props.projectId, props.campaignId, layer.id)
  const [error, setError] = useState<string | null>(null)
  if (!same) return null

  async function apply(layerIds: string[]) {
    const fontAssetId = fontOf(layer)
    const items = layerIds.map((layerId) => ({ layerId, fontAssetId }))
    const result = await api.command('layer.setFonts', { projectId: props.projectId, items })
    setError(result.ok ? null : result.error.message)
  }

  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <button
          type="button"
          className={`${layout.quiet} ${layout.small}`}
          onClick={() => void apply(same.layerIds)}
        >
          {`All ${same.language} posts`}
        </button>
        <InfoTip about={`all ${same.language} posts`}>
          {`Uses this font for every ${same.language} post.`}
        </InfoTip>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
