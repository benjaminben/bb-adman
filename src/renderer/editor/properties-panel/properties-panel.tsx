// spec/editor.md, "Properties panel": the header (the layer's name and kind), then one section
// per component: Layer, Text (text layers), Position and size. The Picture section (P3-14) goes
// between Layer and Position and size. Sections are keyed by the layer, so an unsaved edit or a
// refusal message does not carry over to another layer.
import { FontField } from '@/renderer/editor/font-field'
import { GeometryFields } from '@/renderer/editor/geometry-fields'
import { LayerFields } from '@/renderer/editor/layer-fields'
import { TextFields } from '@/renderer/editor/text-fields'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { useLayerActions } from './use-layer-actions'
import { usePalette } from './use-palette'
import styles from './properties-panel.module.css'

const KIND: Record<LayerRow['type'], string> = {
  text: 'Text',
  image: 'Picture',
  background: 'Background',
}

export type PropertiesPanelProps = {
  projectId: string
  campaignId: string | null
  layer: LayerRow | null
  layers: LayerRow[]
}

type SectionsProps = PropertiesPanelProps & { layer: LayerRow; palette: string[] }

function Sections(props: SectionsProps) {
  const { layer } = props
  const actions = useLayerActions(props.projectId, layer, props.layers)
  const font = layer.type === 'text' && 'fontAssetId' in layer.style && (
    <FontField
      projectId={props.projectId}
      fontAssetId={layer.style.fontAssetId}
      disabled={layer.locked}
      onChange={(fontAssetId) => actions.update({ style: { fontAssetId } })}
    />
  )
  return (
    <>
      <LayerFields
        layer={layer}
        canForward={actions.canForward}
        canBackward={actions.canBackward}
        onUpdate={actions.update}
        onForward={actions.forward}
        onBackward={actions.backward}
        onDuplicate={actions.duplicate}
        onDelete={actions.remove}
      />
      {font && (
        <TextFields layer={layer} palette={props.palette} font={font} onUpdate={actions.update} />
      )}
      <GeometryFields geometry={layer.geometry} disabled={layer.locked} onUpdate={actions.update} />
    </>
  )
}

export function PropertiesPanel(props: PropertiesPanelProps) {
  const { layer } = props
  const palette = usePalette(props.projectId, props.campaignId)
  return (
    <section aria-label="Properties" className={styles.panel}>
      {layer ? (
        <>
          <header className={styles.header}>
            <h3 className={styles.name}>{layer.name}</h3>
            <p className={styles.kind}>{KIND[layer.type]}</p>
          </header>
          <Sections key={layer.id} {...props} layer={layer} palette={palette} />
        </>
      ) : (
        <p className={styles.empty}>Select a layer to change it.</p>
      )}
    </section>
  )
}
