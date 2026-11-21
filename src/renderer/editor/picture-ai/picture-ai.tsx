// "Make pictures with AI" (spec/screens-ai.md, "The picture section of the properties
// panel"): mounted by the properties panel for image and background layers, between
// "Picture" and "Position and size". It holds the generate fields, then the earlier options
// (P4-18). Disabled parts follow the layer's lock.
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './picture-ai.module.css'

export type PictureAiProps = {
  projectId: string
  campaignId: string | null
  layer: LayerRow
}

export function PictureAi(props: PictureAiProps) {
  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Make pictures with AI</legend>
      <GenerateFields
        projectId={props.projectId}
        campaignId={props.campaignId}
        layer={props.layer}
      />
      <EarlierOptions projectId={props.projectId} layer={props.layer} />
    </fieldset>
  )
}
