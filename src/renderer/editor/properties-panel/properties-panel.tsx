// spec/editor.md, "Properties panel": the header (the layer's name and kind), then one section
// per component: Layer, Text and Box (text layers), Picture, Shade and Make pictures with AI
// (image and background layers), Position and size. Sections are keyed by the layer, so an unsaved edit
// or a refusal message does not carry over to another layer.
import { FontField } from '@/renderer/editor/font-field'
import { GeometryFields } from '@/renderer/editor/geometry-fields'
import { LayerFields } from '@/renderer/editor/layer-fields'
import { PictureAi } from '@/renderer/editor/picture-ai'
import { PictureFields, type PictureAsset } from '@/renderer/editor/picture-fields'
import { ShadeFields } from '@/renderer/editor/shade-fields'
import { TextBoxFields } from '@/renderer/editor/text-box-fields'
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
  // The variant's assets by ID and its size, for the Picture section. The editor passes both.
  assets?: Readonly<Record<string, PictureAsset>>
  canvas?: { width: number; height: number }
  // Starts crop mode on the canvas for the layer; the editor passes it.
  onCrop?: (layerId: string) => void
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
      {font && <TextBoxFields layer={layer} palette={props.palette} onUpdate={actions.update} />}
      {layer.type !== 'text' && (
        <PictureFields
          projectId={props.projectId}
          layer={layer}
          asset={(layer.source && props.assets?.[layer.source.assetId]) ?? null}
          canvas={props.canvas ?? null}
          onUpdate={actions.update}
          onCrop={props.onCrop && (() => props.onCrop?.(layer.id))}
          palette={props.palette}
        />
      )}
      {layer.type !== 'text' && (
        <ShadeFields layer={layer} palette={props.palette} onUpdate={actions.update} />
      )}
      {layer.type !== 'text' && (
        <PictureAi projectId={props.projectId} campaignId={props.campaignId} layer={layer} />
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
          <div className={styles.body}>
            <Sections key={layer.id} {...props} layer={layer} palette={palette} />
          </div>
        </>
      ) : (
        <p className={styles.empty}>Select a layer to change it.</p>
      )}
    </section>
  )
}
