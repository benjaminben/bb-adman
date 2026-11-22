// spec/editor.md, "Properties panel": the head (the layer's type icon and name, ED-1b), then one
// section per component: Text and Box (text layers), Picture, Shade and Generate (image and
// background layers), Position. The Layer section is gone: its actions are on the layer row
// (choice C-3). Sections are keyed by the layer, so an unsaved edit or a refusal message does
// not carry over to another layer. The panel is compact (spec/app-style-parts.md, "Panel").
import { AnimationFields } from '@/renderer/editor/animation-fields'
import { FontField } from '@/renderer/editor/font-field'
import { GeneratePanel } from '@/renderer/editor/generate-panel'
import { GeometryFields } from '@/renderer/editor/geometry-fields'
import { LanguageFont } from '@/renderer/editor/language-font'
import { PictureFields, type PictureAsset } from '@/renderer/editor/picture-fields'
import { ShadeFields } from '@/renderer/editor/shade-fields'
import { TextBoxFields } from '@/renderer/editor/text-box-fields'
import { TextFields } from '@/renderer/editor/text-fields'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { PanelEmpty, PanelTop } from './panel-top'
import { useLayerActions } from './use-layer-actions'
import { usePalette } from './use-palette'
import styles from './properties-panel.module.css'

export type PropertiesPanelProps = {
  projectId: string
  campaignId: string | null
  layer: LayerRow | null
  layers: LayerRow[]
  // The variant's assets by ID and its size, for the Picture section. The editor passes both,
  // the variant itself as the canvas; a video ad's format and length give a text layer its
  // Animation section (P7-19).
  assets?: Readonly<Record<string, PictureAsset>>
  canvas?: { width: number; height: number; format?: 'image' | 'video'; durationMs?: number }
  // Starts crop mode on the canvas for the layer; the editor passes it.
  onCrop?: (layerId: string) => void
}

type SectionsProps = PropertiesPanelProps & { layer: LayerRow; palette: string[] }

function Sections(props: SectionsProps) {
  const { layer } = props
  const actions = useLayerActions(props.projectId, layer)
  const font = layer.type === 'text' && 'fontAssetId' in layer.style && (
    <>
      <FontField
        projectId={props.projectId}
        fontAssetId={layer.style.fontAssetId}
        disabled={layer.locked}
        onChange={(fontAssetId) => actions.update({ style: { fontAssetId } })}
      />
      {layer.translationStatus !== null && (
        <LanguageFont projectId={props.projectId} campaignId={props.campaignId} layer={layer} />
      )}
    </>
  )
  return (
    <>
      {font && (
        <TextFields layer={layer} palette={props.palette} font={font} onUpdate={actions.update} />
      )}
      {font && <TextBoxFields layer={layer} palette={props.palette} onUpdate={actions.update} />}
      {font && props.canvas?.format === 'video' && (
        <AnimationFields
          layer={layer}
          durationMs={props.canvas.durationMs ?? 0}
          onUpdate={actions.update}
        />
      )}
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
        <GeneratePanel
          projectId={props.projectId}
          campaignId={props.campaignId}
          layer={layer}
          layers={props.layers}
          format={props.canvas?.format ?? 'image'}
        />
      )}
      <GeometryFields geometry={layer.geometry} disabled={layer.locked} onUpdate={actions.update} />
    </>
  )
}

export function PropertiesPanel(props: PropertiesPanelProps) {
  const { layer } = props
  const palette = usePalette(props.projectId, props.campaignId)
  return (
    <section aria-label="Properties" className={styles.panel} data-density="compact">
      {layer ? (
        <>
          <PanelTop projectId={props.projectId} layer={layer} />
          <div className={styles.body}>
            <Sections key={layer.id} {...props} layer={layer} palette={palette} />
          </div>
        </>
      ) : (
        <PanelEmpty video={props.canvas?.format === 'video'} />
      )}
    </section>
  )
}
